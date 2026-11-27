<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ImportPosSqlCommand extends Command
{
    protected $signature = 'pos:import {--path= : Path to SQL dump or JSON store} {--fresh : Truncate tables before importing}';
    protected $description = 'Import Youth IT POS data cleanly from MySQL dump or JSON snapshot into Laravel tables';

    private array $allowedTables = [
        'users',
        'settings',
        'menus',
        'categories',
        'brands',
        'units',
        'warranties',
        'products',
        'stock_movements',
        'customers',
        'suppliers',
        'employees',
        'owners',
        'owner_transactions',
        'bank_accounts',
        'bank_transactions',
        'cash_transactions',
        'expense_categories',
        'expenses',
        'sales',
        'sale_items',
        'payments',
        'purchases',
        'purchase_items',
        'supplier_payments',
        'estimates',
        'estimate_items',
        'returns',
        'damages',
    ];

    public function handle(): int
    {
        $driver = DB::getDriverName();
        $jsonPath = database_path('pos-store.json');
        $explicitPath = $this->option('path');
        $sqlPath = $explicitPath ?: database_path('sql/youthits_pos.sql');

        // If --path ends in .json or (SQLite without explicit SQL path), import JSON snapshot
        if ($explicitPath && str_ends_with(strtolower($explicitPath), '.json') && file_exists($explicitPath)) {
            return $this->importFromJson($explicitPath);
        }

        if (!$explicitPath && (($driver === 'sqlite' && file_exists($jsonPath)) || (!file_exists($sqlPath) && file_exists($jsonPath)))) {
            return $this->importFromJson($jsonPath);
        }

        if (!file_exists($sqlPath)) {
            $this->error("Database file not found at: {$sqlPath}");
            return self::FAILURE;
        }

        $sql = file_get_contents($sqlPath);
        if ($sql === false) {
            $this->error('Unable to read SQL file.');
            return self::FAILURE;
        }

        Schema::disableForeignKeyConstraints();

        if ($this->option('fresh')) {
            foreach (array_reverse($this->allowedTables) as $table) {
                if (Schema::hasTable($table)) {
                    try {
                        DB::table($table)->delete();
                    } catch (\Throwable) {
                        // ignore
                    }
                }
            }
        }

        $statements = $this->splitSqlStatements($sql);
        $count = 0;

        foreach ($statements as $rawStmt) {
            $stmt = ltrim($rawStmt);
            if ($stmt === '') {
                continue;
            }
            if (!preg_match('/^INSERT\s+(?:IGNORE\s+)?INTO\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s*(.*)$/is', $stmt, $m)) {
                continue;
            }

            $sourceTable = strtolower($m[1]);
            $targetTable = match ($sourceTable) {
                'sells' => 'sales',
                'sell_items' => 'sale_items',
                'product_categories' => 'categories',
                default => $sourceTable,
            };

            if (!in_array($targetTable, $this->allowedTables, true) || !Schema::hasTable($targetTable)) {
                continue;
            }

            // Rewrite table alias if needed
            $normalizedStmt = $stmt;
            if ($sourceTable !== $targetTable) {
                $normalizedStmt = preg_replace(
                    '/^(INSERT\s+(?:IGNORE\s+)?INTO\s+)[`"]?' . preg_quote($m[1], '/') . '[`"]?/i',
                    '$1`' . $targetTable . '`',
                    $normalizedStmt,
                    1
                ) ?? $normalizedStmt;
            }

            if ($driver === 'sqlite') {
                // Convert MySQL backslash escapes cleanly or parse & insert via Query Builder for SQLite compatibility
                $parsed = $this->parseInsertToRows($normalizedStmt, $targetTable);
                if ($parsed !== null) {
                    foreach (array_chunk($parsed, 100) as $chunk) {
                        DB::table($targetTable)->insertOrIgnore($chunk);
                    }
                    $count++;
                    continue;
                }
                $normalizedStmt = preg_replace('/^INSERT\s+INTO\s+/i', 'INSERT OR IGNORE INTO ', $normalizedStmt, 1) ?? $normalizedStmt;
                try {
                    DB::unprepared($normalizedStmt);
                    $count++;
                } catch (\Throwable) {
                    // skip incompatible SQLite statement
                }
            } else {
                // Parse and insert via column-filtered chunks first when columns mismatch, fallback to raw INSERT IGNORE
                $parsed = $this->parseInsertToRows($normalizedStmt, $targetTable);
                if ($parsed !== null) {
                    foreach (array_chunk($parsed, 150) as $chunk) {
                        DB::table($targetTable)->insertOrIgnore($chunk);
                    }
                    $count++;
                } else {
                    $normalizedStmt = preg_replace('/^INSERT\s+INTO\s+/i', 'INSERT IGNORE INTO ', $normalizedStmt, 1) ?? $normalizedStmt;
                    try {
                        DB::unprepared($normalizedStmt);
                        $count++;
                    } catch (\Throwable) {
                        // continue cleanly
                    }
                }
            }
        }

        Schema::enableForeignKeyConstraints();
        $this->normalizeImportedData();
        $this->info("Imported {$count} SQL data blocks into Youth IT POS tables.");

        return self::SUCCESS;
    }

    /**
     * Quote-aware SQL statement splitter handling single/double quotes, backslash escapes, and comments.
     *
     * @return array<int, string>
     */
    private function splitSqlStatements(string $sql): array
    {
        $statements = [];
        $len = strlen($sql);
        $buffer = '';
        $inSingle = false;
        $inDouble = false;
        $inBacktick = false;

        for ($i = 0; $i < $len; $i++) {
            $ch = $sql[$i];
            $next = $i + 1 < $len ? $sql[$i + 1] : '';

            if (!$inSingle && !$inDouble && !$inBacktick) {
                if (($ch === '-' && $next === '-') || $ch === '#') {
                    while ($i < $len && $sql[$i] !== "\n") {
                        $i++;
                    }
                    continue;
                }
                if ($ch === '/' && $next === '*') {
                    $i += 2;
                    while ($i + 1 < $len && !($sql[$i] === '*' && $sql[$i + 1] === '/')) {
                        $i++;
                    }
                    $i++;
                    continue;
                }
            }

            if ($ch === '\\' && ($inSingle || $inDouble)) {
                $buffer .= $ch;
                if ($i + 1 < $len) {
                    $buffer .= $sql[$i + 1];
                    $i++;
                }
                continue;
            }

            if ($ch === "'" && !$inDouble && !$inBacktick) {
                if ($inSingle && $next === "'") {
                    $buffer .= "''";
                    $i++;
                    continue;
                }
                $inSingle = !$inSingle;
            } elseif ($ch === '"' && !$inSingle && !$inBacktick) {
                $inDouble = !$inDouble;
            } elseif ($ch === '`' && !$inSingle && !$inDouble) {
                $inBacktick = !$inBacktick;
            } elseif ($ch === ';' && !$inSingle && !$inDouble && !$inBacktick) {
                $trimmed = trim($buffer);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $buffer = '';
                continue;
            }

            $buffer .= $ch;
        }

        $tail = trim($buffer);
        if ($tail !== '') {
            $statements[] = $tail;
        }

        return $statements;
    }

    /**
     * Parse INSERT INTO `table` (`col1`, ...) VALUES (...), (...) into column-filtered associative rows.
     *
     * @return array<int, array<string, mixed>>|null
     */
    private function parseInsertToRows(string $statement, string $table): ?array
    {
        if (!preg_match('/^INSERT\s+(?:IGNORE\s+)?INTO\s+[`"]?[a-zA-Z0-9_]+[`"]?\s*\(([^)]+)\)\s*VALUES\s*(.+)$/is', $statement, $m)) {
            return null;
        }

        $rawCols = array_map(
            static fn ($c) => strtolower(trim($c, " \t\n\r`\"")),
            explode(',', $m[1])
        );
        $valuesPart = trim($m[2]);

        $schemaCols = Schema::getColumnListing($table);
        $colFlip = array_flip($schemaCols);

        $tuples = $this->parseValueTuples($valuesPart);
        if ($tuples === []) {
            return null;
        }

        $rows = [];
        foreach ($tuples as $vals) {
            if (count($vals) !== count($rawCols)) {
                continue;
            }
            $row = [];
            foreach ($rawCols as $idx => $col) {
                $mappedCol = $this->mapColumnAlias($table, $col);
                if (isset($colFlip[$mappedCol])) {
                    $row[$mappedCol] = $vals[$idx];
                }
            }
            $row = $this->normalizeRowFields($table, $row, $colFlip);
            if ($row !== []) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    private function mapColumnAlias(string $table, string $col): string
    {
        if ($table === 'sales') {
            return match ($col) {
                'sell_date' => 'date',
                'final_receivable', 'total_amount', 'total' => 'receivable',
                'paid_amount' => 'paid',
                'due_amount' => 'due',
                default => $col,
            };
        }
        if ($table === 'sale_items') {
            return match ($col) {
                'sell_id' => 'sale_id',
                'rate', 'unit_price' => 'price',
                'qty' => 'quantity',
                'sub_total' => 'total',
                default => $col,
            };
        }
        if ($table === 'owners') {
            return $col === 'status' ? 'is_active' : $col;
        }
        return $col;
    }

    private function normalizeRowFields(string $table, array $row, array $colFlip): array
    {
        $now = now()->format('Y-m-d H:i:s');
        if ($table === 'sales') {
            if (empty($row['date'])) {
                $srcDate = (string) ($row['sale_date'] ?? $row['created_at'] ?? '');
                $row['date'] = strlen($srcDate) >= 10 ? substr($srcDate, 0, 10) : substr($now, 0, 10);
            }
            if (!isset($row['receivable']) && isset($row['subtotal'])) {
                $row['receivable'] = $row['subtotal'];
            }
            if (!isset($row['profit']) && isset($row['receivable'], $row['purchase_cost']) && (float) $row['purchase_cost'] > 0) {
                $row['profit'] = round((float) $row['receivable'] - (float) $row['purchase_cost'], 2);
            }
        }
        if ($table === 'products') {
            if (!isset($row['stock_quantity']) && isset($row['quantity'])) {
                $row['stock_quantity'] = $row['quantity'];
            }
            if (!isset($row['quantity']) && isset($row['stock_quantity'])) {
                $row['quantity'] = $row['stock_quantity'];
            }
        }
        if ($table === 'users' && isset($colFlip['updated_at']) && empty($row['updated_at'])) {
            $row['updated_at'] = $now;
        }
        return $row;
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    private function parseValueTuples(string $valuesPart): array
    {
        $tuples = [];
        $len = strlen($valuesPart);
        $i = 0;

        while ($i < $len) {
            while ($i < $len && $valuesPart[$i] !== '(') {
                $i++;
            }
            if ($i >= $len) {
                break;
            }
            $i++; // skip '('

            $row = [];
            while ($i < $len) {
                while ($i < $len && ctype_space($valuesPart[$i])) {
                    $i++;
                }
                if ($i >= $len) {
                    break;
                }
                if ($valuesPart[$i] === ')') {
                    $i++;
                    break;
                }

                if ($valuesPart[$i] === "'") {
                    $i++;
                    $val = '';
                    while ($i < $len) {
                        $c = $valuesPart[$i];
                        if ($c === '\\' && $i + 1 < $len) {
                            $nx = $valuesPart[$i + 1];
                            $val .= match ($nx) {
                                'n' => "\n",
                                'r' => "\r",
                                't' => "\t",
                                '0' => "\0",
                                default => $nx,
                            };
                            $i += 2;
                            continue;
                        }
                        if ($c === "'" && $i + 1 < $len && $valuesPart[$i + 1] === "'") {
                            $val .= "'";
                            $i += 2;
                            continue;
                        }
                        if ($c === "'") {
                            $i++;
                            break;
                        }
                        $val .= $c;
                        $i++;
                    }
                    $row[] = $val;
                } else {
                    $token = '';
                    while ($i < $len && $valuesPart[$i] !== ',' && $valuesPart[$i] !== ')') {
                        $token .= $valuesPart[$i];
                        $i++;
                    }
                    $t = trim($token);
                    if (strcasecmp($t, 'NULL') === 0) {
                        $row[] = null;
                    } elseif (is_numeric($t)) {
                        $row[] = str_contains($t, '.') ? (float) $t : (int) $t;
                    } else {
                        $row[] = $t;
                    }
                }

                while ($i < $len && ctype_space($valuesPart[$i])) {
                    $i++;
                }
                if ($i < $len && $valuesPart[$i] === ',') {
                    $i++;
                } elseif ($i < $len && $valuesPart[$i] === ')') {
                    $i++;
                    break;
                }
            }

            if ($row !== []) {
                $tuples[] = $row;
            }
        }

        return $tuples;
    }

    private function normalizeImportedData(): void
    {
        $this->normalizeImportedMenus();

        // 1. Backfill products.warranty from warranties table or warranty_months
        if (Schema::hasTable('products')) {
            $warranties = Schema::hasTable('warranties')
                ? DB::table('warranties')->get()->keyBy('id')
                : collect();

            $products = DB::table('products')->get(['id', 'warranty', 'warranty_id', 'warranty_months']);
            foreach ($products as $p) {
                $w = trim((string) ($p->warranty ?? ''));
                if ($w === '' || strtolower($w) === 'null') {
                    $resolved = '';
                    if (!empty($p->warranty_id) && isset($warranties[$p->warranty_id])) {
                        $wr = $warranties[$p->warranty_id];
                        $resolved = trim((string) ($wr->duration ?: $wr->name ?: ''));
                    }
                    if ($resolved === '' && (int) ($p->warranty_months ?? 0) > 0) {
                        $resolved = ((int) $p->warranty_months) . ' Months';
                    }
                    if ($resolved !== '') {
                        DB::table('products')->where('id', $p->id)->update(['warranty' => $resolved]);
                    }
                }
            }
        }

        // 2. Backfill sale_items.product_name from products table
        if (Schema::hasTable('sale_items') && Schema::hasTable('products')) {
            $productNames = DB::table('products')->pluck('name', 'id');
            $items = DB::table('sale_items')->where(function ($q) {
                $q->whereNull('product_name')
                    ->orWhere('product_name', '')
                    ->orWhere('product_name', 'Product');
            })->get(['id', 'product_id']);
            foreach ($items as $it) {
                if (!empty($it->product_id) && isset($productNames[$it->product_id])) {
                    DB::table('sale_items')->where('id', $it->id)->update(['product_name' => $productNames[$it->product_id]]);
                }
            }
        }

        // 3. Backfill sales.date and sales.profit when 0 or empty
        if (Schema::hasTable('sales')) {
            $sales = DB::table('sales')->get();
            foreach ($sales as $s) {
                $updates = [];
                if (empty($s->date)) {
                    $src = (string) ($s->sale_date ?? $s->created_at ?? '');
                    if (strlen($src) >= 10) {
                        $updates['date'] = substr($src, 0, 10);
                    }
                }
                $receivable = (float) ($s->receivable ?? 0);
                $purchaseCost = (float) ($s->purchase_cost ?? 0);
                $profit = (float) ($s->profit ?? 0);

                if ($receivable == 0.0 && (float) ($s->subtotal ?? 0) > 0) {
                    $receivable = max(0, (float) $s->subtotal - (float) ($s->discount ?? 0));
                    $updates['receivable'] = round($receivable, 2);
                }

                if ($profit == 0.0 && Schema::hasTable('sale_items')) {
                    if ($purchaseCost > 0 && $receivable > 0) {
                        $updates['profit'] = round($receivable - $purchaseCost, 2);
                    } else {
                        $items = DB::table('sale_items')->where('sale_id', $s->id)->get();
                        if ($items->isNotEmpty()) {
                            $costSum = 0.0;
                            foreach ($items as $it) {
                                $qty = max(1, (int) ($it->quantity ?? 1));
                                $unitBuy = (float) ($it->buying_price ?: $it->purchase_cost ?: 0);
                                $costSum += $unitBuy * $qty;
                            }
                            if ($costSum > 0) {
                                $updates['purchase_cost'] = round($costSum, 2);
                                $updates['profit'] = round($receivable - $costSum, 2);
                            }
                        }
                    }
                }

                if ($updates !== []) {
                    DB::table('sales')->where('id', $s->id)->update($updates);
                }
            }
        }
    }

    private function normalizeImportedMenus(): void
    {
        if (!Schema::hasTable('menus')) {
            return;
        }
        $routeMap = [
            'dashboard' => 'dashboard',
            'owners' => 'owners.index',
            'accounts' => 'accounts.index',
            'cashbook' => 'cashbook.index',
            'pos' => 'pos.index',
            'sales' => 'sales.index',
            'products' => 'products.index',
            'returns' => 'returns.index',
            'estimates' => 'estimates.index',
            'purchases' => 'purchases.index',
            'stock' => 'stock.index',
            'damages' => 'damages.index',
            'add-product' => 'products.create',
            'categories' => 'categories.index',
            'brands' => 'brands.index',
            'units' => 'units.index',
            'expenses' => 'expenses.index',
            'payments' => 'payments.index',
            'customers' => 'customers.index',
            'suppliers' => 'suppliers.index',
            'employees' => 'employees.index',
            'reports' => 'reports.index',
            'settings' => 'settings.index',
            'users' => 'users.index',
            'backup' => 'backup.index',
        ];
        foreach ($routeMap as $key => $laravelRoute) {
            DB::table('menus')->where('route_name', $key)->update(['route_name' => $laravelRoute]);
        }
        DB::table('menus')->where('url', '/add-product')->update(['url' => '/products/create']);
        DB::table('menus')->where('url', '/dashboard')->update(['url' => '/']);

        DB::table('menus')
            ->whereIn('route_name', ['purchases.index', 'purchases'])
            ->update([
                'title' => 'Purchase',
                'group_label' => 'Main',
                'sort_order' => 7,
            ]);
        DB::table('menus')
            ->whereIn('route_name', ['products.index', 'products'])
            ->update([
                'title' => 'Product Manage',
                'group_label' => 'Product Management',
                'sort_order' => 8,
            ]);
        DB::table('menus')
            ->whereIn('route_name', ['products.create', 'add-product'])
            ->update([
                'title' => 'Add Product',
                'group_label' => 'Product Management',
                'sort_order' => 9,
            ]);
    }

    private function importFromJson(string $jsonPath): int
    {
        $decoded = json_decode((string) file_get_contents($jsonPath), true);
        if (!is_array($decoded)) {
            $this->error('Invalid JSON store snapshot.');
            return self::FAILURE;
        }

        Schema::disableForeignKeyConstraints();

        if ($this->option('fresh')) {
            foreach (array_reverse($this->allowedTables) as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }
        }

        $now = now()->format('Y-m-d H:i:s');
        $imported = 0;

        if (!empty($decoded['settings']) && is_array($decoded['settings']) && Schema::hasTable('settings')) {
            $rows = [];
            foreach ($decoded['settings'] as $key => $val) {
                $rows[] = ['key_name' => (string) $key, 'value' => (string) ($val ?? ''), 'updated_at' => $now];
            }
            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('settings')->insertOrIgnore($chunk);
            }
            $imported += count($rows);
        }

        if (!empty($decoded['menus']) && is_array($decoded['menus']) && Schema::hasTable('menus')) {
            $routeMap = [
                'dashboard' => 'dashboard',
                'owners' => 'owners.index',
                'accounts' => 'accounts.index',
                'cashbook' => 'cashbook.index',
                'pos' => 'pos.index',
                'sales' => 'sales.index',
                'products' => 'products.index',
                'returns' => 'returns.index',
                'estimates' => 'estimates.index',
                'purchases' => 'purchases.index',
                'stock' => 'stock.index',
                'damages' => 'damages.index',
                'add-product' => 'products.create',
                'categories' => 'categories.index',
                'brands' => 'brands.index',
                'units' => 'units.index',
                'expenses' => 'expenses.index',
                'payments' => 'payments.index',
                'customers' => 'customers.index',
                'suppliers' => 'suppliers.index',
                'employees' => 'employees.index',
                'reports' => 'reports.index',
                'settings' => 'settings.index',
                'users' => 'users.index',
                'backup' => 'backup.index',
            ];
            $rows = [];
            foreach ($decoded['menus'] as $m) {
                $rawRoute = (string) ($m['route_key'] ?? $m['route_name'] ?? '');
                $resolvedRoute = $routeMap[$rawRoute] ?? ($rawRoute !== '' ? $rawRoute : null);
                $rawUrl = $m['url'] ?? null;
                if ($rawUrl === '/add-product') {
                    $rawUrl = '/products/create';
                } elseif ($rawUrl === '/dashboard') {
                    $rawUrl = '/';
                }
                $rows[] = [
                    'id' => (int) ($m['id'] ?? 0),
                    'parent_id' => $m['parent_id'] ?? null,
                    'title' => (string) ($m['title'] ?? ''),
                    'group_label' => $m['group_label'] ?? null,
                    'route_name' => $resolvedRoute,
                    'url' => $rawUrl,
                    'icon' => (string) ($m['icon'] ?? 'circle'),
                    'sort_order' => (int) ($m['sort_order'] ?? 0),
                    'roles' => json_encode($m['roles'] ?? []),
                    'is_active' => !empty($m['is_active']) ? 1 : 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('menus')->insertOrIgnore($chunk);
            }
            $imported += count($rows);
        }

        if (!empty($decoded['users']) && is_array($decoded['users']) && Schema::hasTable('users')) {
            $rows = [];
            foreach ($decoded['users'] as $u) {
                $rows[] = [
                    'id' => (int) ($u['id'] ?? 0),
                    'name' => (string) ($u['name'] ?? 'Admin'),
                    'email' => (string) ($u['email'] ?? ''),
                    'password' => (string) ($u['password_hash'] ?? $u['password'] ?? ''),
                    'role' => in_array($u['role'] ?? '', ['super_admin', 'admin', 'manager', 'staff'], true) ? $u['role'] : 'staff',
                    'phone' => $u['phone'] ?? null,
                    'address' => $u['address'] ?? null,
                    'profile_image' => $u['profile_image'] ?? null,
                    'image' => $u['profile_image'] ?? ($u['image'] ?? null),
                    'is_active' => !empty($u['is_active']) ? 1 : 0,
                    'created_at' => $u['created_at'] ?? $now,
                    'updated_at' => $now,
                ];
            }
            DB::table('users')->insertOrIgnore($rows);
            $imported += count($rows);
        }

        $directTables = [
            'categories',
            'brands',
            'units',
            'warranties',
            'products',
            'stock_movements',
            'customers',
            'suppliers',
            'employees',
            'owners',
            'owner_transactions',
            'bank_accounts',
            'bank_transactions',
            'cash_transactions',
            'expense_categories',
            'expenses',
            'sales',
            'sale_items',
            'payments',
            'purchases',
            'purchase_items',
            'supplier_payments',
            'estimates',
            'estimate_items',
            'returns',
            'damages',
        ];

        foreach ($directTables as $table) {
            $list = $decoded[$table] ?? [];
            if (empty($list) || !is_array($list) || !Schema::hasTable($table)) {
                continue;
            }
            $columns = Schema::getColumnListing($table);
            $colFlip = array_flip($columns);
            $rows = [];
            foreach ($list as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $filtered = array_intersect_key($item, $colFlip);
                $filtered = $this->normalizeRowFields($table, $filtered, $colFlip);
                if (!empty($filtered)) {
                    $rows[] = $filtered;
                }
            }
            foreach (array_chunk($rows, 150) as $chunk) {
                DB::table($table)->insertOrIgnore($chunk);
            }
            $imported += count($rows);
        }

        Schema::enableForeignKeyConstraints();
        $this->normalizeImportedData();
        $this->info("Imported {$imported} records cleanly from JSON store.");

        return self::SUCCESS;
    }
}
