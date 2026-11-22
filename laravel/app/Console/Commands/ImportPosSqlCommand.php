<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ImportPosSqlCommand extends Command
{
    protected $signature = 'pos:import {--path= : Path to SQL dump} {--fresh : Truncate tables before importing}';
    protected $description = 'Import Youth IT POS data cleanly from the MySQL dump into Laravel tables';

    private array $allowedTables = [
        'users',
        'settings',
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
        $path = $this->option('path') ?: database_path('sql/youthits_pos.sql');
        if (!file_exists($path)) {
            $this->error("SQL file not found at: {$path}");
            return self::FAILURE;
        }

        $sql = file_get_contents($path);
        if ($sql === false) {
            $this->error('Unable to read SQL file.');
            return self::FAILURE;
        }

        Schema::disableForeignKeyConstraints();

        if ($this->option('fresh')) {
            foreach (array_reverse($this->allowedTables) as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                }
            }
        }

        $count = 0;
        preg_match_all('/^INSERT INTO `([a-zA-Z0-9_]+)` .*?;\s*$/ms', $sql, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $table = $match[1];
            if (!in_array($table, $this->allowedTables, true) || !Schema::hasTable($table)) {
                continue;
            }
            $statement = str_replace('INSERT INTO ', 'INSERT IGNORE INTO ', $match[0]);
            DB::unprepared($statement);
            $count++;
        }

        Schema::enableForeignKeyConstraints();
        $this->info("Imported {$count} SQL data blocks into Youth IT POS tables.");

        return self::SUCCESS;
    }
}
