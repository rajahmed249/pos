<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(): View
    {
        $today = Carbon::today()->toDateString();

        $metrics = [
            'today_sales' => (float) Sale::query()->whereDate('date', $today)->where('status', 'completed')->sum('receivable'),
            'today_profit' => (float) Sale::query()->whereDate('date', $today)->where('status', 'completed')->sum('profit'),
            'total_revenue' => (float) Sale::query()->where('status', 'completed')->sum('receivable'),
            'total_profit' => (float) Sale::query()->where('status', 'completed')->sum('profit'),
            'customer_due' => (float) Sale::query()->where('status', 'completed')->sum('due'),
            'supplier_due' => (float) Purchase::query()->sum('due'),
            'total_expenses' => (float) Expense::query()->sum('amount'),
            'product_count' => Product::query()->where('status', true)->count(),
        ];

        $lowStockProducts = Product::query()
            ->where('status', true)
            ->whereColumn('stock_quantity', '<=', 'alert_quantity')
            ->orderBy('stock_quantity')
            ->limit(8)
            ->get();

        $recentSales = Sale::query()
            ->with('customer')
            ->latest('id')
            ->limit(10)
            ->get();

        $accounts = BankAccount::query()->orderBy('id')->get();

        return view('dashboard.index', compact('metrics', 'lowStockProducts', 'recentSales', 'accounts'));
    }
}
