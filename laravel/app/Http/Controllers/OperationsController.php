<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Brand;
use App\Models\CashTransaction;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Damage;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Owner;
use App\Models\OwnerTransaction;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Unit;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OperationsController extends Controller
{
    private function ensureOwnerColumns(): void
    {
        try {
            if (!Schema::hasTable('owners')) {
                return;
            }
            $needInvested = !Schema::hasColumn('owners', 'invested');
            $needWithdrawn = !Schema::hasColumn('owners', 'withdrawn');
            if ($needInvested || $needWithdrawn) {
                Schema::table('owners', function (Blueprint $table) use ($needInvested, $needWithdrawn) {
                    if ($needInvested) {
                        $table->decimal('invested', 15, 2)->default(0.00);
                    }
                    if ($needWithdrawn) {
                        $table->decimal('withdrawn', 15, 2)->default(0.00);
                    }
                });
            }
            if (!Schema::hasTable('owner_transactions')) {
                Schema::create('owner_transactions', function (Blueprint $table) {
                    $table->id();
                    $table->foreignId('owner_id')->constrained('owners')->cascadeOnDelete();
                    $table->string('type', 20)->default('invest');
                    $table->decimal('amount', 15, 2)->default(0.00);
                    $table->text('note')->nullable();
                    $table->date('transaction_date')->nullable();
                    $table->unsignedBigInteger('created_by')->nullable();
                    $table->timestamps();
                });
            }
        } catch (\Throwable) {
            // Safe fallback if schema alterations are restricted
        }
    }

    public function owners(): View
    {
        $this->ensureOwnerColumns();
        $owners = Owner::query()
            ->with(['transactions' => fn ($q) => $q->orderByDesc('transaction_date')->orderByDesc('id')])
            ->orderBy('id')
            ->get();
        $totalShare = (float) $owners->where('is_active', true)->sum('share_percent');
        $totalInvested = (float) $owners->sum(fn ($o) => (float) ($o->invested ?? 0));
        $totalWithdrawn = (float) $owners->sum(fn ($o) => (float) ($o->withdrawn ?? 0));
        $netBalance = round($totalInvested - $totalWithdrawn, 2);
        $activeCount = (int) $owners->where('is_active', true)->count();

        return view('operations.owners', compact(
            'owners',
            'totalShare',
            'totalInvested',
            'totalWithdrawn',
            'netBalance',
            'activeCount'
        ));
    }

    public function ownerHistory(Owner $owner): JsonResponse
    {
        $this->ensureOwnerColumns();
        $transactions = OwnerTransaction::query()
            ->where('owner_id', $owner->id)
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'note' => $t->note ?: ($t->type === 'invest' ? 'Capital Investment' : 'Capital Withdrawal'),
                'transaction_date' => $t->transaction_date?->format('Y-m-d') ?? $t->created_at?->format('Y-m-d') ?? date('Y-m-d'),
            ]);

        return response()->json([
            'owner' => [
                'id' => $owner->id,
                'name' => $owner->name,
                'invested' => (float) ($owner->invested ?? 0),
                'withdrawn' => (float) ($owner->withdrawn ?? 0),
                'balance' => round((float) ($owner->invested ?? 0) - (float) ($owner->withdrawn ?? 0), 2),
            ],
            'transactions' => $transactions,
        ]);
    }

    public function storeOwner(Request $request): RedirectResponse
    {
        $this->ensureOwnerColumns();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'invested' => ['nullable', 'numeric', 'min:0'],
            'withdrawn' => ['nullable', 'numeric', 'min:0'],
        ]);

        $invested = round((float) ($data['invested'] ?? 0), 2);
        $withdrawn = round((float) ($data['withdrawn'] ?? 0), 2);

        DB::transaction(function () use ($data, $invested, $withdrawn) {
            $owner = Owner::query()->create([
                'name' => $data['name'],
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? null,
                'share_percent' => (float) ($data['share_percent'] ?? 0),
                'invested' => $invested,
                'withdrawn' => $withdrawn,
                'is_active' => true,
            ]);

            if ($invested > 0) {
                OwnerTransaction::query()->create([
                    'owner_id' => $owner->id,
                    'type' => 'invest',
                    'amount' => $invested,
                    'note' => 'Opening Investment',
                    'transaction_date' => now()->toDateString(),
                    'created_by' => Auth::id(),
                ]);
            }
            if ($withdrawn > 0) {
                OwnerTransaction::query()->create([
                    'owner_id' => $owner->id,
                    'type' => 'withdraw',
                    'amount' => $withdrawn,
                    'note' => 'Opening Withdrawal',
                    'transaction_date' => now()->toDateString(),
                    'created_by' => Auth::id(),
                ]);
            }
        });

        return back()->with('success', 'Owner added successfully.');
    }

    public function updateOwner(Request $request, Owner $owner): RedirectResponse
    {
        $this->ensureOwnerColumns();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'invested' => ['nullable', 'numeric', 'min:0'],
            'withdrawn' => ['nullable', 'numeric', 'min:0'],
        ]);

        $owner->update([
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'address' => $data['address'] ?? null,
            'share_percent' => (float) ($data['share_percent'] ?? $owner->share_percent ?? 0),
            'invested' => (float) ($data['invested'] ?? $owner->invested ?? 0),
            'withdrawn' => (float) ($data['withdrawn'] ?? $owner->withdrawn ?? 0),
        ]);

        return back()->with('success', 'Owner updated successfully.');
    }

    public function ownerTransaction(Request $request, Owner $owner): RedirectResponse
    {
        $this->ensureOwnerColumns();
        $data = $request->validate([
            'type' => ['required', 'in:invest,withdraw'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'transaction_date' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $amount = round((float) $data['amount'], 2);
        $txDate = !empty($data['transaction_date']) ? $data['transaction_date'] : now()->toDateString();
        $note = trim((string) ($data['note'] ?? '')) ?: ($data['type'] === 'invest' ? 'Capital Investment' : 'Capital Withdrawal');

        DB::transaction(function () use ($owner, $data, $amount, $txDate, $note) {
            $locked = Owner::query()->lockForUpdate()->findOrFail($owner->id);
            if ($data['type'] === 'invest') {
                $locked->invested = round((float) ($locked->invested ?? 0) + $amount, 2);
            } else {
                $locked->withdrawn = round((float) ($locked->withdrawn ?? 0) + $amount, 2);
            }
            $locked->save();

            OwnerTransaction::query()->create([
                'owner_id' => $locked->id,
                'type' => $data['type'],
                'amount' => $amount,
                'note' => $note,
                'transaction_date' => $txDate,
                'created_by' => Auth::id(),
            ]);
        });

        $label = $data['type'] === 'invest' ? 'Investment added for ' : 'Withdrawal recorded for ';
        return back()->with('success', $label . $owner->name . '.');
    }

    public function toggleOwner(Owner $owner): RedirectResponse
    {
        $owner->update(['is_active' => !$owner->is_active]);

        return back()->with('success', 'Owner status updated.');
    }

    public function destroyOwner(Owner $owner): RedirectResponse
    {
        $owner->delete();

        return back()->with('success', 'Owner deleted.');
    }

    public function cashbook(): View
    {
        $transactions = CashTransaction::query()
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->limit(150)
            ->get();

        $totalIn = (float) CashTransaction::query()->where('type', 'in')->sum('amount');
        $totalOut = (float) CashTransaction::query()->where('type', 'out')->sum('amount');
        $balance = $totalIn - $totalOut;

        return view('operations.cashbook', compact('transactions', 'totalIn', 'totalOut', 'balance'));
    }

    public function storeCashbook(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:in,out'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string', 'max:255'],
            'transaction_date' => ['nullable', 'date'],
        ]);

        if ($data['type'] === 'out') {
            $totalIn = (float) CashTransaction::query()->where('type', 'in')->sum('amount');
            $totalOut = (float) CashTransaction::query()->where('type', 'out')->sum('amount');
            $balance = $totalIn - $totalOut;
            if ((float) $data['amount'] > $balance) {
                return back()->withErrors(['amount' => 'Cash out amount exceeds available Cash Book balance.']);
            }
        }

        CashTransaction::query()->create([
            'type' => $data['type'],
            'amount' => (float) $data['amount'],
            'description' => $data['description'] ?? ($data['type'] === 'in' ? 'Cash Deposit' : 'Cash Withdrawal'),
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'created_by' => Auth::id(),
        ]);

        return back()->with('success', 'Cash Book entry recorded.');
    }

    public function stock(Request $request): View
    {
        $search = trim((string) $request->query('q', ''));
        $filter = trim((string) $request->query('filter', 'all'));

        $query = Product::query()->with(['category', 'brand', 'unit'])->orderBy('name');
        $tokens = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($tokens) > 0) {
            foreach ($tokens as $tok) {
                $term = "%{$tok}%";
                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', $term)
                      ->orWhere('sku', 'like', $term)
                      ->orWhere('barcode', 'like', $term)
                      ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $term))
                      ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', $term));
                });
            }
        }
        if ($filter === 'low') {
            $query->whereColumn('stock_quantity', '<=', 'alert_quantity')->where('stock_quantity', '>', 0);
        } elseif ($filter === 'out') {
            $query->where('stock_quantity', '<=', 0);
        }

        $products = $query->get();
        $movements = StockMovement::query()->with('product')->orderByDesc('id')->limit(60)->get();

        return view('operations.stock', compact('products', 'movements', 'search', 'filter'));
    }

    public function damages(): View
    {
        $damages = Damage::query()->with('product')->orderByDesc('id')->limit(60)->get();
        $products = Product::query()->orderBy('name')->get();

        return view('operations.damages', compact('damages', 'products'));
    }

    public function units(): View
    {
        $units = Unit::query()->withCount('products')->orderBy('name')->get();

        return view('operations.units', compact('units'));
    }

    public function destroyUnit(Unit $unit): RedirectResponse
    {
        $unit->delete();

        return back()->with('success', 'Unit deleted.');
    }

    public function payments(): View
    {
        $customerPayments = Payment::query()
            ->with(['sale', 'customer'])
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->limit(60)
            ->get();

        $supplierPayments = SupplierPayment::query()
            ->with(['purchase', 'supplier'])
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->limit(60)
            ->get();

        $dueSales = Sale::query()->where('due', '>', 0)->orderByDesc('id')->limit(50)->get();
        $duePurchases = Purchase::query()->with('supplier')->where('due', '>', 0)->orderByDesc('id')->limit(50)->get();

        return view('operations.payments', compact('customerPayments', 'supplierPayments', 'dueSales', 'duePurchases'));
    }

    public function employees(): View
    {
        $employees = Employee::query()->orderBy('name')->get();
        $salaryExpenses = Expense::query()
            ->where('category', 'Salary')
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        return view('operations.employees', compact('employees', 'salaryExpenses'));
    }

    public function storeEmployee(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'designation' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'salary' => ['required', 'numeric', 'min:0'],
            'joining_date' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $nextNum = Employee::query()->count() + 1;
        Employee::query()->create([
            'employee_id' => 'EMP-' . str_pad((string) $nextNum, 3, '0', STR_PAD_LEFT),
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'designation' => $data['designation'] ?? 'Staff',
            'department' => $data['department'] ?? 'Operations',
            'salary' => (float) $data['salary'],
            'joining_date' => $data['joining_date'] ?? now()->toDateString(),
            'address' => $data['address'] ?? null,
            'status' => true,
        ]);

        return back()->with('success', 'Employee added.');
    }

    public function paySalary(Request $request, Employee $employee): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'month' => ['nullable', 'string', 'max:40'],
        ]);

        $month = $data['month'] ?: now()->format('F Y');
        Expense::query()->create([
            'category' => 'Salary',
            'description' => "Salary Payment: {$employee->name} ({$month})",
            'amount' => (float) $data['amount'],
            'expense_date' => now()->toDateString(),
            'created_by' => Auth::id(),
        ]);

        return back()->with('success', "Salary paid for {$employee->name}.");
    }

    public function toggleEmployee(Employee $employee): RedirectResponse
    {
        $employee->update(['status' => !$employee->status]);

        return back()->with('success', 'Employee status updated.');
    }

    public function destroyEmployee(Employee $employee): RedirectResponse
    {
        $employee->delete();

        return back()->with('success', 'Employee removed.');
    }

    public function backup(): View
    {
        $stats = [
            'products' => Product::query()->count(),
            'sales' => Sale::query()->count(),
            'purchases' => Purchase::query()->count(),
            'customers' => Customer::query()->count(),
            'suppliers' => Supplier::query()->count(),
            'expenses' => Expense::query()->count(),
            'accounts' => BankAccount::query()->count(),
            'owners' => Owner::query()->count(),
            'employees' => Employee::query()->count(),
        ];

        return view('operations.backup', compact('stats'));
    }

    public function downloadBackup(): StreamedResponse
    {
        $tables = [
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
            'menus',
        ];

        $payload = [
            'exported_at' => now()->toIso8601String(),
            'settings' => Setting::allKeyed(),
        ];

        foreach ($tables as $tbl) {
            if (Schema::hasTable($tbl)) {
                $payload[$tbl] = DB::table($tbl)->get()->map(fn ($r) => (array) $r)->all();
            } else {
                $payload[$tbl] = [];
            }
        }

        $filename = 'youthit_pos_backup_' . now()->format('Ymd_His') . '.json';

        return response()->streamDownload(function () use ($payload) {
            echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, ['Content-Type' => 'application/json']);
    }

    public function downloadSql(): StreamedResponse
    {
        $tables = [
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

        $filename = 'youthit-pos-database-' . now()->format('Y-m-d') . '.sql';

        return response()->streamDownload(function () use ($tables) {
            echo "-- Youth IT POS Database Backup\n";
            echo '-- Generated: ' . now()->toIso8601String() . "\n";
            echo "SET FOREIGN_KEY_CHECKS=0;\n\n";

            $esc = static function ($val): string {
                if ($val === null) {
                    return 'NULL';
                }
                if (is_bool($val)) {
                    return $val ? '1' : '0';
                }
                if (is_int($val) || is_float($val)) {
                    return (string) $val;
                }
                $s = (string) $val;
                $s = str_replace(
                    ['\\', "\0", "\n", "\r", "'", '"', "\x1a"],
                    ['\\\\', '\\0', '\\n', '\\r', "\\'", '\\"', '\\Z'],
                    $s
                );
                return "'" . $s . "'";
            };

            foreach ($tables as $tbl) {
                if (!Schema::hasTable($tbl)) {
                    continue;
                }
                $rows = DB::table($tbl)->get();
                echo "-- Table: {$tbl}\n";
                echo "TRUNCATE TABLE `{$tbl}`;\n";
                if ($rows->isEmpty()) {
                    echo "\n";
                    continue;
                }

                $firstArr = (array) $rows->first();
                $cols = array_keys($firstArr);
                $colSql = implode(', ', array_map(fn ($c) => "`{$c}`", $cols));

                foreach ($rows->chunk(100) as $chunk) {
                    $tuples = [];
                    foreach ($chunk as $rowObj) {
                        $arr = (array) $rowObj;
                        $vals = [];
                        foreach ($cols as $c) {
                            $vals[] = $esc($arr[$c] ?? null);
                        }
                        $tuples[] = '(' . implode(', ', $vals) . ')';
                    }
                    echo "INSERT INTO `{$tbl}` ({$colSql}) VALUES\n" . implode(",\n", $tuples) . ";\n";
                }
                echo "\n";
            }

            echo "SET FOREIGN_KEY_CHECKS=1;\n";
        }, $filename, ['Content-Type' => 'application/sql; charset=utf-8']);
    }

    public function restoreBackup(Request $request): RedirectResponse
    {
        $request->validate([
            'backup_file' => ['required', 'file', 'mimes:json,txt', 'max:20480'],
        ]);

        $raw = file_get_contents($request->file('backup_file')->getRealPath());
        $decoded = json_decode((string) $raw, true);

        if (!is_array($decoded) || (!isset($decoded['settings']) && !isset($decoded['products']) && !isset($decoded['sales']))) {
            return back()->withErrors(['backup_file' => 'Invalid POS JSON backup format.']);
        }

        $tmpPath = storage_path('app/tmp_restore_' . uniqid() . '.json');
        file_put_contents($tmpPath, (string) $raw);

        try {
            \Illuminate\Support\Facades\Artisan::call('pos:import', [
                '--path' => $tmpPath,
                '--fresh' => true,
            ]);
        } finally {
            @unlink($tmpPath);
        }

        $prodCount = is_array($decoded['products'] ?? null) ? count($decoded['products']) : Product::query()->count();
        $saleCount = is_array($decoded['sales'] ?? null) ? count($decoded['sales']) : Sale::query()->count();

        return back()->with('success', "Backup restored successfully! ({$prodCount} products, {$saleCount} sales loaded)");
    }

    public function importSql(Request $request): RedirectResponse
    {
        $request->validate([
            'sql_file' => ['required', 'file', 'max:51200'],
        ]);

        $file = $request->file('sql_file');
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['sql', 'txt'], true)) {
            return back()->withErrors(['sql_file' => 'Please upload a valid .sql database dump file.']);
        }

        $tmpPath = storage_path('app/tmp_import_' . uniqid() . '.sql');
        file_put_contents($tmpPath, (string) file_get_contents($file->getRealPath()));

        try {
            \Illuminate\Support\Facades\Artisan::call('pos:import', [
                '--path' => $tmpPath,
                '--fresh' => true,
            ]);
        } finally {
            @unlink($tmpPath);
        }

        return back()->with(
            'success',
            'MySQL database imported successfully! (' . Product::query()->count() . ' products, ' . Customer::query()->count() . ' customers, ' . Sale::query()->count() . ' sales)'
        );
    }
}
