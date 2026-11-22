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
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OperationsController extends Controller
{
    public function owners(): View
    {
        $owners = Owner::query()->orderBy('id')->get();
        $totalShare = (float) $owners->where('is_active', true)->sum('share_percent');

        return view('operations.owners', compact('owners', 'totalShare'));
    }

    public function storeOwner(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'share_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        Owner::query()->create($data + ['is_active' => true]);

        return back()->with('success', 'Owner added successfully.');
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
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }
        if ($filter === 'low') {
            $query->whereColumn('quantity', '<=', 'alert_quantity')->where('quantity', '>', 0);
        } elseif ($filter === 'out') {
            $query->where('quantity', '<=', 0);
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
        $payload = [
            'exported_at' => now()->toIso8601String(),
            'settings' => Setting::allKeyed(),
            'categories' => Category::all()->toArray(),
            'brands' => Brand::all()->toArray(),
            'units' => Unit::all()->toArray(),
            'products' => Product::all()->toArray(),
            'customers' => Customer::all()->toArray(),
            'suppliers' => Supplier::all()->toArray(),
            'sales' => Sale::with('items')->get()->toArray(),
            'purchases' => Purchase::with('items')->get()->toArray(),
            'expenses' => Expense::all()->toArray(),
            'bank_accounts' => BankAccount::all()->toArray(),
            'cash_transactions' => CashTransaction::all()->toArray(),
            'owners' => Owner::all()->toArray(),
            'employees' => Employee::all()->toArray(),
        ];

        $filename = 'youthit_pos_backup_' . now()->format('Ymd_His') . '.json';

        return response()->streamDownload(function () use ($payload) {
            echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, ['Content-Type' => 'application/json']);
    }

    public function restoreBackup(Request $request): RedirectResponse
    {
        $request->validate([
            'backup_file' => ['required', 'file', 'mimes:json,txt', 'max:10240'],
        ]);

        $raw = file_get_contents($request->file('backup_file')->getRealPath());
        $decoded = json_decode((string) $raw, true);

        if (!is_array($decoded) || !isset($decoded['settings'])) {
            return back()->withErrors(['backup_file' => 'Invalid POS JSON backup format.']);
        }

        DB::transaction(function () use ($decoded) {
            foreach ($decoded['settings'] as $key => $value) {
                Setting::setValue((string) $key, (string) $value);
            }
        });

        return back()->with('success', 'Settings restored cleanly from JSON backup.');
    }
}
