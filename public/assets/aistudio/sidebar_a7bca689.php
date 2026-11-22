<?php
// =============================================
// SIDEBAR - Youth IT POS (PURE HTML/CSS/JS)
// =============================================

// Get current page name
$current_uri = $_SERVER['REQUEST_URI'];
$current_uri = rtrim($current_uri, '/');
$current_uri = str_replace('.php', '', $current_uri);
$current_uri = basename($current_uri);

if ($current_uri == '' || $current_uri == 'index' || $current_uri == 'dashboard' || $current_uri == '/') {
    $current_page = 'dashboard';
} else {
    $current_page = $current_uri;
}

// Helper functions
function isActive($pageName) {
    global $current_page;
    return $current_page == $pageName ? 'active' : '';
}

function isSubmenuActive($pages) {
    global $current_page;
    return in_array($current_page, $pages) ? 'open' : '';
}

function isSubmenuItemActive($pageName) {
    global $current_page;
    return $current_page == $pageName ? 'active' : '';
}

// Define submenu page groups
$purchase_pages = ['add-purchase', 'purchases', 'edit-purchase', 'add', 'purchase', 'edit', 'view'];
$unit_pages = ['add-unit', 'manage-units', 'edit-unit'];
$product_pages = ['add', 'product', 'edit', 'view'];
$category_pages = ['add-category', 'categories', 'edit-category'];
$brand_pages = ['add-brand', 'brands', 'edit-brand', 'manage-brands'];
$expense_pages = ['add-expense', 'expenses', 'edit-expense', 'expense-categories'];
$payment_pages = ['add-payment', 'payments', 'payment-in', 'payment-out'];
$customer_pages = ['add-customer', 'customers', 'edit-customer', 'customer-ledger'];
$supplier_pages = ['add-supplier', 'suppliers', 'edit-supplier', 'supplier-ledger'];
$employee_pages = ['add-employee', 'employees', 'edit-employee', 'salary', 'attendance'];
$report_pages = [
    'report-profit-loss', 'report-today', 'report-monthly', 
    'report-summary', 'report-daily', 'report-customer-due',
    'report-supplier-due', 'report-low-stock', 'report-top-customer',
    'report-top-product', 'report-top-product-all', 'report-category-wise',
    'report-purchase'
];
$user_pages = ['add-user', 'users', 'edit-user'];
?>

<style>
/* ========================================
   SIDEBAR - PURE CSS SOLUTION
   ======================================== */
:root {
    --sidebar-width: 260px;
    --sidebar-collapsed-width: 70px;
}

/* ===== SIDEBAR CONTAINER ===== */
.tech-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: var(--sidebar-width);
    height: 100vh;
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: 4px 0 30px rgba(0, 0, 0, 0.3);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.tech-sidebar::-webkit-scrollbar {
    width: 4px;
}
.tech-sidebar::-webkit-scrollbar-thumb {
    background: #ffd166;
    border-radius: 10px;
}

/* ===== HEADER ===== */
.tech-sidebar-header {
    position: sticky;
    top: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 20;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
}

.sidebar-logo-img {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    object-fit: cover;
    border: 2px solid #ffd166;
    padding: 2px;
    background: white;
}

.sidebar-logo-text h3 {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0;
    line-height: 1.2;
}
.sidebar-logo-text h3 span {
    color: #ffd166;
}
.sidebar-logo-text p {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
}

/* ===== COLLAPSED STATE ===== */
.tech-sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
}
.tech-sidebar.collapsed .sidebar-logo-text,
.tech-sidebar.collapsed .sidebar-menu-text,
.tech-sidebar.collapsed .sidebar-section span,
.tech-sidebar.collapsed .sidebar-live-site span {
    display: none !important;
}
.tech-sidebar.collapsed .sidebar-logo {
    justify-content: center;
}
.tech-sidebar.collapsed .tech-sidebar-header {
    padding: 12px;
}
.tech-sidebar.collapsed .sidebar-menu li a {
    justify-content: center !important;
    padding: 12px !important;
}
.tech-sidebar.collapsed .sidebar-menu li a i {
    margin: 0 !important;
    font-size: 18px !important;
}
.tech-sidebar.collapsed .has-submenu > a .fa-chevron-right {
    display: none !important;
}
.tech-sidebar.collapsed .sidebar-section {
    justify-content: center !important;
    padding: 15px 0 8px 0 !important;
}
.tech-sidebar.collapsed .sidebar-live-site a {
    justify-content: center !important;
    padding: 12px !important;
}
.tech-sidebar.collapsed .sidebar-live-site a i {
    font-size: 18px !important;
}

/* ===== MENU ===== */
.sidebar-menu {
    list-style: none;
    padding: 8px 12px 20px 12px;
    margin: 0;
}
.sidebar-menu li {
    margin-bottom: 2px;
}
.sidebar-menu li a {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 10px 14px !important;
    color: rgba(255, 255, 255, 0.8) !important;
    text-decoration: none !important;
    border-radius: 10px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    transition: all 0.2s ease !important;
    cursor: pointer !important;
}
.sidebar-menu li a i {
    width: 20px !important;
    font-size: 14px !important;
    color: #ffd166 !important;
    text-align: center !important;
}
.sidebar-menu li a:hover {
    background: rgba(255, 215, 0, 0.1) !important;
    color: #ffffff !important;
    transform: translateX(3px) !important;
}
.sidebar-menu li a:hover i {
    color: #ffffff !important;
}

/* ===== ACTIVE MENU ===== */
.sidebar-menu li.active > a {
    background: #ffd166 !important;
    color: #1a1a2e !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3) !important;
}
.sidebar-menu li.active > a i {
    color: #1a1a2e !important;
}

/* ===== SECTION DIVIDER ===== */
.sidebar-section {
    padding: 18px 14px 8px 14px !important;
    font-size: 10px !important;
    text-transform: uppercase !important;
    color: #ffd166 !important;
    font-weight: 700 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    letter-spacing: 1px !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
    margin-top: 6px !important;
    opacity: 0.7 !important;
}
.sidebar-section:first-of-type {
    border-top: none !important;
    margin-top: 0 !important;
    padding-top: 8px !important;
}

/* ===== SUBMENU ===== */
.has-submenu {
    position: relative !important;
}
.has-submenu > a .fa-chevron-right {
    margin-left: auto !important;
    transition: transform 0.3s ease !important;
    font-size: 11px !important;
    color: rgba(255, 255, 255, 0.3) !important;
}
.has-submenu.open > a .fa-chevron-right {
    transform: rotate(90deg) !important;
}

.submenu {
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
    background: rgba(0, 0, 0, 0.2) !important;
    border-radius: 8px !important;
    margin-top: 2px !important;
}
.has-submenu.open .submenu {
    max-height: 600px !important;
}

.submenu li {
    margin: 0 !important;
}
.submenu li a {
    padding: 8px 14px 8px 40px !important;
    font-size: 12px !important;
    color: rgba(255, 255, 255, 0.5) !important;
    gap: 8px !important;
    border-radius: 0 !important;
}
.submenu li a:hover {
    background: rgba(255, 255, 255, 0.05) !important;
    color: #ffffff !important;
    transform: translateX(5px) !important;
}
.submenu li a.active {
    background: rgba(255, 215, 0, 0.1) !important;
    color: #ffd166 !important;
}
.submenu li a.active::before {
    content: '';
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 4px;
    background: #ffd166;
    border-radius: 50%;
}

/* ===== LIVE SITE ===== */
.sidebar-live-site {
    margin: 8px 12px 20px 12px !important;
}
.sidebar-live-site a {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 10px 14px !important;
    color: rgba(255, 255, 255, 0.5) !important;
    text-decoration: none !important;
    border-radius: 10px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    transition: all 0.3s !important;
}
.sidebar-live-site a i {
    width: 20px !important;
    font-size: 14px !important;
    color: #34d399 !important;
    text-align: center !important;
}
.sidebar-live-site a:hover {
    background: rgba(255, 255, 255, 0.05) !important;
    color: white !important;
    border-color: #34d399 !important;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 992px) {
    .tech-sidebar {
        transform: translateX(-100%);
        width: 280px;
        z-index: 1050;
    }
    .tech-sidebar.show {
        transform: translateX(0);
    }
    .tech-sidebar.collapsed {
        width: 280px;
        transform: translateX(-100%);
    }
    .tech-sidebar.collapsed.show {
        transform: translateX(0);
    }
    .tech-sidebar.collapsed .sidebar-logo-text,
    .tech-sidebar.collapsed .sidebar-menu-text,
    .tech-sidebar.collapsed .sidebar-section span,
    .tech-sidebar.collapsed .sidebar-live-site span {
        display: inline !important;
    }
    .tech-sidebar.collapsed .sidebar-logo {
        justify-content: flex-start !important;
    }
    .tech-sidebar.collapsed .sidebar-menu li a {
        justify-content: flex-start !important;
        padding: 10px 14px !important;
    }
    .tech-sidebar.collapsed .sidebar-menu li a i {
        margin-right: 12px !important;
        font-size: 15px !important;
    }
    .tech-sidebar.collapsed .has-submenu > a .fa-chevron-right {
        display: inline-block !important;
    }
    .tech-sidebar.collapsed .sidebar-section {
        justify-content: flex-start !important;
        padding: 18px 14px 8px 14px !important;
    }
    .tech-sidebar.collapsed .sidebar-live-site a {
        justify-content: flex-start !important;
        padding: 10px 14px !important;
    }
}

/* ===== OVERLAY ===== */
.sidebar-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1040;
}
.sidebar-overlay.active {
    display: block;
}
@media (max-width: 992px) {
    .sidebar-overlay.active {
        display: block;
    }
}
</style>

<!-- ===== OVERLAY ===== -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- ===== SIDEBAR ===== -->
<div class="tech-sidebar" id="techSidebar">
    <div class="tech-sidebar-header">
        <a href="/" class="sidebar-logo">
            <img src="/assets/images/logo.jpg" alt="Logo" class="sidebar-logo-img" onerror="this.style.display='none';">
            <div class="sidebar-logo-text">
                <h3>Youth <span>IT</span> POS</h3>
                <p>Point of Sale System</p>
            </div>
        </a>
    </div>

    <ul class="sidebar-menu" id="sidebarMenu">
        <!-- DASHBOARD -->
        <li class="<?php echo isActive('dashboard'); ?>">
            <a href="/"><i class="fas fa-tachometer-alt"></i> <span class="sidebar-menu-text">Dashboard</span></a>
        </li>

        <!-- OWNERS -->
        <li class="<?php echo isActive('owners'); ?>">
            <a href="/owners"><i class="fas fa-user-tie"></i> <span class="sidebar-menu-text">Owners</span></a>
        </li>

        <!-- BANK ACCOUNTS -->
        <li class="<?php echo isActive('banks'); ?>">
            <a href="/banks"><i class="fas fa-university"></i> <span class="sidebar-menu-text">Bank Accounts</span></a>
        </li>

        <!-- CASH BOOK -->
        <li class="<?php echo isActive('cashbook'); ?>">
            <a href="/cashbook"><i class="fas fa-book"></i> <span class="sidebar-menu-text">Cash Book</span></a>
        </li>

        <!-- SECTION: SALES & PURCHASE -->
        <li class="sidebar-section"><i class="fas fa-chart-line"></i> <span class="sidebar-menu-text">Sales & Purchase</span></li>

        <!-- POS -->
        <li class="<?php echo isActive('pos'); ?>">
            <a href="/pos"><i class="fas fa-cash-register"></i> <span class="sidebar-menu-text">POS</span></a>
        </li>

        <!-- Sales -->
        <li class="<?php echo isActive('sales'); ?>">
            <a href="/sales"><i class="fas fa-chart-line"></i> <span class="sidebar-menu-text">Sales</span></a>
        </li>

        <!-- Returns -->
        <li class="<?php echo isActive('returns'); ?>">
            <a href="/returns"><i class="fas fa-undo-alt"></i> <span class="sidebar-menu-text">Returns</span></a>
        </li>

        <!-- Estimate -->
        <li class="<?php echo isActive('estimate'); ?>">
            <a href="/estimate"><i class="fas fa-file-invoice"></i> <span class="sidebar-menu-text">Estimate</span></a>
        </li>

        <!-- Purchase Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($purchase_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-truck"></i> <span class="sidebar-menu-text">Purchase</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add" class="<?php echo (isSubmenuItemActive('add') || isSubmenuItemActive('add-purchase')) ? 'active' : ''; ?>">Add Purchase</a></li>
                <li><a href="/purchase" class="<?php echo (isSubmenuItemActive('purchase') || isSubmenuItemActive('purchases')) ? 'active' : ''; ?>">Manage Purchase</a></li>
            </ul>
        </li>

        <!-- Stock -->
        <li class="<?php echo isActive('stock'); ?>">
            <a href="/stock"><i class="fas fa-boxes"></i> <span class="sidebar-menu-text">Stock</span></a>
        </li>

        <!-- Damages -->
        <li class="<?php echo isActive('damages'); ?>">
            <a href="/damages"><i class="fas fa-exclamation-triangle"></i> <span class="sidebar-menu-text">Damages</span></a>
        </li>

        <!-- SECTION: PRODUCT INFORMATION -->
        <li class="sidebar-section"><i class="fas fa-box"></i> <span class="sidebar-menu-text">Product Information</span></li>

        <!-- Unit Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($unit_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-weight-hanging"></i> <span class="sidebar-menu-text">Unit</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-unit" class="<?php echo isSubmenuItemActive('add-unit'); ?>">Add Unit</a></li>
                <li><a href="/manage-units" class="<?php echo isSubmenuItemActive('manage-units'); ?>">Manage Units</a></li>
            </ul>
        </li>

        <!-- Products Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($product_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-box-open"></i> <span class="sidebar-menu-text">Products</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/product/add" class="<?php echo (strpos($_SERVER['REQUEST_URI'], '/product/add') !== false) ? 'active' : ''; ?>">Add Products</a></li>
                <li><a href="/product" class="<?php echo isSubmenuItemActive('product') ? 'active' : ''; ?>">Manage Products</a></li>
            </ul>
        </li>

        <!-- Categories Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($category_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-tags"></i> <span class="sidebar-menu-text">Categories</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-category" class="<?php echo isSubmenuItemActive('add-category'); ?>">Add Category</a></li>
                <li><a href="/categories" class="<?php echo isSubmenuItemActive('categories'); ?>">Manage Categories</a></li>
            </ul>
        </li>

        <!-- Brand Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($brand_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-trademark"></i> <span class="sidebar-menu-text">Brand</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-brand" class="<?php echo isSubmenuItemActive('add-brand'); ?>">Add Brand</a></li>
                <li><a href="/brands" class="<?php echo isSubmenuItemActive('brands'); ?>">Manage Brand</a></li>
            </ul>
        </li>

        <!-- SECTION: EXPENSES & PAYMENT -->
        <li class="sidebar-section"><i class="fas fa-money-bill-wave"></i> <span class="sidebar-menu-text">Expenses & Payment</span></li>

        <!-- Expenses Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($expense_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-chart-pie"></i> <span class="sidebar-menu-text">Expenses</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-expense" class="<?php echo isSubmenuItemActive('add-expense'); ?>">Add Expense</a></li>
                <li><a href="/expenses" class="<?php echo isSubmenuItemActive('expenses'); ?>">Manage Expenses</a></li>
                <li><a href="/expense-categories" class="<?php echo isSubmenuItemActive('expense-categories'); ?>">Expense Categories</a></li>
            </ul>
        </li>

        <!-- Payments Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($payment_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-hand-holding-usd"></i> <span class="sidebar-menu-text">Payments</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-payment" class="<?php echo isSubmenuItemActive('add-payment'); ?>">Add Payment</a></li>
                <li><a href="/payments" class="<?php echo isSubmenuItemActive('payments'); ?>">Payments</a></li>
            </ul>
        </li>

        <!-- SECTION: PEOPLES -->
        <li class="sidebar-section"><i class="fas fa-users"></i> <span class="sidebar-menu-text">Peoples</span></li>

        <!-- Customers Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($customer_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-user-friends"></i> <span class="sidebar-menu-text">Customers</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-customer" class="<?php echo isSubmenuItemActive('add-customer'); ?>">Add Customer</a></li>
                <li><a href="/customers" class="<?php echo isSubmenuItemActive('customers'); ?>">Manage Customers</a></li>
                <li><a href="/customer-ledger" class="<?php echo isSubmenuItemActive('customer-ledger'); ?>">Customer Ledger</a></li>
            </ul>
        </li>

        <!-- Suppliers Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($supplier_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-truck"></i> <span class="sidebar-menu-text">Suppliers</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-supplier" class="<?php echo isSubmenuItemActive('add-supplier'); ?>">Add Supplier</a></li>
                <li><a href="/suppliers" class="<?php echo isSubmenuItemActive('suppliers'); ?>">Manage Suppliers</a></li>
                <li><a href="/supplier-ledger" class="<?php echo isSubmenuItemActive('supplier-ledger'); ?>">Supplier Ledger</a></li>
            </ul>
        </li>

        <!-- Employee Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($employee_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-user-md"></i> <span class="sidebar-menu-text">Employee & Salary</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-employee" class="<?php echo isSubmenuItemActive('add-employee'); ?>">Add Employee</a></li>
                <li><a href="/employees" class="<?php echo isSubmenuItemActive('employees'); ?>">Manage Employees</a></li>
                <li><a href="/salary" class="<?php echo isSubmenuItemActive('salary'); ?>">Salary Management</a></li>
                <li><a href="/attendance" class="<?php echo isSubmenuItemActive('attendance'); ?>">Attendance</a></li>
            </ul>
        </li>

        <!-- SECTION: REPORTS -->
        <li class="sidebar-section"><i class="fas fa-file-alt"></i> <span class="sidebar-menu-text">Reports</span></li>

        <!-- Reports Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($report_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-chart-line"></i> <span class="sidebar-menu-text">Reports</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/reports/customer-due" class="<?php echo isSubmenuItemActive('customer-due'); ?>">Customer Due Report</a></li> 
                <li><a href="/reports/supplier-due" class="<?php echo isSubmenuItemActive('report-supplier-due'); ?>">Supplier Due Report</a></li> 
                <li><a href="/reports/purchase-report" class="<?php echo isSubmenuItemActive('purchase-report'); ?>">Purchase Report</a></li>

                
                <li><a href="/report-profit-loss" class="<?php echo isSubmenuItemActive('report-profit-loss'); ?>">Profit Loss Report</a></li>
                <li><a href="/report-today" class="<?php echo isSubmenuItemActive('report-today'); ?>">Today Report</a></li>
                <li><a href="/report-monthly" class="<?php echo isSubmenuItemActive('report-monthly'); ?>">Current Month Report</a></li>
                <li><a href="/report-summary" class="<?php echo isSubmenuItemActive('report-summary'); ?>">Summary Report</a></li>
                <li><a href="/report-daily" class="<?php echo isSubmenuItemActive('report-daily'); ?>">Daily Report</a></li>
                <li><a href="/report-low-stock" class="<?php echo isSubmenuItemActive('report-low-stock'); ?>">Low Stock Report</a></li>
                <li><a href="/report-top-customer" class="<?php echo isSubmenuItemActive('report-top-customer'); ?>">Top Customer</a></li>
                <li><a href="/report-top-product" class="<?php echo isSubmenuItemActive('report-top-product'); ?>">Top Product</a></li>
                <li><a href="/report-top-product-all" class="<?php echo isSubmenuItemActive('report-top-product-all'); ?>">Top Product (All Time)</a></li>
                <li><a href="/report-category-wise" class="<?php echo isSubmenuItemActive('report-category-wise'); ?>">Category Wise Report</a></li>

            </ul>
        </li>

        <!-- SECTION: SETTINGS -->
        <li class="sidebar-section"><i class="fas fa-cog"></i> <span class="sidebar-menu-text">Settings & Customize</span></li>

        <!-- Shop Settings -->
        <li class="<?php echo isActive('shop'); ?>">
            <a href="/shop"><i class="fas fa-store"></i> <span class="sidebar-menu-text">Shop Settings</span></a>
        </li>

        <!-- User Management Dropdown -->
        <li class="has-submenu <?php echo isSubmenuActive($user_pages); ?>">
            <a href="javascript:void(0);" class="submenu-trigger">
                <i class="fas fa-users-cog"></i> <span class="sidebar-menu-text">User Management</span> <i class="fas fa-chevron-right"></i>
            </a>
            <ul class="submenu">
                <li><a href="/add-user" class="<?php echo isSubmenuItemActive('add-user'); ?>">Add User</a></li>
                <li><a href="/users" class="<?php echo isSubmenuItemActive('users'); ?>">Manage User</a></li>
            </ul>
        </li>

        <!-- Backup & Restore -->
        <li class="<?php echo isActive('backup'); ?>">
            <a href="/backup"><i class="fas fa-database"></i> <span class="sidebar-menu-text">Backup & Restore</span></a>
        </li>

        <!-- Logout -->
        <li class="<?php echo isActive('logout'); ?>">
            <a href="/logout"><i class="fas fa-sign-out-alt"></i> <span class="sidebar-menu-text">Logout</span></a>
        </li>
    </ul>

    <!-- LIVE SITE -->
    <div class="sidebar-live-site">
        <a href="https://youthit.com.bd/" target="_blank">
            <i class="fas fa-globe"></i> <span>View Website</span>
        </a>
    </div>
</div>

<script>
// ============================================
// SIDEBAR - SIMPLE & RELIABLE SOLUTION
// ============================================
(function() {
    'use strict';
    
    // Get elements
    var sidebar = document.getElementById('techSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var body = document.body;
    
    // ===== TOGGLE SIDEBAR =====
    window.toggleSidebar = function() {
        var isMobile = window.innerWidth <= 992;
        
        if (isMobile) {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('show') ? 'hidden' : '';
        } else {
            sidebar.classList.toggle('collapsed');
            var isCollapsed = sidebar.classList.contains('collapsed');
            body.classList.toggle('sidebar-collapsed', isCollapsed);
            localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
            updateMainContent();
            updateTopbar();
        }
    };
    
    // ===== UPDATE FUNCTIONS =====
    function updateMainContent() {
        var mainContent = document.querySelector('.main-content');
        if (!mainContent) return;
        
        var isMobile = window.innerWidth <= 992;
        var isCollapsed = sidebar.classList.contains('collapsed');
        
        if (isMobile) {
            mainContent.style.marginLeft = '0';
        } else if (isCollapsed) {
            mainContent.style.marginLeft = '70px';
        } else {
            mainContent.style.marginLeft = '260px';
        }
    }
    
    function updateTopbar() {
        var topbar = document.getElementById('techTopbar');
        if (!topbar) return;
        
        var isMobile = window.innerWidth <= 992;
        var isCollapsed = sidebar.classList.contains('collapsed');
        
        if (isMobile) {
            topbar.classList.remove('collapsed');
        } else if (isCollapsed) {
            topbar.classList.add('collapsed');
        } else {
            topbar.classList.remove('collapsed');
        }
    }
    
    window.closeSidebar = function() {
        sidebar.classList.remove('show');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        var topbar = document.getElementById('techTopbar');
        if (topbar && window.innerWidth <= 992) {
            topbar.classList.remove('collapsed');
        }
    };
    
    // ===== OVERLAY CLICK =====
    if (overlay) {
        overlay.addEventListener('click', window.closeSidebar);
    }
    
    // ============================================
    // SUBMENU TOGGLE - THE SOLUTION
    // ============================================
    // Method 1: Using onclick attribute directly on anchors
    document.querySelectorAll('.submenu-trigger').forEach(function(trigger) {
        trigger.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var parentLi = this.closest('.has-submenu');
            if (parentLi) {
                parentLi.classList.toggle('open');
            }
            return false;
        };
    });
    
    // Method 2: Using addEventListener (backup)
    document.querySelectorAll('.submenu-trigger').forEach(function(trigger) {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var parentLi = this.closest('.has-submenu');
            if (parentLi) {
                parentLi.classList.toggle('open');
            }
        });
    });
    
    // ============================================
    // RESPONSIVE HANDLING
    // ============================================
    function handleResponsive() {
        var isMobile = window.innerWidth <= 992;
        var mainContent = document.querySelector('.main-content');
        
        if (isMobile) {
            sidebar.classList.remove('collapsed');
            if (mainContent) mainContent.style.marginLeft = '0';
            var topbar = document.getElementById('techTopbar');
            if (topbar) topbar.classList.remove('collapsed');
        } else {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            
            var savedState = localStorage.getItem('sidebarCollapsed');
            if (savedState === 'true') {
                sidebar.classList.add('collapsed');
                body.classList.add('sidebar-collapsed');
                if (mainContent) mainContent.style.marginLeft = '70px';
            } else {
                sidebar.classList.remove('collapsed');
                body.classList.remove('sidebar-collapsed');
                if (mainContent) mainContent.style.marginLeft = '260px';
            }
            updateTopbar();
        }
    }
    
    // ===== RESTORE STATE =====
    var savedState = localStorage.getItem('sidebarCollapsed');
    var mainContent = document.querySelector('.main-content');
    
    if (savedState === 'true' && window.innerWidth > 992) {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
        if (mainContent) mainContent.style.marginLeft = '70px';
        var topbar = document.getElementById('techTopbar');
        if (topbar) topbar.classList.add('collapsed');
    } else if (window.innerWidth > 992) {
        if (mainContent) mainContent.style.marginLeft = '260px';
        var topbar = document.getElementById('techTopbar');
        if (topbar) topbar.classList.remove('collapsed');
    }
    
    // ===== WINDOW EVENTS =====
    window.addEventListener('resize', function() {
        handleResponsive();
        updateMainContent();
    });
    
    // ===== KEYBOARD ESC =====
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            window.closeSidebar();
        }
    });
    
    // ===== INITIAL SETUP =====
    setTimeout(function() {
        updateMainContent();
        updateTopbar();
    }, 100);
    
    // ===== DEBUG =====
    console.log('✅ Sidebar initialized');
    console.log('📊 Submenu triggers found:', document.querySelectorAll('.submenu-trigger').length);
    
})();
</script>