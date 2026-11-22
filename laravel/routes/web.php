<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EstimateController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\OperationsController;
use App\Http\Controllers\PartyController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReturnDamageController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.attempt');
    Route::get('/forgot-password', [AuthController::class, 'showForgotPassword'])->name('password.forgot');
    Route::post('/forgot-password', [AuthController::class, 'recoverPassword'])->name('password.recover');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // POS Terminal
    Route::get('/pos', [PosController::class, 'index'])->name('pos.index');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])->name('pos.checkout');

    // Sales & Invoices
    Route::get('/sales', [SaleController::class, 'index'])->name('sales.index');
    Route::get('/sales/{sale}/invoice', [SaleController::class, 'invoice'])->name('sales.invoice');
    Route::get('/sales/{sale}/print', [SaleController::class, 'printInvoice'])->name('sales.print');
    Route::post('/sales/{sale}/payment', [SaleController::class, 'collectDue'])->name('sales.payment');
    Route::delete('/sales/{sale}', [SaleController::class, 'destroy'])->name('sales.destroy');

    // Estimates
    Route::get('/estimates', [EstimateController::class, 'index'])->name('estimates.index');
    Route::post('/estimates', [EstimateController::class, 'store'])->name('estimates.store');
    Route::patch('/estimates/{estimate}/status', [EstimateController::class, 'updateStatus'])->name('estimates.status');

    // Inventory, Stock & Products
    Route::get('/products', [ProductController::class, 'index'])->name('products.index');
    Route::get('/products/create', [ProductController::class, 'create'])->name('products.create');
    Route::post('/products', [ProductController::class, 'store'])->name('products.store');
    Route::get('/products/{product}/edit', [ProductController::class, 'edit'])->name('products.edit');
    Route::put('/products/{product}', [ProductController::class, 'update'])->name('products.update');
    Route::post('/products/{product}/adjust', [ProductController::class, 'adjustStock'])->name('products.adjust');
    Route::patch('/products/{product}/toggle', [ProductController::class, 'toggle'])->name('products.toggle');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    Route::get('/stock', [OperationsController::class, 'stock'])->name('stock.index');

    // Customers
    Route::get('/customers', [PartyController::class, 'customers'])->name('customers.index');
    Route::post('/customers', [PartyController::class, 'storeCustomer'])->name('customers.store');
    Route::put('/customers/{customer}', [PartyController::class, 'updateCustomer'])->name('customers.update');

    // Manager & Admin Modules
    Route::middleware('role:admin,manager')->group(function () {
        // Owners & Cash Book
        Route::get('/owners', [OperationsController::class, 'owners'])->name('owners.index');
        Route::post('/owners', [OperationsController::class, 'storeOwner'])->name('owners.store');
        Route::patch('/owners/{owner}/toggle', [OperationsController::class, 'toggleOwner'])->name('owners.toggle');
        Route::delete('/owners/{owner}', [OperationsController::class, 'destroyOwner'])->name('owners.destroy');

        Route::get('/cashbook', [OperationsController::class, 'cashbook'])->name('cashbook.index');
        Route::post('/cashbook', [OperationsController::class, 'storeCashbook'])->name('cashbook.store');

        // Product Information Taxonomy
        Route::get('/units', [OperationsController::class, 'units'])->name('units.index');
        Route::post('/units', [CatalogController::class, 'storeUnit'])->name('units.store');
        Route::delete('/units/{unit}', [OperationsController::class, 'destroyUnit'])->name('units.destroy');

        Route::get('/categories', [CatalogController::class, 'categories'])->name('categories.index');
        Route::post('/categories', [CatalogController::class, 'storeCategory'])->name('categories.store');
        Route::delete('/categories/{category}', [CatalogController::class, 'destroyCategory'])->name('categories.destroy');

        Route::get('/brands', [CatalogController::class, 'brands'])->name('brands.index');
        Route::post('/brands', [CatalogController::class, 'storeBrand'])->name('brands.store');
        Route::delete('/brands/{brand}', [CatalogController::class, 'destroyBrand'])->name('brands.destroy');

        Route::get('/warranties', [CatalogController::class, 'warranties'])->name('warranties.index');
        Route::post('/warranties', [CatalogController::class, 'storeWarranty'])->name('warranties.store');

        // Purchases & Suppliers
        Route::get('/purchases', [PurchaseController::class, 'index'])->name('purchases.index');
        Route::post('/purchases', [PurchaseController::class, 'store'])->name('purchases.store');
        Route::post('/purchases/{purchase}/payment', [PurchaseController::class, 'paySupplier'])->name('purchases.payment');

        Route::get('/suppliers', [PartyController::class, 'suppliers'])->name('suppliers.index');
        Route::post('/suppliers', [PartyController::class, 'storeSupplier'])->name('suppliers.store');
        Route::put('/suppliers/{supplier}', [PartyController::class, 'updateSupplier'])->name('suppliers.update');

        // Employee & Salary
        Route::get('/employees', [OperationsController::class, 'employees'])->name('employees.index');
        Route::post('/employees', [OperationsController::class, 'storeEmployee'])->name('employees.store');
        Route::post('/employees/{employee}/salary', [OperationsController::class, 'paySalary'])->name('employees.salary');
        Route::patch('/employees/{employee}/toggle', [OperationsController::class, 'toggleEmployee'])->name('employees.toggle');
        Route::delete('/employees/{employee}', [OperationsController::class, 'destroyEmployee'])->name('employees.destroy');

        // Accounts, Expenses, Payments, Returns & Damages
        Route::get('/accounts', [AccountController::class, 'index'])->name('accounts.index');
        Route::post('/accounts', [AccountController::class, 'storeAccount'])->name('accounts.store');
        Route::post('/accounts/transaction', [AccountController::class, 'storeTransaction'])->name('accounts.transaction');

        Route::get('/expenses', [AccountController::class, 'expenses'])->name('expenses.index');
        Route::post('/expenses', [AccountController::class, 'storeExpense'])->name('expenses.store');

        Route::get('/payments', [OperationsController::class, 'payments'])->name('payments.index');

        Route::get('/returns', [ReturnDamageController::class, 'index'])->name('returns.index');
        Route::post('/returns', [ReturnDamageController::class, 'storeReturn'])->name('returns.store');
        Route::get('/damages', [OperationsController::class, 'damages'])->name('damages.index');
        Route::post('/damages', [ReturnDamageController::class, 'storeDamage'])->name('damages.store');

        // Reports
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    });

    // Admin Only: Dynamic Menu Manager, Layout & Shop Settings, Users, Backup & Restore
    Route::middleware('role:admin')->group(function () {
        Route::get('/menus', [MenuController::class, 'index'])->name('menus.index');
        Route::post('/menus', [MenuController::class, 'store'])->name('menus.store');
        Route::put('/menus/{menu}', [MenuController::class, 'update'])->name('menus.update');
        Route::post('/menus/reorder', [MenuController::class, 'reorder'])->name('menus.reorder');
        Route::delete('/menus/{menu}', [MenuController::class, 'destroy'])->name('menus.destroy');

        Route::get('/settings', [SettingController::class, 'index'])->name('settings.index');
        Route::post('/settings', [SettingController::class, 'update'])->name('settings.update');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/user', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('/users/{user}/toggle', [UserController::class, 'toggle'])->name('users.toggle');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::post('/users/profile/update', [UserController::class, 'updateMyProfile'])->name('users.profile.update');
        Route::post('/users/profile/password', [UserController::class, 'updateMyPassword'])->name('users.password');

        Route::get('/backup', [OperationsController::class, 'backup'])->name('backup.index');
        Route::get('/backup/download', [OperationsController::class, 'downloadBackup'])->name('backup.download');
        Route::post('/backup/restore', [OperationsController::class, 'restoreBackup'])->name('backup.restore');
    });
});
