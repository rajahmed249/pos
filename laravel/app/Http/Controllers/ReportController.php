<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ReportController extends Controller
{
    public function index(Request $request): View
    {
        $from = $request->string('from')->toString() ?: now()->startOfMonth()->toDateString();
        $to = $request->string('to')->toString() ?: now()->toDateString();

        $salesSummary = Sale::query()
            ->whereBetween('date', [$from, $to])
            ->where('status', 'completed')
            ->selectRaw('COUNT(*) as invoice_count, COALESCE(SUM(receivable), 0) as revenue, COALESCE(SUM(paid), 0) as collected, COALESCE(SUM(due), 0) as due, COALESCE(SUM(profit), 0) as gross_profit')
            ->first();

        $expensesTotal = (float) Expense::query()->whereBetween('expense_date', [$from, $to])->sum('amount');
        $purchasesTotal = (float) Purchase::query()->whereBetween(DB::raw('DATE(purchase_date)'), [$from, $to])->sum('total');

        $customerDues = Customer::query()
            ->withSum('sales as total_due', 'due')
            ->having('total_due', '>', 0)
            ->orderByDesc('total_due')
            ->limit(25)
            ->get();

        $supplierDues = Supplier::query()
            ->withSum('purchases as total_due', 'due')
            ->having('total_due', '>', 0)
            ->orderByDesc('total_due')
            ->limit(25)
            ->get();

        $stockValuation = Product::query()
            ->where('status', true)
            ->selectRaw('COUNT(*) as sku_count, COALESCE(SUM(stock_quantity), 0) as total_units, COALESCE(SUM(stock_quantity * purchase_price), 0) as cost_value, COALESCE(SUM(stock_quantity * selling_price), 0) as retail_value')
            ->first();

        return view('reports.index', compact(
            'from',
            'to',
            'salesSummary',
            'expensesTotal',
            'purchasesTotal',
            'customerDues',
            'supplierDues',
            'stockValuation'
        ));
    }
}
