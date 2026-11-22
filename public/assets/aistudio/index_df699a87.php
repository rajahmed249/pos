<?php
$page_title = 'Products - Youth IT POS';
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/functions.php';
redirectIfNotLoggedIn();

// Safe htmlspecialchars wrapper
if (!function_exists('safeHtml')) {
    function safeHtml($string, $default = '') {
        $value = $string ?? $default;
        return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
    }
}

// Format money function
if (!function_exists('formatMoney')) {
    function formatMoney($amount) {
        return number_format((float)$amount, 2);
    }
}

// Handle product deletion
if (isset($_POST['delete_product']) && isset($_POST['product_id'])) {
    $product_id = (int)$_POST['product_id'];
    try {
        $stmt = $pdo->prepare("UPDATE products SET status = 0 WHERE id = ?");
        $stmt->execute([$product_id]);
        $_SESSION['success'] = "Product deleted successfully!";
    } catch (Exception $e) {
        $_SESSION['error'] = "Failed to delete product!";
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

// Handle status toggle
if (isset($_POST['toggle_status']) && isset($_POST['product_id'])) {
    $product_id = (int)$_POST['product_id'];
    try {
        $stmt = $pdo->prepare("UPDATE products SET status = IF(status=1, 0, 1) WHERE id = ?");
        $stmt->execute([$product_id]);
        $_SESSION['success'] = "Product status updated!";
    } catch (Exception $e) {
        $_SESSION['error'] = "Failed to update status!";
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

// ===== AJAX LIVE SEARCH =====
if (isset($_GET['ajax_search'])) {
    header('Content-Type: application/json');
    $search_term = isset($_GET['term']) ? trim($_GET['term']) : '';
    
    try {
        $stmt = $pdo->prepare("SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.stock_quantity, 
                                      p.purchase_price, p.alert_quantity, p.image,
                                      c.name as category_name, b.name as brand_name,
                                      w.duration as warranty_duration
                               FROM products p
                               LEFT JOIN categories c ON p.category_id = c.id
                               LEFT JOIN brands b ON p.brand_id = b.id
                               LEFT JOIN warranties w ON p.warranty_id = w.id
                               WHERE p.status = 1 
                               AND (
                                   p.name LIKE ? OR 
                                   p.sku LIKE ? OR 
                                   p.barcode LIKE ? OR 
                                   c.name LIKE ? OR 
                                   b.name LIKE ? OR 
                                   w.duration LIKE ? OR 
                                   p.selling_price LIKE ?
                               )
                               LIMIT 50");
        $search_param = "%$search_term%";
        $stmt->execute([
            $search_param, $search_param, $search_param, 
            $search_param, $search_param, $search_param, 
            $search_param
        ]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $data = [];
        $sl = 1;
        foreach($results as $product) {
            $stock_qty = (int)($product['stock_quantity'] ?? 0);
            $alert_qty = (int)($product['alert_quantity'] ?? 5);
            
            if ($stock_qty <= 0) {
                $stock_status = 'Out of Stock';
                $stock_class = 'out';
            } elseif ($stock_qty <= $alert_qty) {
                $stock_status = 'Low Stock';
                $stock_class = 'low';
            } else {
                $stock_status = 'In Stock';
                $stock_class = 'in';
            }
            
            $data[] = [
                'sl' => $sl++,
                'id' => $product['id'],
                'name' => $product['name'] ?? 'N/A',
                'sku' => $product['sku'] ?? 'N/A',
                'barcode' => $product['barcode'] ?? '',
                'image' => $product['image'] ?? '',
                'category_name' => $product['category_name'] ?? 'Uncategorized',
                'brand_name' => $product['brand_name'] ?? 'No Brand',
                'warranty' => $product['warranty_duration'] ?? 'No Warranty',
                'selling_price' => number_format($product['selling_price'] ?? 0, 2),
                'purchase_price' => number_format($product['purchase_price'] ?? 0, 2),
                'stock_quantity' => number_format($stock_qty),
                'stock_status' => $stock_status,
                'stock_class' => $stock_class,
                'alert_quantity' => $alert_qty
            ];
        }
        
        echo json_encode(['success' => true, 'data' => $data, 'total' => count($data)]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit();
}

// Get search value
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$per_page = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
$per_page = in_array($per_page, [10,20,50,100]) ? $per_page : 10;
$limit = $per_page;
$offset = ($page - 1) * $limit;

// Build query
$query = "SELECT p.*, 
          c.name as category_name, 
          b.name as brand_name, 
          u.name as unit_name,
          w.id as warranty_id,
          w.duration as warranty_duration
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN units u ON p.unit_id = u.id
          LEFT JOIN warranties w ON p.warranty_id = w.id
          WHERE p.status = 1";

$count_query = "SELECT COUNT(*) as total FROM products p WHERE p.status = 1";
$params = [];
$count_params = [];

if (!empty($search)) {
    $query .= " AND (
        p.name LIKE ? OR 
        p.sku LIKE ? OR 
        p.barcode LIKE ? OR 
        c.name LIKE ? OR 
        b.name LIKE ? OR 
        w.duration LIKE ? OR 
        p.selling_price LIKE ?
    )";
    $count_query .= " AND (
        p.name LIKE ? OR 
        p.sku LIKE ? OR 
        p.barcode LIKE ? OR 
        c.name LIKE ? OR 
        b.name LIKE ? OR 
        w.duration LIKE ? OR 
        p.selling_price LIKE ?
    )";
    $search_param = "%$search%";
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
    $count_params[] = $search_param;
}

$query .= " ORDER BY p.id DESC LIMIT $limit OFFSET $offset";

// Get total count
try {
    $stmt = $pdo->prepare($count_query);
    $stmt->execute($count_params);
    $total_records = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
    $total_pages = ceil($total_records / $limit);
} catch (Exception $e) {
    $total_records = 0;
    $total_pages = 0;
}

// Get products
try {
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $products = [];
}

require_once __DIR__ . '/../../includes/header.php';

// Determine active tab
$active_tab = 'product';
if (strpos($_SERVER['REQUEST_URI'], '/product/add') !== false) {
    $active_tab = 'add';
} elseif (strpos($_SERVER['REQUEST_URI'], '/product/edit') !== false) {
    $active_tab = 'edit';
}
?>

<style>
/* ============================================================
   ULTRA MODERN PRODUCT MANAGEMENT
   ============================================================ */
:root {
    --primary: #4f46e5;
    --primary-light: #818cf8;
    --primary-dark: #4338ca;
    --primary-gradient: linear-gradient(135deg, #4f46e5, #7c3aed);
    --success: #10b981;
    --success-light: #d1fae5;
    --danger: #ef4444;
    --danger-light: #fee2e2;
    --warning: #f59e0b;
    --warning-light: #fef3c7;
    --info: #3b82f6;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #334155;
    --gray-800: #1e293b;
    --gray-900: #0f172a;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 50px rgba(0,0,0,0.12);
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== PAGE CONTAINER ===== */
.page-container {
    padding: 20px 28px;
    background: var(--gray-50);
    min-height: calc(100vh - 60px);
}

/* ===== TABS ===== */
.tabs-container {
    background: #fff;
    border-radius: var(--radius-xl);
    padding: 4px;
    margin-bottom: 28px;
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-100);
    display: inline-flex;
    overflow: hidden;
}

.tab-btn {
    padding: 12px 28px;
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-500);
    cursor: pointer;
    transition: var(--transition);
    border-radius: var(--radius);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.tab-btn:hover {
    background: var(--gray-50);
    color: var(--gray-700);
}

.tab-btn.active {
    background: var(--primary-gradient);
    color: #fff;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.tab-btn i {
    font-size: 16px;
}

.tab-btn.active i {
    color: #fff;
}

/* ===== HEADER ===== */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 16px;
}

.page-header .header-left {
    display: flex;
    align-items: center;
    gap: 18px;
}

.page-header .header-left .brand-icon {
    width: 56px;
    height: 56px;
    background: var(--primary-gradient);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 26px;
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.35);
    position: relative;
}

.page-header .header-left .brand-icon::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: var(--radius-lg);
    background: var(--primary-gradient);
    opacity: 0.2;
    filter: blur(8px);
    z-index: -1;
}

.page-header .header-left .header-text h1 {
    font-size: 26px;
    font-weight: 800;
    color: var(--gray-900);
    margin: 0;
    letter-spacing: -0.5px;
}

.page-header .header-left .header-text h1 span {
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.page-header .header-left .header-text p {
    font-size: 13px;
    color: var(--gray-500);
    margin: 2px 0 0 0;
}

.page-header .header-left .header-text p i {
    margin-right: 4px;
}

.header-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 22px;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
    letter-spacing: 0.3px;
}

.btn-primary {
    background: var(--primary-gradient);
    color: #fff;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
}

.btn-success {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-success:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.btn-outline {
    background: #fff;
    color: var(--gray-700);
    border: 2px solid var(--gray-200);
}

.btn-outline:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
}

/* ===== ALERTS ===== */
.alert {
    position: relative;
    margin-bottom: 20px;
    border-radius: var(--radius);
    overflow: hidden;
    animation: slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.alert-success {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border-left: 4px solid var(--success);
}

.alert-danger {
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border-left: 4px solid var(--danger);
}

.alert-content {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
}

.alert-icon { flex-shrink: 0; font-size: 20px; }
.alert-success .alert-icon { color: var(--success); }
.alert-danger .alert-icon { color: var(--danger); }

.alert-message {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
}

.alert-success .alert-message { color: #065f46; }
.alert-danger .alert-message { color: #991b1b; }

.alert-close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: inherit;
    opacity: 0.5;
    transition: opacity 0.2s;
    padding: 0 4px;
}

.alert-close:hover { opacity: 1; }

/* ===== TABLE ===== */
.table-container {
    background: #fff;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-100);
    overflow: hidden;
    transition: var(--transition);
}

.table-container:hover {
    box-shadow: var(--shadow-md);
}

.table-container .table-header {
    padding: 12px 24px;
    border-bottom: 1px solid var(--gray-100);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    background: var(--gray-50);
}

.table-container .table-header .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.table-container .table-header .header-title i {
    color: var(--primary);
    font-size: 20px;
}

.table-container .table-header .header-title h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--gray-800);
    margin: 0;
}

.table-container .table-header .badge-count {
    background: var(--primary-gradient);
    color: #fff;
    padding: 2px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
}

/* ===== SEARCH IN HEADER ===== */
.header-search-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    max-width: 450px;
}

.header-search-wrapper .search-box {
    position: relative;
    flex: 1;
}

.header-search-wrapper .search-box input {
    width: 100%;
    padding: 8px 35px 8px 35px;
    border: 2px solid var(--gray-200);
    border-radius: 8px;
    font-size: 13px;
    color: var(--gray-700);
    background: #fff;
    transition: var(--transition);
    box-sizing: border-box;
}

.header-search-wrapper .search-box input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
}

.header-search-wrapper .search-box .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gray-400);
    font-size: 14px;
    pointer-events: none;
}

.header-search-wrapper .search-box .search-loading {
    display: none;
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--primary);
    font-size: 14px;
}

.header-search-wrapper .search-box .search-clear {
    display: none;
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--gray-400);
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
}

.header-search-wrapper .search-box .search-clear.visible { display: block; }

.header-search-wrapper .search-info {
    font-size: 13px;
    color: var(--gray-500);
    white-space: nowrap;
    padding: 4px 12px;
    background: var(--gray-50);
    border-radius: 6px;
    border: 1px solid var(--gray-200);
}

.header-search-wrapper .search-info strong {
    color: var(--gray-700);
}

/* ===== TABLE SCROLL ===== */
.table-scroll {
    overflow-x: auto;
    padding: 0 4px;
}

.modern-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
}

.modern-table thead {
    background: var(--gray-50);
}

.modern-table thead th {
    padding: 14px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--gray-500);
    border-bottom: 2px solid var(--gray-200);
    white-space: nowrap;
}

.modern-table thead th.text-right { text-align: right; }
.modern-table thead th.text-center { text-align: center; }

.modern-table tbody tr {
    border-bottom: 1px solid var(--gray-100);
    transition: var(--transition);
}

.modern-table tbody tr:last-child { border-bottom: none; }

.modern-table tbody tr:hover {
    background: var(--gray-50);
}

.modern-table tbody td {
    padding: 12px 16px;
    vertical-align: middle;
}

.modern-table tbody td.text-right { text-align: right; }
.modern-table tbody td.text-center { text-align: center; }

/* Product Image */
.product-image-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--gray-100);
}

.product-image-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.product-image-wrapper .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-400);
    font-size: 20px;
    background: var(--gray-100);
}

.product-cell {
    display: flex;
    align-items: center;
    gap: 14px;
}

.product-cell .product-name {
    font-weight: 600;
    color: var(--gray-800);
    font-size: 14px;
}

.product-cell .product-code {
    font-size: 11px;
    color: var(--gray-400);
}

.product-cell .product-code .barcode {
    color: var(--gray-400);
}

/* Category & Brand Tags */
.tag {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
}

.tag-category {
    background: #eef2ff;
    color: var(--primary);
}

.tag-brand {
    background: var(--gray-100);
    color: var(--gray-600);
}

/* Warranty */
.warranty-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
}

.warranty-badge.has {
    background: #eef2ff;
    color: var(--primary);
}

.warranty-badge.no {
    background: var(--gray-100);
    color: var(--gray-400);
}

/* Amount */
.amount {
    font-weight: 600;
}

.amount-price {
    color: var(--gray-800);
}

/* Stock Badge */
.stock-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.stock-badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
}

.stock-badge.in {
    background: var(--success-light);
    color: #059669;
}
.stock-badge.in .dot { background: #059669; }

.stock-badge.low {
    background: var(--warning-light);
    color: #d97706;
}
.stock-badge.low .dot { background: #d97706; }

.stock-badge.out {
    background: var(--danger-light);
    color: #dc2626;
}
.stock-badge.out .dot { background: #dc2626; }

.stock-badge .qty {
    font-weight: 700;
    margin-left: 2px;
}

/* ===== ACTION DROPDOWN ===== */
.action-dropdown {
    position: relative;
    display: inline-block;
}

.action-dropdown .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    color: var(--gray-400);
    padding: 6px 10px;
    border-radius: 8px;
    transition: var(--transition);
}

.action-dropdown .action-btn:hover {
    background: var(--gray-100);
    color: var(--primary);
}

.action-dropdown .action-menu {
    display: none;
    position: absolute;
    right: 0;
    top: 100%;
    background: #fff;
    min-width: 190px;
    box-shadow: var(--shadow-xl);
    border-radius: var(--radius);
    z-index: 10000;
    padding: 6px 0;
    overflow: hidden;
    border: 1px solid var(--gray-100);
    margin-top: 6px;
}

.action-dropdown .action-menu.show { display: block; }

.action-dropdown .action-menu a,
.action-dropdown .action-menu button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    color: var(--gray-700);
    text-decoration: none;
    font-size: 13px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: var(--transition);
}

.action-dropdown .action-menu a:hover,
.action-dropdown .action-menu button:hover {
    background: var(--gray-50);
    color: var(--primary);
}

.action-dropdown .action-menu a i,
.action-dropdown .action-menu button i {
    width: 18px;
    text-align: center;
}

.action-dropdown .action-menu button.delete {
    color: var(--danger);
}

.action-dropdown .action-menu button.delete:hover {
    background: var(--danger-light);
    color: #dc2626;
}

.action-dropdown .action-menu button.toggle {
    color: var(--warning);
}

.action-dropdown .action-menu button.toggle:hover {
    background: var(--warning-light);
    color: #d97706;
}

/* ===== PAGINATION ===== */
.pagination-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 24px;
    border-top: 1px solid var(--gray-100);
    background: var(--gray-50);
}

.pagination-info {
    font-size: 13px;
    color: var(--gray-500);
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}

.pagination-btn,
.pagination-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    height: 38px;
    padding: 0 14px;
    border: 1px solid var(--gray-200);
    border-radius: 8px;
    background: #fff;
    color: var(--gray-700);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
}

.pagination-btn:hover:not(.disabled),
.pagination-num:hover:not(.active) {
    background: var(--gray-50);
    border-color: var(--primary);
    color: var(--primary);
}

.pagination-num.active {
    background: var(--primary-gradient);
    color: #fff;
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.pagination-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
}

.pagination-dots {
    padding: 0 4px;
    color: var(--gray-400);
}

.pagination-perpage,
.pagination-goto {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--gray-500);
}

.pagination-perpage select,
.pagination-goto input {
    padding: 6px 10px;
    border: 1px solid var(--gray-200);
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
}

.pagination-goto input { width: 55px; text-align: center; }

.pagination-goto .goto-btn {
    padding: 6px 14px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: var(--transition);
}

.pagination-goto .goto-btn:hover {
    background: var(--primary-dark);
}

/* ===== EMPTY STATE ===== */
.empty-state {
    text-align: center;
    padding: 60px 20px;
}

.empty-state .empty-icon {
    font-size: 72px;
    color: var(--gray-300);
    margin-bottom: 16px;
}

.empty-state h3 {
    font-size: 22px;
    font-weight: 700;
    color: var(--gray-700);
    margin-bottom: 6px;
}

.empty-state p {
    color: var(--gray-400);
    font-size: 14px;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
    .page-container { padding: 14px 16px; }
    
    .tabs-container {
        flex-wrap: wrap;
        width: 100%;
    }
    
    .tab-btn {
        flex: 1;
        justify-content: center;
        padding: 10px 16px;
        font-size: 13px;
    }
    
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .page-header .header-actions {
        width: 100%;
    }
    
    .page-header .header-actions .btn {
        flex: 1;
        justify-content: center;
    }
    
    .table-container .table-header {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }
    
    .header-search-wrapper {
        max-width: 100%;
        flex-wrap: wrap;
    }
    
    .header-search-wrapper .search-info {
        font-size: 12px;
        padding: 4px 10px;
    }
    
    .modern-table {
        font-size: 12px;
    }
    
    .modern-table thead th,
    .modern-table tbody td {
        padding: 8px 10px;
    }
    
    .product-cell .product-name {
        font-size: 13px;
    }
    
    .pagination-wrapper {
        flex-direction: column;
        align-items: stretch;
    }
    
    .pagination-controls { order: 1; justify-content: center; }
    .pagination-info { order: 2; text-align: center; }
    .pagination-perpage { order: 3; justify-content: center; }
    .pagination-goto { order: 4; justify-content: center; }
}

@media (max-width: 480px) {
    .page-container { padding: 10px 12px; }
    
    .tab-btn {
        font-size: 12px;
        padding: 8px 12px;
    }
    
    .tab-btn i {
        font-size: 14px;
    }
    
    .page-header .header-left .brand-icon {
        width: 44px;
        height: 44px;
        font-size: 20px;
    }
    
    .page-header .header-left .header-text h1 {
        font-size: 20px;
    }
    
    .header-search-wrapper .search-box input {
        font-size: 12px;
        padding: 6px 30px 6px 30px;
    }
    
    .header-search-wrapper .search-info {
        font-size: 11px;
    }
    
    .modern-table {
        font-size: 11px;
    }
    
    .modern-table thead th,
    .modern-table tbody td {
        padding: 6px 8px;
    }
    
    .product-image-wrapper {
        width: 36px;
        height: 36px;
    }
    
    .product-image-wrapper .placeholder {
        font-size: 14px;
    }
    
    .pagination-btn,
    .pagination-num {
        min-width: 32px;
        height: 32px;
        font-size: 11px;
        padding: 0 8px;
    }
}

@media print {
    .no-print { display: none !important; }
    .page-container { background: white !important; padding: 0 !important; }
    .table-container { box-shadow: none !important; border: 1px solid #ddd !important; }
    .modern-table { font-size: 10px !important; }
    .modern-table td, .modern-table th { padding: 4px 6px !important; }
    .pagination-wrapper { display: none !important; }
}
</style>

<div class="page-container">
    <!-- ===== ALERTS ===== -->
    <?php if(isset($_SESSION['success'])): ?>
    <div class="alert alert-success" id="successAlert">
        <div class="alert-content">
            <div class="alert-icon"><i class="fas fa-check-circle"></i></div>
            <div class="alert-message"><?php echo safeHtml($_SESSION['success']); unset($_SESSION['success']); ?></div>
            <button class="alert-close" onclick="closeAlert(this)">&times;</button>
        </div>
    </div>
    <?php endif; ?>
    
    <?php if(isset($_SESSION['error'])): ?>
    <div class="alert alert-danger" id="errorAlert">
        <div class="alert-content">
            <div class="alert-icon"><i class="fas fa-exclamation-circle"></i></div>
            <div class="alert-message"><?php echo safeHtml($_SESSION['error']); unset($_SESSION['error']); ?></div>
            <button class="alert-close" onclick="closeAlert(this)">&times;</button>
        </div>
    </div>
    <?php endif; ?>

    <!-- ===== HEADER ===== -->
    <div class="page-header">
        <div class="header-left">
            <div class="brand-icon"><i class="fas fa-cubes"></i></div>
            <div class="header-text">
                <h1>Product <span>Management</span></h1>
                <p><i class="far fa-calendar-alt"></i> <?php echo date('d F, Y'); ?> &bull; <i class="far fa-clock"></i> <?php echo date('h:i A'); ?></p>
            </div>
        </div>
        <div class="header-actions no-print">
            <a href="/product/add" class="btn btn-primary"><i class="fas fa-plus-circle"></i> Add Product</a>
        </div>
    </div>
    
    <!-- ===== TABS ===== -->
    <div class="tabs-container no-print">
        <a href="/product" class="tab-btn <?php echo $active_tab == 'product' ? 'active' : ''; ?>">
            <i class="fas fa-list"></i> Products
        </a>
        <a href="/product/add" class="tab-btn <?php echo $active_tab == 'add' ? 'active' : ''; ?>">
            <i class="fas fa-plus-circle"></i> Add Product
        </a>
        <?php if($active_tab == 'edit'): ?>
        <a href="#" class="tab-btn active">
            <i class="fas fa-edit"></i> Edit Product
        </a>
        <?php endif; ?>
    </div>

    <!-- ===== TABLE ===== -->
    <div class="table-container">
        <div class="table-header">
            <div class="header-title">
                <i class="fas fa-list-ul"></i>
                <h3>Product List</h3>
                <span class="badge-count" id="productCount"><?php echo number_format($total_records); ?></span>
            </div>
            
            <div class="header-search-wrapper no-print">
                <div class="search-box">
                    <span class="search-icon"><i class="fas fa-search"></i></span>
                    <input type="text" 
                           id="liveSearch" 
                           placeholder="Search by Name, SKU, Category, Brand, Warranty or Price..." 
                           autocomplete="off"
                           value="<?php echo safeHtml($search); ?>">
                    <button type="button" class="search-clear <?php echo !empty($search) ? 'visible' : ''; ?>" onclick="clearSearch()">
                        <i class="fas fa-times-circle"></i>
                    </button>
                    <span class="search-loading" id="searchLoading"><i class="fas fa-spinner fa-spin"></i></span>
                </div>
                <div class="search-info" id="searchInfo">
                    <i class="far fa-file-alt"></i> <strong><?php echo count($products); ?></strong> of <strong><?php echo number_format($total_records); ?></strong>
                </div>
            </div>
        </div>

        <div class="table-scroll">
            <?php if (count($products) > 0): ?>
            <table class="modern-table" id="productTable">
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th style="width: 60px;">Image</th>
                        <th style="min-width: 180px;">Product</th>
                        <th style="min-width: 120px;">Category</th>
                        <th style="min-width: 100px;">Brand</th>
                        <th style="min-width: 80px;">Warranty</th>
                        <th class="text-right" style="min-width: 80px;">Price</th>
                        <th class="text-right" style="min-width: 80px;">Cost</th>
                        <th class="text-center" style="min-width: 100px;">Stock</th>
                        <th class="text-center no-print" style="min-width: 60px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <?php $serial = $offset + 1; foreach($products as $product): 
                        $stock_qty = isset($product['stock_quantity']) ? (int)$product['stock_quantity'] : 0;
                        $alert_qty = isset($product['alert_quantity']) ? (int)$product['alert_quantity'] : 5;
                        
                        if ($stock_qty <= 0) {
                            $stock_status = 'Out of Stock';
                            $stock_class = 'out';
                        } elseif ($stock_qty <= $alert_qty) {
                            $stock_status = 'Low Stock';
                            $stock_class = 'low';
                        } else {
                            $stock_status = 'In Stock';
                            $stock_class = 'in';
                        }
                        
                        $warranty_duration = $product['warranty_duration'] ?? '';
                        $has_warranty = !empty($warranty_duration) && $warranty_duration != 'No Warranty';
                    ?>
                    <tr>
                        <td><?php echo $serial++; ?></td>
                        <td>
                            <div class="product-image-wrapper">
                                <?php if(!empty($product['image'])): ?>
                                    <img src="/uploads/products/<?php echo safeHtml($product['image']); ?>" alt="<?php echo safeHtml($product['name']); ?>">
                                <?php else: ?>
                                    <div class="placeholder"><i class="fas fa-box"></i></div>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td>
                            <div class="product-cell">
                                <div>
                                    <div class="product-name"><?php echo safeHtml($product['name'] ?? 'N/A'); ?></div>
                                    <div class="product-code">
                                        SKU: <?php echo safeHtml($product['sku'] ?? 'N/A'); ?>
                                        <?php if(!empty($product['barcode'])): ?>
                                            <span class="barcode">| <?php echo safeHtml($product['barcode']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="tag tag-category"><?php echo safeHtml($product['category_name'] ?? 'Uncategorized'); ?></span>
                        </td>
                        <td>
                            <span class="tag tag-brand"><?php echo safeHtml($product['brand_name'] ?? 'No Brand'); ?></span>
                        </td>
                        <td>
                            <?php if($has_warranty): ?>
                                <span class="warranty-badge has"><i class="fas fa-shield-alt"></i> <?php echo safeHtml($warranty_duration); ?></span>
                            <?php else: ?>
                                <span class="warranty-badge no"><i class="fas fa-ban"></i> No Warranty</span>
                            <?php endif; ?>
                        </td>
                        <td class="text-right amount amount-price"><?php echo formatMoney($product['selling_price'] ?? 0); ?> </td>
                        <td class="text-right"><?php echo formatMoney($product['purchase_price'] ?? 0); ?> </td>
                        <td class="text-center">
                            <span class="stock-badge <?php echo $stock_class; ?>">
                                <span class="dot"></span>
                                <?php echo $stock_status; ?>
                                <span class="qty">(<?php echo number_format($stock_qty); ?>)</span>
                            </span>
                        </td>
                        <td class="text-center no-print">
                            <div class="action-dropdown">
                                <button class="action-btn" onclick="toggleActionMenu(this)"><i class="fas fa-ellipsis-v"></i></button>
                                <div class="action-menu">
                                    <a href="/product/view/<?php echo $product['id']; ?>"><i class="fas fa-eye"></i> View</a>
                                    <a href="/product/edit/<?php echo $product['id']; ?>"><i class="fas fa-edit"></i> Edit</a>
                                    <form method="POST" onsubmit="return confirm('Are you sure you want to change the status of this product?');">
                                        <input type="hidden" name="product_id" value="<?php echo $product['id']; ?>">
                                        <button type="submit" name="toggle_status" class="toggle"><i class="fas fa-ban"></i> Deactivate</button>
                                    </form>
                                    <form method="POST" onsubmit="return confirm('Are you sure you want to delete this product?');">
                                        <input type="hidden" name="product_id" value="<?php echo $product['id']; ?>">
                                        <button type="submit" name="delete_product" class="delete"><i class="fas fa-trash-alt"></i> Delete</button>
                                    </form>
                                </div>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-box-open"></i></div>
                <h3>No Products Found</h3>
                <p>Try adjusting your search criteria.</p>
                <a href="/product/add" class="btn btn-success" style="margin-top: 16px; display: inline-flex;"><i class="fas fa-plus-circle"></i> Add New Product</a>
            </div>
            <?php endif; ?>
        </div>

        <!-- ===== PAGINATION ===== -->
        <?php if ($total_pages > 1): ?>
        <div class="pagination-wrapper no-print">
            <div class="pagination-info">
                <strong><?php echo $offset + 1; ?></strong> – 
                <strong><?php echo min($offset + $limit, $total_records); ?></strong> 
                of <strong><?php echo number_format($total_records); ?></strong>
            </div>
            
            <div class="pagination-controls">
                <?php if ($page > 1): ?>
                    <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => 1])); ?>" class="pagination-btn"><i class="fas fa-angle-double-left"></i></a>
                    <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => $page - 1])); ?>" class="pagination-btn"><i class="fas fa-angle-left"></i></a>
                <?php else: ?>
                    <span class="pagination-btn disabled"><i class="fas fa-angle-double-left"></i></span>
                    <span class="pagination-btn disabled"><i class="fas fa-angle-left"></i></span>
                <?php endif; ?>
        
                <div class="pagination-numbers">
                    <?php
                    $start = max(1, $page - 2);
                    $end = min($total_pages, $page + 2);
        
                    if($start > 1) {
                        echo '<a href="?' . http_build_query(array_merge($_GET, ['page' => 1])) . '" class="pagination-num">1</a>';
                        if($start > 2) echo '<span class="pagination-dots">…</span>';
                    }
        
                    for($i = $start; $i <= $end; $i++):
                    ?>
                        <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => $i])); ?>" 
                           class="pagination-num <?php echo $i == $page ? 'active' : ''; ?>">
                            <?php echo $i; ?>
                        </a>
                    <?php endfor; ?>
        
                    <?php if($end < $total_pages): ?>
                        <?php if($end < $total_pages - 1) echo '<span class="pagination-dots">…</span>'; ?>
                        <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => $total_pages])); ?>" 
                           class="pagination-num"><?php echo $total_pages; ?></a>
                    <?php endif; ?>
                </div>
        
                <?php if ($page < $total_pages): ?>
                    <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => $page + 1])); ?>" class="pagination-btn"><i class="fas fa-angle-right"></i></a>
                    <a href="?<?php echo http_build_query(array_merge($_GET, ['page' => $total_pages])); ?>" class="pagination-btn"><i class="fas fa-angle-double-right"></i></a>
                <?php else: ?>
                    <span class="pagination-btn disabled"><i class="fas fa-angle-right"></i></span>
                    <span class="pagination-btn disabled"><i class="fas fa-angle-double-right"></i></span>
                <?php endif; ?>
            </div>
        
            <div class="pagination-perpage">
                <span>Show</span>
                <select id="perPageSelect">
                    <option value="10" <?php echo $limit == 10 ? 'selected' : ''; ?>>10</option>
                    <option value="20" <?php echo $limit == 20 ? 'selected' : ''; ?>>20</option>
                    <option value="50" <?php echo $limit == 50 ? 'selected' : ''; ?>>50</option>
                    <option value="100" <?php echo $limit == 100 ? 'selected' : ''; ?>>100</option>
                </select>
            </div>
        
            <div class="pagination-goto">
                <span>Go</span>
                <input type="number" id="goToPage" min="1" max="<?php echo $total_pages; ?>" value="<?php echo $page; ?>">
                <button id="goToPageBtn" class="goto-btn">Go</button>
            </div>
        </div>
        <?php endif; ?>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script>
// ============================================================
// GO TO PAGE FUNCTION
// ============================================================
function goToPage() {
    var pageNum = parseInt(document.getElementById('goToPage').value);
    var maxPage = parseInt(document.getElementById('goToPage').getAttribute('max'));
    if(isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if(pageNum > maxPage) pageNum = maxPage;
    var url = new URL(window.location.href);
    url.searchParams.set('page', pageNum);
    window.location.href = url.toString();
}

document.getElementById('goToPage').addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        goToPage();
    }
});

// ============================================================
// PER PAGE SELECT
// ============================================================
$('#perPageSelect').on('change', function() {
    let perPage = $(this).val();
    let url = new URL(window.location.href);
    url.searchParams.set('limit', perPage);
    url.searchParams.set('page', 1);
    window.location.href = url.toString();
});

// ============================================================
// CLEAR SEARCH
// ============================================================
function clearSearch() {
    var searchInput = document.getElementById('liveSearch');
    searchInput.value = '';
    document.querySelector('.search-clear').classList.remove('visible');
    
    var url = new URL(window.location.href);
    url.searchParams.delete('search');
    window.location.href = url.toString();
}

// ============================================================
// LIVE SEARCH - Table Update
// ============================================================
$(document).ready(function() {
    var searchInput = $('#liveSearch');
    var tableBody = $('#tableBody');
    var searchLoading = $('#searchLoading');
    var searchClear = $('.search-clear');
    var searchInfo = $('#searchInfo');
    var productCount = $('#productCount');
    var searchTimeout;
    
    // Show/hide clear button
    searchInput.on('input', function() {
        var term = $(this).val().trim();
        if (term.length > 0) {
            searchClear.addClass('visible');
        } else {
            searchClear.removeClass('visible');
        }
    });
    
    searchInput.on('keyup', function() {
        var term = $(this).val().trim();
        
        clearTimeout(searchTimeout);
        
        if(term.length < 1) {
            var url = new URL(window.location.href);
            url.searchParams.delete('search');
            window.location.href = url.toString();
            return;
        }
        
        searchLoading.show();
        
        searchTimeout = setTimeout(function() {
            $.ajax({
                url: window.location.href,
                type: 'GET',
                data: {
                    ajax_search: 1,
                    term: term
                },
                dataType: 'json',
                success: function(response) {
                    searchLoading.hide();
                    
                    if(response.success && response.data.length > 0) {
                        var html = '';
                        $.each(response.data, function(index, product) {
                            var imageHtml = product.image 
                                ? '<img src="/uploads/products/' + product.image + '" alt="' + product.name + '">'
                                : '<div class="placeholder"><i class="fas fa-box"></i></div>';
                            
                            var warrantyHtml = (product.warranty && product.warranty !== 'No Warranty')
                                ? '<span class="warranty-badge has"><i class="fas fa-shield-alt"></i> ' + product.warranty + '</span>'
                                : '<span class="warranty-badge no"><i class="fas fa-ban"></i> No Warranty</span>';
                            
                            html += '<tr style="border-bottom: 1px solid #f1f5f9;">';
                            html += '<td style="padding: 10px 12px;">' + product.sl + '</td>';
                            html += '<td style="padding: 10px 12px;"><div class="product-image-wrapper">' + imageHtml + '</div></td>';
                            html += '<td style="padding: 10px 12px;">';
                            html += '<div class="product-cell">';
                            html += '<div>';
                            html += '<div class="product-name">' + product.name + '</div>';
                            html += '<div class="product-code">SKU: ' + product.sku;
                            if(product.barcode) {
                                html += ' <span class="barcode">| ' + product.barcode + '</span>';
                            }
                            html += '</div></div></div></td>';
                            html += '<td style="padding: 10px 12px;"><span class="tag tag-category">' + product.category_name + '</span></td>';
                            html += '<td style="padding: 10px 12px;"><span class="tag tag-brand">' + product.brand_name + '</span></td>';
                            html += '<td style="padding: 10px 12px;">' + warrantyHtml + '</td>';
                            html += '<td style="padding: 10px 12px; text-align: right; font-weight: 600;">' + product.selling_price + ' </td>';
                            html += '<td style="padding: 10px 12px; text-align: right;">' + product.purchase_price + ' </td>';
                            html += '<td style="padding: 10px 12px; text-align: center;">';
                            html += '<span class="stock-badge ' + product.stock_class + '">';
                            html += '<span class="dot"></span> ' + product.stock_status;
                            html += ' <span class="qty">(' + product.stock_quantity + ')</span>';
                            html += '</span></td>';
                            html += '<td style="padding: 10px 12px; text-align: center;">';
                            html += '<div class="action-dropdown" style="position: relative; display: inline-block;">';
                            html += '<button class="action-btn" onclick="toggleActionMenu(this)" style="background: none; border: none; cursor: pointer; color: #64748b; font-size: 18px; padding: 4px 8px;">';
                            html += '<i class="fas fa-ellipsis-v"></i>';
                            html += '</button>';
                            html += '<div class="action-menu" style="display: none; position: absolute; right: 0; top: 100%; background: #fff; min-width: 190px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); border-radius: 10px; z-index: 100; margin-top: 5px; overflow: hidden; border: 1px solid #eef2f6;">';
                            html += '<a href="/product/view/' + product.id + '" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-eye" style="color: #667eea; width: 18px;"></i> View</a>';
                            html += '<a href="/product/edit/' + product.id + '" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-edit" style="color: #f59e0b; width: 18px;"></i> Edit</a>';
                            html += '<form method="POST" onsubmit="return confirm(\'Are you sure you want to change the status of this product?\');" style="margin: 0;">';
                            html += '<input type="hidden" name="product_id" value="' + product.id + '">';
                            html += '<button type="submit" name="toggle_status" class="toggle" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #d97706; text-decoration: none; font-size: 13px; background: none; border: none; cursor: pointer; width: 100%; text-align: left;">';
                            html += '<i class="fas fa-ban" style="width: 18px;"></i> Deactivate</button>';
                            html += '</form>';
                            html += '<form method="POST" onsubmit="return confirm(\'Are you sure you want to delete this product?\');" style="margin: 0;">';
                            html += '<input type="hidden" name="product_id" value="' + product.id + '">';
                            html += '<button type="submit" name="delete_product" class="delete" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 13px; background: none; border: none; cursor: pointer; width: 100%; text-align: left;">';
                            html += '<i class="fas fa-trash-alt" style="width: 18px;"></i> Delete</button>';
                            html += '</form>';
                            html += '</div></div></td>';
                            html += '</tr>';
                        });
                        
                        tableBody.html(html);
                        
                        // Update header
                        productCount.text(response.total);
                        searchInfo.html('<i class="far fa-file-alt"></i> <strong>' + response.data.length + '</strong> of <strong>' + response.total + '</strong>');
                    } else {
                        tableBody.html('<tr><td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">' +
                            '<i class="fas fa-search" style="font-size: 48px; display: block; margin-bottom: 10px; color: #cbd5e1;"></i>' +
                            'No products found for "<strong>' + term + '</strong>"' +
                            '</td></tr>');
                        productCount.text('0');
                        searchInfo.html('<i class="far fa-file-alt"></i> <strong>0</strong> of <strong>0</strong>');
                    }
                },
                error: function() {
                    searchLoading.hide();
                    tableBody.html('<tr><td colspan="10" style="text-align: center; padding: 40px; color: #ef4444;">' +
                        '<i class="fas fa-exclamation-circle" style="font-size: 48px; display: block; margin-bottom: 10px;"></i>' +
                        'Error loading results. Please try again.' +
                        '</td></tr>');
                }
            });
        }, 400);
    });
});

// ============================================================
// ACTION DROPDOWN
// ============================================================
function toggleActionMenu(btn) {
    event.stopPropagation();
    var menu = btn.nextElementSibling;
    
    document.querySelectorAll('.action-menu').forEach(function(m) {
        if (m !== menu) m.classList.remove('show');
    });
    
    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
    } else {
        menu.classList.add('show');
    }
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.action-dropdown')) {
        document.querySelectorAll('.action-menu').forEach(function(menu) {
            menu.classList.remove('show');
        });
    }
});

// ============================================================
// CLOSE ALERT
// ============================================================
function closeAlert(btn) {
    var $alert = $(btn).closest('.alert');
    $alert.fadeOut(300, function() { $(this).remove(); });
}

// ============================================================
// AUTO CLOSE ALERTS
// ============================================================
$(document).ready(function() {
    if ($('#successAlert').length) {
        setTimeout(function() { 
            $('#successAlert').fadeOut(400, function() { $(this).remove(); }); 
        }, 5000);
    }
    if ($('#errorAlert').length) {
        setTimeout(function() { 
            $('#errorAlert').fadeOut(400, function() { $(this).remove(); }); 
        }, 5000);
    }
});
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>