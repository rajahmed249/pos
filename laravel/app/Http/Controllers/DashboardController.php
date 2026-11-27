<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(): View
    {
        $today = Carbon::today()->toDateString();

        $metrics = [
            'today_sales' => 0.0,
            'today_profit' => 0.0,
            'today_expense' => 0.0,
            'today_margin' => 0.0,
            'total_revenue' => 0.0,
            'total_profit' => 0.0,
            'customer_due' => 0.0,
            'supplier_due' => 0.0,
            'total_expenses' => 0.0,
            'product_count' => 0,
            'customer_count' => 0,
            'supplier_count' => 0,
            'low_stock_count' => 0,
            'out_of_stock_count' => 0,
        ];

        try {
            if (Schema::hasTable('sales')) {
                $metrics['today_sales'] = (float) Sale::query()->whereDate('date', $today)->where('status', 'completed')->sum('receivable');
                $metrics['today_profit'] = (float) Sale::query()->whereDate('date', $today)->where('status', 'completed')->sum('profit');
                $metrics['total_revenue'] = (float) Sale::query()->where('status', 'completed')->sum('receivable');
                $metrics['total_profit'] = (float) Sale::query()->where('status', 'completed')->sum('profit');
                $metrics['customer_due'] = (float) Sale::query()->where('status', 'completed')->sum('due');
            }
        } catch (\Throwable) {
            // Leave sale metrics at 0.0 if table/columns are still initializing
        }

        try {
            if (Schema::hasTable('purchases')) {
                $metrics['supplier_due'] = (float) Purchase::query()->sum('due');
            }
        } catch (\Throwable) {
            // Ignore
        }

        try {
            if (Schema::hasTable('expenses')) {
                $metrics['total_expenses'] = (float) Expense::query()->sum('amount');
                $metrics['today_expense'] = (float) Expense::query()->whereDate('expense_date', $today)->sum('amount');
            }
        } catch (\Throwable) {
            // Ignore
        }

        $metrics['today_margin'] = $metrics['today_sales'] > 0
            ? round(($metrics['today_profit'] / $metrics['today_sales']) * 100, 1)
            : 0.0;

        try {
            if (Schema::hasTable('products')) {
                $metrics['product_count'] = (int) Product::query()->where('status', true)->count();
                $metrics['low_stock_count'] = (int) Product::query()
                    ->where('status', true)
                    ->where('stock_quantity', '>', 0)
                    ->whereColumn('stock_quantity', '<=', 'alert_quantity')
                    ->count();
                $metrics['out_of_stock_count'] = (int) Product::query()
                    ->where('status', true)
                    ->where('stock_quantity', '<=', 0)
                    ->count();
            }
        } catch (\Throwable) {
            // Ignore
        }

        try {
            if (Schema::hasTable('customers')) {
                $metrics['customer_count'] = (int) Customer::query()->count();
            }
        } catch (\Throwable) {
            // Ignore
        }

        try {
            if (Schema::hasTable('suppliers')) {
                $metrics['supplier_count'] = (int) Supplier::query()->count();
            }
        } catch (\Throwable) {
            // Ignore
        }

        $lowStockProducts = collect();
        try {
            if (Schema::hasTable('products')) {
                $lowStockProducts = Product::query()
                    ->where('status', true)
                    ->whereColumn('stock_quantity', '<=', 'alert_quantity')
                    ->orderBy('stock_quantity')
                    ->limit(8)
                    ->get();
            }
        } catch (\Throwable) {
            $lowStockProducts = collect();
        }

        $recentSales = collect();
        $monthlyTrend = [];
        try {
            if (Schema::hasTable('sales')) {
                $query = Sale::query()->latest('id')->limit(10);
                if (Schema::hasTable('customers')) {
                    $query->with('customer');
                }
                $recentSales = $query->get();

                $monthlyMap = [];
                foreach (Sale::query()->where('status', 'completed')->select(['date', 'created_at', 'receivable', 'purchase_cost', 'profit'])->cursor() as $row) {
                    $rawDate = $row->date instanceof Carbon ? $row->date->toDateString() : (string) ($row->date ?: ($row->created_at ?? ''));
                    $ym = strlen($rawDate) >= 7 ? substr($rawDate, 0, 7) : date('Y-m');
                    $rev = (float) ($row->receivable ?? 0);
                    $cost = (float) ($row->purchase_cost ?? 0);
                    $prof = (float) ($row->profit ?? 0);
                    if ($prof == 0.0 && $cost > 0) {
                        $prof = $rev - $cost;
                    }
                    if (!isset($monthlyMap[$ym])) {
                        $monthlyMap[$ym] = ['month' => $ym, 'revenue' => 0.0, 'profit' => 0.0, 'count' => 0];
                    }
                    $monthlyMap[$ym]['revenue'] += $rev;
                    $monthlyMap[$ym]['profit'] += $prof;
                    $monthlyMap[$ym]['count'] += 1;
                }
                ksort($monthlyMap);
                $monthlyTrend = array_slice(array_values($monthlyMap), -6);
            }
        } catch (\Throwable) {
            $recentSales = collect();
            $monthlyTrend = [];
        }

        $accounts = collect();
        try {
            if (Schema::hasTable('bank_accounts')) {
                $accounts = BankAccount::query()->orderBy('id')->get();
            }
        } catch (\Throwable) {
            $accounts = collect();
        }

        return view('dashboard.index', compact('metrics', 'lowStockProducts', 'recentSales', 'accounts', 'monthlyTrend'));
    }
}
