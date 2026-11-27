<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\CashTransaction;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Damage;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ReportController extends Controller
{
    public function index(Request $request): View
    {
        $from = substr($request->string('from')->toString() ?: now()->startOfYear()->toDateString(), 0, 10);
        $to = substr($request->string('to')->toString() ?: now()->toDateString(), 0, 10);
        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        $activeReport = $request->string('report')->toString() ?: 'profit_loss';
        $validReports = [
            'customer_due',
            'supplier_due',
            'purchase',
            'profit_loss',
            'today',
            'current_month',
            'summary',
            'daily',
            'low_stock',
            'top_customer',
            'top_product',
            'top_product_all',
            'category_wise',
        ];
        if (!in_array($activeReport, $validReports, true)) {
            $activeReport = 'profit_loss';
        }

        $todayStr = now()->toDateString();
        $monthPrefix = substr($todayStr, 0, 7);

        $products = Product::query()->with('category')->get();
        $productMap = $products->keyBy('id');
        $categoryMap = Category::query()->pluck('name', 'id');
        $customers = Customer::query()->get();
        $customerMap = $customers->keyBy('id');
        $suppliers = Supplier::query()->get();
        $supplierMap = $suppliers->keyBy('id');

        $completedSales = Sale::query()
            ->where(function ($q) {
                $q->where('status', 'completed')->orWhereNull('status');
            })
            ->orderByDesc('id')
            ->get();

        $dateOf = static function ($val, string $fallback = ''): string {
            if ($val instanceof \DateTimeInterface) {
                return $val->format('Y-m-d');
            }
            $str = trim((string) ($val ?: $fallback));
            return $str !== '' ? substr($str, 0, 10) : '';
        };

        $periodSales = $completedSales->filter(function ($s) use ($from, $to, $dateOf) {
            $d = $dateOf($s->date ?? $s->sale_date, (string) $s->created_at);
            return $d >= $from && $d <= $to;
        })->values();

        $calcProfit = static function ($s): float {
            $p = (float) ($s->profit ?? 0);
            $cost = (float) ($s->purchase_cost ?? 0);
            if (abs($p) < 0.001 && $cost > 0) {
                return (float) ($s->receivable ?? 0) - $cost;
            }
            return $p;
        };

        $summary = [
            'invoiceCount' => $periodSales->count(),
            'revenue' => (float) $periodSales->sum(fn ($s) => (float) ($s->receivable ?? 0)),
            'collected' => (float) $periodSales->sum(fn ($s) => (float) ($s->paid ?? 0)),
            'due' => (float) $periodSales->sum(fn ($s) => (float) ($s->due ?? 0)),
            'profit' => (float) $periodSales->sum($calcProfit),
            'purchaseCost' => (float) $periodSales->sum(fn ($s) => (float) ($s->purchase_cost ?? 0)),
            'discount' => (float) $periodSales->sum(fn ($s) => (float) ($s->discount ?? 0)),
        ];

        $allExpenses = Expense::query()->get();
        $periodExpenses = $allExpenses->filter(function ($e) use ($from, $to, $dateOf) {
            $d = $dateOf($e->expense_date, (string) $e->created_at);
            return $d >= $from && $d <= $to;
        });
        $expensesTotal = (float) $periodExpenses->sum(fn ($e) => (float) ($e->amount ?? 0));

        $damagesTotal = (float) Damage::query()->get()->filter(function ($d) use ($from, $to, $dateOf) {
            $dt = $dateOf($d->damage_date, (string) $d->created_at);
            return $dt >= $from && $dt <= $to;
        })->sum(fn ($d) => (float) ($d->loss_amount ?? 0));

        $returnsTotal = (float) SaleReturn::query()->get()->filter(function ($r) use ($from, $to, $dateOf) {
            $dt = $dateOf($r->return_date, (string) $r->created_at);
            return $dt >= $from && $dt <= $to;
        })->sum(fn ($r) => (float) ($r->total_amount ?? 0));

        $netProfit = $summary['profit'] - $expensesTotal - $damagesTotal;

        $expenseBreakdown = $periodExpenses
            ->groupBy(fn ($e) => trim((string) ($e->category ?: 'Other')))
            ->map(fn ($group, $cat) => [
                'category' => $cat,
                'amount' => (float) $group->sum(fn ($e) => (float) ($e->amount ?? 0)),
            ])
            ->sortByDesc('amount')
            ->values();

        // 1. Customer Due Report
        $custMap = [];
        foreach ($customers as $c) {
            $open = (float) ($c->opening_balance ?? 0);
            $custMap[(int) $c->id] = [
                'id' => (int) $c->id,
                'name' => (string) $c->name,
                'phone' => (string) ($c->phone ?? ''),
                'invoices' => 0,
                'total_billed' => $open,
                'paid' => 0.0,
                'due' => $open,
            ];
        }
        foreach ($completedSales as $s) {
            $cid = (int) ($s->customer_id ?? 0);
            if ($cid > 0 && isset($custMap[$cid])) {
                $custMap[$cid]['invoices']++;
                $custMap[$cid]['total_billed'] += (float) ($s->receivable ?? 0);
                $custMap[$cid]['paid'] += (float) ($s->paid ?? 0);
                $custMap[$cid]['due'] += (float) ($s->due ?? 0);
            }
        }
        $customerDues = collect($custMap)
            ->filter(fn ($c) => $c['due'] > 0.009)
            ->sortByDesc('due')
            ->take(100)
            ->values();

        // 2. Supplier Due Report
        $allPurchases = Purchase::query()->orderByDesc('id')->get();
        $supMap = [];
        foreach ($suppliers as $sup) {
            $open = (float) ($sup->opening_balance ?? 0);
            $supMap[(int) $sup->id] = [
                'id' => (int) $sup->id,
                'name' => (string) $sup->name,
                'phone' => (string) ($sup->phone ?? ''),
                'purchases' => 0,
                'total_billed' => $open,
                'paid' => 0.0,
                'due' => $open,
            ];
        }
        foreach ($allPurchases as $p) {
            $sid = (int) ($p->supplier_id ?? 0);
            if ($sid > 0 && isset($supMap[$sid])) {
                $supMap[$sid]['purchases']++;
                $supMap[$sid]['total_billed'] += (float) ($p->total ?? $p->total_amount ?? 0);
                $supMap[$sid]['paid'] += (float) ($p->paid ?? $p->paid_amount ?? 0);
                $supMap[$sid]['due'] += (float) ($p->due ?? $p->due_amount ?? 0);
            }
        }
        $supplierDues = collect($supMap)
            ->filter(fn ($s) => $s['due'] > 0.009)
            ->sortByDesc('due')
            ->take(100)
            ->values();

        // 3. Purchase Report
        $purchaseReport = $allPurchases
            ->filter(function ($p) use ($from, $to, $dateOf) {
                $d = $dateOf($p->purchase_date, (string) $p->created_at);
                return $d >= $from && $d <= $to;
            })
            ->map(function ($p) use ($supplierMap, $dateOf) {
                $sup = $p->supplier_id ? $supplierMap->get((int) $p->supplier_id) : null;
                return [
                    'id' => (int) $p->id,
                    'invoice_no' => (string) ($p->invoice_no ?: 'PUR-' . $p->id),
                    'date' => $dateOf($p->purchase_date, (string) $p->created_at),
                    'supplier_name' => (string) ($sup?->name ?: 'General Supplier'),
                    'total' => (float) ($p->total ?? $p->total_amount ?? 0),
                    'paid' => (float) ($p->paid ?? $p->paid_amount ?? 0),
                    'due' => (float) ($p->due ?? $p->due_amount ?? 0),
                ];
            })
            ->values();
        $purchaseSummary = [
            'count' => $purchaseReport->count(),
            'total' => (float) $purchaseReport->sum('total'),
            'paid' => (float) $purchaseReport->sum('paid'),
            'due' => (float) $purchaseReport->sum('due'),
        ];

        // 5. Today Report
        $todaySales = $completedSales->filter(fn ($s) => $dateOf($s->date ?? $s->sale_date, (string) $s->created_at) === $todayStr)->values();
        $todayExpensesTotal = (float) $allExpenses->filter(fn ($e) => $dateOf($e->expense_date, (string) $e->created_at) === $todayStr)->sum('amount');
        $todayPurchasesTotal = (float) $allPurchases->filter(fn ($p) => $dateOf($p->purchase_date, (string) $p->created_at) === $todayStr)->sum(fn ($p) => (float) ($p->total ?? $p->total_amount ?? 0));
        $todayPaymentsTotal = (float) Payment::query()->get()->filter(fn ($p) => $dateOf($p->payment_date, (string) $p->created_at) === $todayStr)->sum('amount');

        $todayReport = [
            'date' => $todayStr,
            'sales_count' => $todaySales->count(),
            'revenue' => (float) $todaySales->sum('receivable'),
            'collected' => (float) $todaySales->sum('paid'),
            'due' => (float) $todaySales->sum('due'),
            'profit' => (float) $todaySales->sum($calcProfit),
            'expenses' => $todayExpensesTotal,
            'purchases' => $todayPurchasesTotal,
            'payments_received' => $todayPaymentsTotal,
            'invoices' => $todaySales->take(50)->map(fn ($s) => [
                'id' => (int) $s->id,
                'invoice_no' => (string) $s->invoice_no,
                'customer_name' => (string) ($s->customer_name ?: 'Walk-in Customer'),
                'receivable' => (float) ($s->receivable ?? 0),
                'paid' => (float) ($s->paid ?? 0),
                'due' => (float) ($s->due ?? 0),
                'profit' => $calcProfit($s),
            ])->values(),
        ];

        // 6. Current Month Report
        $monthSales = $completedSales->filter(fn ($s) => substr($dateOf($s->date ?? $s->sale_date, (string) $s->created_at), 0, 7) === $monthPrefix)->values();
        $monthExpenses = (float) $allExpenses->filter(fn ($e) => substr($dateOf($e->expense_date, (string) $e->created_at), 0, 7) === $monthPrefix)->sum('amount');
        $monthPurchases = (float) $allPurchases->filter(fn ($p) => substr($dateOf($p->purchase_date, (string) $p->created_at), 0, 7) === $monthPrefix)->sum(fn ($p) => (float) ($p->total ?? $p->total_amount ?? 0));

        $monthDailyRows = $monthSales
            ->groupBy(fn ($s) => $dateOf($s->date ?? $s->sale_date, (string) $s->created_at))
            ->map(fn ($rows, $dt) => [
                'date' => $dt,
                'invoices' => $rows->count(),
                'revenue' => (float) $rows->sum('receivable'),
                'collected' => (float) $rows->sum('paid'),
                'due' => (float) $rows->sum('due'),
                'profit' => (float) $rows->sum($calcProfit),
            ])
            ->sortByDesc('date')
            ->values();

        $currentMonthReport = [
            'month' => $monthPrefix,
            'sales_count' => $monthSales->count(),
            'revenue' => (float) $monthSales->sum('receivable'),
            'collected' => (float) $monthSales->sum('paid'),
            'due' => (float) $monthSales->sum('due'),
            'profit' => (float) $monthSales->sum($calcProfit),
            'expenses' => $monthExpenses,
            'purchases' => $monthPurchases,
            'daily_rows' => $monthDailyRows,
        ];

        // 7. Summary Report
        $bankBalance = (float) BankAccount::query()->sum('balance');
        $cashIn = (float) CashTransaction::query()->where('type', 'in')->sum('amount');
        $cashOut = (float) CashTransaction::query()->where('type', 'out')->sum('amount');
        $activeProds = $products->filter(fn ($p) => (bool) ($p->status ?? true));
        $stockCostValue = (float) $activeProds->sum(fn ($p) => max(0, (int) ($p->stock_quantity ?? $p->quantity ?? 0)) * (float) ($p->purchase_price ?? 0));
        $stockRetailValue = (float) $activeProds->sum(fn ($p) => max(0, (int) ($p->stock_quantity ?? $p->quantity ?? 0)) * (float) ($p->selling_price ?? 0));

        $summaryReport = [
            'total_revenue' => (float) $completedSales->sum('receivable'),
            'total_profit' => (float) $completedSales->sum($calcProfit),
            'total_purchases' => (float) $allPurchases->sum(fn ($p) => (float) ($p->total ?? $p->total_amount ?? 0)),
            'total_expenses' => (float) $allExpenses->sum('amount'),
            'customer_due_total' => (float) $customerDues->sum('due'),
            'supplier_due_total' => (float) $supplierDues->sum('due'),
            'bank_balance' => $bankBalance,
            'cash_balance' => $cashIn - $cashOut,
            'stock_cost_value' => $stockCostValue,
            'stock_retail_value' => $stockRetailValue,
            'active_products' => $activeProds->count(),
            'total_customers' => $customers->count(),
            'total_suppliers' => $suppliers->count(),
        ];

        // 8. Daily Report (within from..to)
        $dailyMap = [];
        foreach ($periodSales as $s) {
            $dt = $dateOf($s->date ?? $s->sale_date, (string) $s->created_at);
            if (!isset($dailyMap[$dt])) {
                $dailyMap[$dt] = ['date' => $dt, 'invoices' => 0, 'revenue' => 0.0, 'collected' => 0.0, 'due' => 0.0, 'profit' => 0.0, 'expenses' => 0.0];
            }
            $dailyMap[$dt]['invoices']++;
            $dailyMap[$dt]['revenue'] += (float) ($s->receivable ?? 0);
            $dailyMap[$dt]['collected'] += (float) ($s->paid ?? 0);
            $dailyMap[$dt]['due'] += (float) ($s->due ?? 0);
            $dailyMap[$dt]['profit'] += $calcProfit($s);
        }
        foreach ($periodExpenses as $e) {
            $dt = $dateOf($e->expense_date, (string) $e->created_at);
            if (!isset($dailyMap[$dt])) {
                $dailyMap[$dt] = ['date' => $dt, 'invoices' => 0, 'revenue' => 0.0, 'collected' => 0.0, 'due' => 0.0, 'profit' => 0.0, 'expenses' => 0.0];
            }
            $dailyMap[$dt]['expenses'] += (float) ($e->amount ?? 0);
        }
        $dailyReport = collect($dailyMap)->sortByDesc('date')->take(90)->values();

        // 9. Low Stock Report
        $lowStockReport = $activeProds
            ->filter(fn ($p) => (int) ($p->stock_quantity ?? $p->quantity ?? 0) <= (int) ($p->alert_quantity ?? 5))
            ->map(fn ($p) => [
                'id' => (int) $p->id,
                'name' => (string) $p->name,
                'sku' => (string) ($p->sku ?? ''),
                'category_name' => (string) ($p->category?->name ?: 'Uncategorized'),
                'quantity' => (int) ($p->stock_quantity ?? $p->quantity ?? 0),
                'alert_quantity' => (int) ($p->alert_quantity ?? 5),
                'purchase_price' => (float) ($p->purchase_price ?? 0),
                'selling_price' => (float) ($p->selling_price ?? 0),
            ])
            ->sortBy('quantity')
            ->values();

        // 10. Top Customer
        $topCustAgg = [];
        foreach ($periodSales as $s) {
            $cid = (int) ($s->customer_id ?? 0);
            $cObj = $cid ? $customerMap->get($cid) : null;
            $key = $cid > 0 ? 'c-' . $cid : 'w-' . ($s->customer_name ?: 'Walk-in');
            if (!isset($topCustAgg[$key])) {
                $topCustAgg[$key] = [
                    'id' => $cid,
                    'name' => (string) ($cObj?->name ?: ($s->customer_name ?: 'Walk-in Customer')),
                    'phone' => (string) ($cObj?->phone ?? ''),
                    'invoices' => 0,
                    'total_spent' => 0.0,
                    'paid' => 0.0,
                    'due' => 0.0,
                ];
            }
            $topCustAgg[$key]['invoices']++;
            $topCustAgg[$key]['total_spent'] += (float) ($s->receivable ?? 0);
            $topCustAgg[$key]['paid'] += (float) ($s->paid ?? 0);
            $topCustAgg[$key]['due'] += (float) ($s->due ?? 0);
        }
        $topCustomers = collect($topCustAgg)->sortByDesc('total_spent')->take(50)->values();

        // 11 & 12. Top Product (Period) & Top Product (All Time)
        $allSaleItems = SaleItem::query()->get();
        $buildTopProducts = static function ($targetSales) use ($allSaleItems, $productMap, $categoryMap) {
            $saleIdSet = $targetSales->pluck('id')->flip();
            $agg = [];
            foreach ($allSaleItems as $it) {
                if (!$saleIdSet->has($it->sale_id)) {
                    continue;
                }
                $pid = (int) ($it->product_id ?? 0);
                $prod = $pid ? $productMap->get($pid) : null;
                $name = (string) ($it->product_name ?: ($prod?->name ?: 'Product'));
                $key = $pid > 0 ? 'p-' . $pid : 'n-' . $name;
                $qty = max(1, (int) ($it->quantity ?? 1));
                $total = (float) ($it->total ?? ((float) ($it->price ?? 0) * $qty));
                $cost = (float) ($it->buying_price ?? $prod?->purchase_price ?? 0) * $qty;
                $catName = (string) ($it->category_name ?: ($prod?->category_id ? ($categoryMap->get($prod->category_id) ?: 'Uncategorized') : 'Uncategorized'));
                if (!isset($agg[$key])) {
                    $agg[$key] = [
                        'product_id' => $pid,
                        'name' => $name,
                        'sku' => (string) ($prod?->sku ?? ''),
                        'category_name' => $catName,
                        'qty_sold' => 0,
                        'revenue' => 0.0,
                        'profit' => 0.0,
                    ];
                }
                $agg[$key]['qty_sold'] += $qty;
                $agg[$key]['revenue'] += $total;
                $agg[$key]['profit'] += ($total - $cost);
            }
            return collect($agg)->sortByDesc(fn ($r) => [$r['qty_sold'], $r['revenue']])->take(50)->values();
        };

        $topProducts = $buildTopProducts($periodSales);
        $topProductsAllTime = $buildTopProducts($completedSales);

        // 13. Category Wise Report
        $catAgg = [];
        foreach ($activeProds as $p) {
            $catName = (string) ($p->category?->name ?: 'Uncategorized');
            if (!isset($catAgg[$catName])) {
                $catAgg[$catName] = ['category' => $catName, 'product_count' => 0, 'stock_qty' => 0, 'qty_sold' => 0, 'sales_revenue' => 0.0, 'estimated_profit' => 0.0];
            }
            $catAgg[$catName]['product_count']++;
            $catAgg[$catName]['stock_qty'] += max(0, (int) ($p->stock_quantity ?? $p->quantity ?? 0));
        }
        $periodSaleIds = $periodSales->pluck('id')->flip();
        foreach ($allSaleItems as $it) {
            if (!$periodSaleIds->has($it->sale_id)) {
                continue;
            }
            $prod = $it->product_id ? $productMap->get((int) $it->product_id) : null;
            $catName = (string) ($it->category_name ?: ($prod?->category_id ? ($categoryMap->get($prod->category_id) ?: 'Uncategorized') : 'Uncategorized'));
            $qty = max(1, (int) ($it->quantity ?? 1));
            $rev = (float) ($it->total ?? ((float) ($it->price ?? 0) * $qty));
            $cost = (float) ($it->buying_price ?? $prod?->purchase_price ?? 0) * $qty;
            if (!isset($catAgg[$catName])) {
                $catAgg[$catName] = ['category' => $catName, 'product_count' => 0, 'stock_qty' => 0, 'qty_sold' => 0, 'sales_revenue' => 0.0, 'estimated_profit' => 0.0];
            }
            $catAgg[$catName]['qty_sold'] += $qty;
            $catAgg[$catName]['sales_revenue'] += $rev;
            $catAgg[$catName]['estimated_profit'] += ($rev - $cost);
        }
        $categoryWiseReport = collect($catAgg)->sortByDesc(fn ($r) => [$r['sales_revenue'], $r['product_count']])->values();

        return view('reports.index', compact(
            'from',
            'to',
            'activeReport',
            'summary',
            'expensesTotal',
            'damagesTotal',
            'returnsTotal',
            'netProfit',
            'expenseBreakdown',
            'customerDues',
            'supplierDues',
            'purchaseReport',
            'purchaseSummary',
            'todayReport',
            'currentMonthReport',
            'summaryReport',
            'dailyReport',
            'lowStockReport',
            'topCustomers',
            'topProducts',
            'topProductsAllTime',
            'categoryWiseReport'
        ));
    }
}
