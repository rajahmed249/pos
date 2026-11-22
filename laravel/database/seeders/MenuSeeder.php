<?php

namespace Database\Seeders;

use App\Models\Menu;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        if (Menu::query()->count() > 0) {
            return;
        }

        $items = [
            // Main Standalone Items
            ['title' => 'Dashboard', 'group_label' => 'Main', 'route_name' => 'dashboard', 'url' => '/', 'icon' => 'layout-dashboard', 'sort_order' => 1, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Owners', 'group_label' => 'Main', 'route_name' => 'owners.index', 'url' => '/owners', 'icon' => 'user-check', 'sort_order' => 2, 'roles' => ['admin', 'manager']],
            ['title' => 'Bank Accounts', 'group_label' => 'Main', 'route_name' => 'accounts.index', 'url' => '/accounts', 'icon' => 'landmark', 'sort_order' => 3, 'roles' => ['admin', 'manager']],
            ['title' => 'Cash Book', 'group_label' => 'Main', 'route_name' => 'cashbook.index', 'url' => '/cashbook', 'icon' => 'book-open', 'sort_order' => 4, 'roles' => ['admin', 'manager']],

            ['title' => 'POS', 'group_label' => 'Main', 'route_name' => 'pos.index', 'url' => '/pos', 'icon' => 'shopping-cart', 'sort_order' => 5, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Sales', 'group_label' => 'Main', 'route_name' => 'sales.index', 'url' => '/sales', 'icon' => 'receipt', 'sort_order' => 6, 'roles' => ['admin', 'manager', 'staff']],

            // Sales & Purchase
            ['title' => 'Returns', 'group_label' => 'Sales & Purchase', 'route_name' => 'returns.index', 'url' => '/returns', 'icon' => 'rotate-ccw', 'sort_order' => 7, 'roles' => ['admin', 'manager']],
            ['title' => 'Estimate', 'group_label' => 'Sales & Purchase', 'route_name' => 'estimates.index', 'url' => '/estimates', 'icon' => 'file-text', 'sort_order' => 8, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Purchase', 'group_label' => 'Sales & Purchase', 'route_name' => 'purchases.index', 'url' => '/purchases', 'icon' => 'truck', 'sort_order' => 9, 'roles' => ['admin', 'manager']],
            ['title' => 'Stock', 'group_label' => 'Sales & Purchase', 'route_name' => 'stock.index', 'url' => '/stock', 'icon' => 'boxes', 'sort_order' => 10, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Damages', 'group_label' => 'Sales & Purchase', 'route_name' => 'damages.index', 'url' => '/damages', 'icon' => 'alert-triangle', 'sort_order' => 11, 'roles' => ['admin', 'manager']],

            // Product Information
            ['title' => 'Products', 'group_label' => 'Product Information', 'route_name' => 'products.index', 'url' => '/products', 'icon' => 'package', 'sort_order' => 12, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Add Product', 'group_label' => 'Product Information', 'route_name' => 'products.create', 'url' => '/products/create', 'icon' => 'plus-circle', 'sort_order' => 13, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Categories', 'group_label' => 'Product Information', 'route_name' => 'categories.index', 'url' => '/categories', 'icon' => 'folder-tree', 'sort_order' => 14, 'roles' => ['admin', 'manager']],
            ['title' => 'Brand', 'group_label' => 'Product Information', 'route_name' => 'brands.index', 'url' => '/brands', 'icon' => 'tag', 'sort_order' => 15, 'roles' => ['admin', 'manager']],
            ['title' => 'Unit', 'group_label' => 'Product Information', 'route_name' => 'units.index', 'url' => '/units', 'icon' => 'ruler', 'sort_order' => 16, 'roles' => ['admin', 'manager']],

            // Expenses & Payment
            ['title' => 'Expenses', 'group_label' => 'Expenses & Payment', 'route_name' => 'expenses.index', 'url' => '/expenses', 'icon' => 'wallet', 'sort_order' => 17, 'roles' => ['admin', 'manager']],
            ['title' => 'Payments', 'group_label' => 'Expenses & Payment', 'route_name' => 'payments.index', 'url' => '/payments', 'icon' => 'credit-card', 'sort_order' => 18, 'roles' => ['admin', 'manager']],

            // Peoples
            ['title' => 'Customers', 'group_label' => 'Peoples', 'route_name' => 'customers.index', 'url' => '/customers', 'icon' => 'users', 'sort_order' => 19, 'roles' => ['admin', 'manager', 'staff']],
            ['title' => 'Suppliers', 'group_label' => 'Peoples', 'route_name' => 'suppliers.index', 'url' => '/suppliers', 'icon' => 'building-2', 'sort_order' => 20, 'roles' => ['admin', 'manager']],
            ['title' => 'Employee & Salary', 'group_label' => 'Peoples', 'route_name' => 'employees.index', 'url' => '/employees', 'icon' => 'badge-dollar-sign', 'sort_order' => 21, 'roles' => ['admin', 'manager']],

            // Reports
            ['title' => 'Reports', 'group_label' => 'Reports', 'route_name' => 'reports.index', 'url' => '/reports', 'icon' => 'bar-chart-3', 'sort_order' => 22, 'roles' => ['admin', 'manager']],

            // Settings & Customize
            ['title' => 'Shop Settings', 'group_label' => 'Settings & Customize', 'route_name' => 'settings.index', 'url' => '/settings', 'icon' => 'sliders', 'sort_order' => 23, 'roles' => ['admin']],
            ['title' => 'User Management', 'group_label' => 'Settings & Customize', 'route_name' => 'users.index', 'url' => '/users', 'icon' => 'user-cog', 'sort_order' => 24, 'roles' => ['admin']],
            ['title' => 'Backup & Restore', 'group_label' => 'Settings & Customize', 'route_name' => 'backup.index', 'url' => '/backup', 'icon' => 'database-backup', 'sort_order' => 25, 'roles' => ['admin']],
        ];

        foreach ($items as $item) {
            Menu::query()->create(array_merge($item, ['is_active' => true]));
        }
    }
}
