<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$page_title = 'Sales Management - Youth IT POS';
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

// Handle delete sale
if (isset($_POST['delete_sale']) && isset($_POST['sale_id'])) {
    $sale_id = (int)$_POST['sale_id'];
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND product_id IS NOT NULL AND product_id > 0");
        $stmt->execute([$sale_id]);
        $sale_items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($sale_items as $item) {
            $update_stock = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
            $update_stock->execute([$item['quantity'], $item['product_id']]);
        }
        
        $pdo->prepare("DELETE FROM sale_items WHERE sale_id = ?")->execute([$sale_id]);
        $pdo->prepare("DELETE FROM payments WHERE sale_id = ?")->execute([$sale_id]);
        $pdo->prepare("DELETE FROM sales WHERE id = ?")->execute([$sale_id]);
        
        $pdo->commit();
        $_SESSION['success'] = "Sale deleted successfully and products restored to stock!";
    } catch (Exception $e) {
        $pdo->rollBack();
        $_SESSION['error'] = "Failed to delete sale: " . $e->getMessage();
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

// Handle Add Payment via AJAX
if (isset($_POST['add_payment_ajax'])) {
    header('Content-Type: application/json');
    $sale_id = (int)$_POST['sale_id'];
    $amount = (float)$_POST['amount'];
    $payment_method = $_POST['payment_method'] ?? 'cash';
    $account_id = !empty($_POST['account_id']) ? (int)$_POST['account_id'] : null;
    $payment_date = $_POST['payment_date'] ?? date('Y-m-d H:i:s');
    $reference_no = $_POST['reference_no'] ?? '';
    $note = $_POST['note'] ?? '';
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $stmt->execute([$sale_id]);
        $sale = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$sale) {
            echo json_encode(['success' => false, 'error' => 'Sale not found']);
            exit();
        }
        
        $total_amount = 0;
        if (isset($sale['receivable']) && $sale['receivable'] > 0) {
            $total_amount = (float)$sale['receivable'];
        } elseif (isset($sale['total']) && $sale['total'] > 0) {
            $total_amount = (float)$sale['total'];
        } elseif (isset($sale['total_amount']) && $sale['total_amount'] > 0) {
            $total_amount = (float)$sale['total_amount'];
        } else {
            $stmt2 = $pdo->prepare("SELECT SUM(total) as total FROM sale_items WHERE sale_id = ?");
            $stmt2->execute([$sale_id]);
            $result = $stmt2->fetch(PDO::FETCH_ASSOC);
            $total_amount = (float)($result['total'] ?? 0);
        }
        
        $paid = isset($sale['paid']) ? (float)$sale['paid'] : 0;
        $new_paid = $paid + $amount;
        $new_due = $total_amount - $new_paid;
        if ($new_due < 0) {
            $new_due = 0;
            $new_paid = $total_amount;
        }
        
        $stmt = $pdo->prepare("INSERT INTO payments (sale_id, amount, payment_method, payment_date, reference_no, note, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$sale_id, $amount, $payment_method, $payment_date, $reference_no, $note]);
        
        if ($account_id && $account_id > 0) {
            $stmt = $pdo->prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?");
            $stmt->execute([$amount, $account_id]);
        }
        
        $stmt = $pdo->prepare("UPDATE sales SET paid = ?, due = ? WHERE id = ?");
        $stmt->execute([$new_paid, $new_due, $sale_id]);
        
        echo json_encode(['success' => true, 'message' => 'Payment added successfully']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit();
}

// ===== AJAX LIVE SEARCH (Products সহ) =====
if(isset($_GET['ajax_search'])) {
    header('Content-Type: application/json');
    $search = isset($_GET['term']) ? trim($_GET['term']) : '';
    
    $query = "SELECT DISTINCT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address 
              FROM sales s 
              LEFT JOIN customers c ON s.customer_id = c.id 
              LEFT JOIN sale_items si ON s.id = si.sale_id 
              LEFT JOIN products p ON si.product_id = p.id 
              WHERE 1=1";
    $params = [];
    
    if(!empty($search)) {
        $query .= " AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ? OR si.product_name LIKE ?)";
        $search_param = "%$search%";
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
    }
    
    $query .= " ORDER BY s.id DESC LIMIT 50";
    
    try {
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $data = [];
        $sl = 1;
        foreach($results as $sale) {
            $sale_id = $sale['id'];
            
            // Get products for this sale
            $stmt2 = $pdo->prepare("SELECT 
                                    si.product_id,
                                    si.quantity, 
                                    si.price, 
                                    si.total,
                                    si.serial_no,
                                    si.warranty,
                                    si.buying_price,
                                    COALESCE(p.name, si.product_name, 'Unknown Product') as product_name,
                                    p.sku
                                    FROM sale_items si 
                                    LEFT JOIN products p ON si.product_id = p.id
                                    WHERE si.sale_id = ?");
            $stmt2->execute([$sale_id]);
            $items = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            
            // Calculate totals
            $calculated_receivable = 0;
            foreach($items as $item) {
                $calculated_receivable += (float)$item['total'];
            }
            
            $discount = isset($sale['discount']) ? (float)$sale['discount'] : 0;
            $final_receivable = $calculated_receivable - $discount;
            if ($final_receivable < 0) $final_receivable = 0;
            
            $paid = isset($sale['paid']) ? (float)$sale['paid'] : 0;
            $due = $final_receivable - $paid;
            if ($due < 0) $due = 0;
            
            $invoice_no = !empty($sale['invoice_no']) ? $sale['invoice_no'] : 'INV-' . str_pad($sale['id'], 6, '0', STR_PAD_LEFT);
            
            // Product list HTML with bullet points
            $product_list_html = '';
            foreach($items as $item) {
                $pname = $item['product_name'] ?? 'Unknown Product';
                $product_list_html .= '<li style="margin-bottom:2px; font-size:12px;">' . htmlspecialchars($pname) . ' <span style="color:#94a3b8;">×' . $item['quantity'] . '</span></li>';
            }
            
            $date_str = !empty($sale['created_at']) ? $sale['created_at'] : (!empty($sale['date']) ? $sale['date'] : date('Y-m-d H:i:s'));
            try {
                $date_obj = new DateTime($date_str);
                $display_date = $date_obj->format('d M Y');
                $display_time = $date_obj->format('h:i A');
            } catch (Exception $e) {
                $timestamp = strtotime($date_str);
                $display_date = ($timestamp && $timestamp > 0) ? date('d M Y', $timestamp) : date('d M Y');
                $display_time = ($timestamp && $timestamp > 0) ? date('h:i A', $timestamp) : date('h:i A');
            }
            
            $data[] = [
                'sl' => $sl++,
                'id' => $sale['id'],
                'invoice_no' => $invoice_no,
                'customer_name' => $sale['customer_name'] ?? 'Walk-in Customer',
                'customer_phone' => $sale['customer_phone'] ?? '',
                'product_list_html' => $product_list_html,
                'date' => $display_date,
                'time' => $display_time,
                'total_amount' => number_format($final_receivable, 2),
                'paid_amount' => number_format($paid, 2),
                'due_amount' => number_format($due, 2),
                'due_class' => $due > 0 ? 'color:#ef4444;' : 'color:#10b981;',
                'status' => $due <= 0 ? 'Completed' : 'Pending',
                'status_bg' => $due <= 0 ? '#d1fae5' : '#fee2e2',
                'status_color' => $due <= 0 ? '#065f46' : '#991b1b'
            ];
        }
        
        echo json_encode(['success' => true, 'data' => $data, 'total' => count($data)]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 10;
$offset = ($page - 1) * $limit;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

// Get total count
$total_records = 0;
try {
    $count_query = "SELECT COUNT(DISTINCT s.id) as total 
                    FROM sales s 
                    LEFT JOIN customers c ON s.customer_id = c.id 
                    LEFT JOIN sale_items si ON s.id = si.sale_id 
                    LEFT JOIN products p ON si.product_id = p.id 
                    WHERE 1=1";
    $count_params = [];
    
    if(!empty($search)) {
        $count_query .= " AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ? OR si.product_name LIKE ?)";
        $search_param = "%$search%";
        $count_params[] = $search_param;
        $count_params[] = $search_param;
        $count_params[] = $search_param;
        $count_params[] = $search_param;
        $count_params[] = $search_param;
    }
    
    $stmt = $pdo->prepare($count_query);
    $stmt->execute($count_params);
    $total_records = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
} catch (Exception $e) {
    $total_records = 0;
}
$total_pages = ceil($total_records / $limit);

// Get bank accounts for payment methods
$bank_accounts = [];
try {
    $stmt = $pdo->query("SELECT id, account_name FROM bank_accounts ORDER BY account_name");
    $bank_accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $bank_accounts = [];
}

// Get sales
$sales = [];
try {
    $query = "SELECT DISTINCT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
              FROM sales s 
              LEFT JOIN customers c ON s.customer_id = c.id 
              LEFT JOIN sale_items si ON s.id = si.sale_id 
              LEFT JOIN products p ON si.product_id = p.id 
              WHERE 1=1";
    $params = [];
    
    if(!empty($search)) {
        $query .= " AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ? OR si.product_name LIKE ?)";
        $search_param = "%$search%";
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
        $params[] = $search_param;
    }
    
    $query .= " ORDER BY s.id DESC LIMIT $limit OFFSET $offset";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $sales_raw = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($sales_raw as $sale) {
        $sale_id = $sale['id'];
        
        $stmt2 = $pdo->prepare("SELECT 
                                si.product_id,
                                si.quantity, 
                                si.price, 
                                si.total,
                                si.serial_no,
                                si.warranty,
                                si.buying_price,
                                COALESCE(p.name, si.product_name, 'Unknown Product') as product_name,
                                p.sku
                                FROM sale_items si 
                                LEFT JOIN products p ON si.product_id = p.id
                                WHERE si.sale_id = ?");
        $stmt2->execute([$sale_id]);
        $products = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        
        $calculated_receivable = 0;
        foreach($products as $product) {
            $calculated_receivable += (float)$product['total'];
        }
        
        $discount = isset($sale['discount']) ? (float)$sale['discount'] : 0;
        $final_receivable = $calculated_receivable - $discount;
        if ($final_receivable < 0) $final_receivable = 0;
        
        $paid = isset($sale['paid']) ? (float)$sale['paid'] : 0;
        $due = $final_receivable - $paid;
        if ($due < 0) $due = 0;
        
        $total_cost = 0;
        foreach ($products as $product) {
            $buying_price = 0;
            if (isset($product['buying_price']) && $product['buying_price'] > 0) {
                $buying_price = (float)$product['buying_price'];
            } elseif (!empty($product['product_id'])) {
                $stmt4 = $pdo->prepare("SELECT purchase_price FROM products WHERE id = ?");
                $stmt4->execute([$product['product_id']]);
                $prod = $stmt4->fetch(PDO::FETCH_ASSOC);
                if ($prod) {
                    $buying_price = (float)$prod['purchase_price'];
                }
            }
            if ($buying_price == 0) {
                $buying_price = (float)$product['price'] * 0.7;
            }
            $total_cost += $buying_price * $product['quantity'];
        }
        
        $sale['receivable'] = $final_receivable;
        $sale['total_amount'] = $final_receivable;
        $sale['paid'] = $paid;
        $sale['due'] = $due;
        $sale['discount'] = $discount;
        $sale['total_cost'] = $total_cost;
        $sale['products'] = $products;
        
        $sales[] = $sale;
    }
    
} catch (Exception $e) {
    $sales = [];
}

require_once __DIR__ . '/../../includes/header.php';
?>

<style>
/* ============================================================
   MODERN SALES MANAGEMENT - CLEAN DESIGN
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
    --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 50px rgba(0,0,0,0.12);
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-container {
    padding: 24px 28px;
    background: var(--gray-50);
    min-height: calc(100vh - 60px);
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
    gap: 16px;
}

.page-header .header-left .brand-icon {
    width: 52px;
    height: 52px;
    background: var(--primary-gradient);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.3);
}

.page-header .header-left .header-text h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--gray-900);
    margin: 0;
    letter-spacing: -0.5px;
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
    padding: 10px 20px;
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

/* ===== ALERTS ===== */
.alert {
    position: relative;
    margin-bottom: 20px;
    border-radius: var(--radius);
    overflow: hidden;
    animation: slideDown 0.4s ease-out;
}

@keyframes slideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
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

/* ===== SEARCH BAR ===== */
.search-section {
    background: #fff;
    border-radius: var(--radius-xl);
    padding: 16px 20px;
    margin-bottom: 24px;
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-100);
}

.search-wrapper {
    position: relative;
    width: 100%;
}

.search-wrapper input {
    width: 100%;
    padding: 12px 45px 12px 45px;
    border: 2px solid var(--gray-200);
    border-radius: 10px;
    font-size: 15px;
    color: var(--gray-700);
    background: #fff;
    transition: var(--transition);
    box-sizing: border-box;
}

.search-wrapper input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
}

.search-wrapper .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gray-400);
    font-size: 16px;
    pointer-events: none;
}

.search-wrapper .search-loading {
    display: none;
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--primary);
}

/* ===== TABLE ===== */
.table-container {
    background: #fff;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-100);
    overflow: hidden;
}

.table-container .table-header {
    padding: 16px 22px;
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
    gap: 10px;
}

.table-container .table-header .header-title i {
    color: var(--primary);
    font-size: 18px;
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
    padding: 2px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
}

.table-scroll {
    overflow-x: auto;
}

.modern-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.modern-table thead {
    background: var(--gray-50);
}

.modern-table thead th {
    padding: 12px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
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

/* Invoice Link */
.invoice-link {
    color: var(--primary);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
}

.invoice-link:hover {
    text-decoration: underline;
}

/* Customer Info */
.customer-info .name {
    font-weight: 600;
    color: var(--gray-800);
}

.customer-info .phone {
    font-size: 11px;
    color: var(--gray-400);
}

/* Products List - Bullet Style */
.products-list {
    margin: 0;
    padding-left: 18px;
    list-style-type: disc;
}

.products-list li {
    margin-bottom: 2px;
    font-size: 12px;
    color: var(--gray-600);
}

.products-list li .qty {
    color: var(--gray-400);
    font-weight: 500;
}

/* Amounts */
.amount {
    font-weight: 600;
}

.amount.due {
    color: var(--danger);
}

.amount.paid {
    color: var(--success);
}

/* Status Badge */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.status-badge.completed {
    background: var(--success-light);
    color: #065f46;
}

.status-badge.pending {
    background: var(--danger-light);
    color: #991b1b;
}

.status-badge .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
}

.status-badge.completed .dot { background: var(--success); }
.status-badge.pending .dot { background: var(--danger); }

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
    padding: 8px 0;
    overflow: hidden;
    border: 1px solid var(--gray-100);
    margin-top: 5px;
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

/* ===== PAGINATION ===== */
.pagination-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 22px;
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
    min-width: 36px;
    height: 36px;
    padding: 0 12px;
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
    border-color: var(--gray-300);
}

.pagination-num.active {
    background: var(--primary-gradient);
    color: #fff;
    border-color: var(--primary);
}

.pagination-btn.disabled,
.pagination-num.disabled {
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
    padding: 5px 10px;
    border: 1px solid var(--gray-200);
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
}

.pagination-goto input { width: 55px; text-align: center; }

.pagination-goto .goto-btn {
    padding: 5px 14px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: var(--transition);
}

.pagination-goto .goto-btn:hover {
    background: var(--primary-dark);
}

/* ===== PAYMENT MODAL ===== */
.modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(6px);
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.payment-modal-container {
    background: #fff;
    border-radius: var(--radius-xl);
    width: 92%;
    max-width: 440px;
    box-shadow: var(--shadow-xl);
    animation: modalSlideIn 0.3s ease-out;
    overflow: hidden;
}

@keyframes modalSlideIn {
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.payment-modal-header {
    position: relative;
    padding: 20px 24px 16px;
    text-align: center;
    background: linear-gradient(135deg, #f8fafc 0%, #fff 100%);
    border-bottom: 1px solid var(--gray-100);
}

.payment-modal-icon {
    width: 52px;
    height: 52px;
    background: var(--primary-gradient);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 10px;
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.25);
}

.payment-modal-icon i { font-size: 24px; color: white; }

.payment-modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--gray-800);
}

.payment-modal-close {
    position: absolute;
    top: 14px;
    right: 18px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--gray-400);
    transition: var(--transition);
}

.payment-modal-close:hover { color: var(--gray-600); }

.payment-modal-body {
    padding: 20px 24px 24px;
    max-height: 70vh;
    overflow-y: auto;
}

.payment-info-card {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
    border: 1px solid var(--gray-200);
}

.payment-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
}

.payment-info-row:first-child {
    border-bottom: 1px solid var(--gray-200);
    margin-bottom: 4px;
    padding-bottom: 8px;
}

.payment-info-label { font-size: 12px; color: var(--gray-500); font-weight: 500; }
.payment-info-value { font-size: 14px; font-weight: 600; color: var(--gray-800); }
.payment-info-value.due { color: var(--danger); font-size: 18px; font-weight: 700; }

.payment-row-2col {
    display: flex;
    gap: 14px;
}

.payment-row-2col .payment-form-group { flex: 1; }

.payment-form-group { margin-bottom: 16px; }

.payment-form-group label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    font-weight: 600;
    color: var(--gray-600);
}

.payment-form-group input,
.payment-form-group select,
.payment-form-group textarea {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid var(--gray-200);
    border-radius: 10px;
    font-size: 14px;
    transition: var(--transition);
    box-sizing: border-box;
    font-family: inherit;
    background: #fff;
}

.payment-form-group input:focus,
.payment-form-group select:focus,
.payment-form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
}

.payment-form-group input[type="number"] {
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-800);
}

.payment-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
}

.payment-btn-cancel {
    background: var(--gray-100);
    border: none;
    padding: 10px 24px;
    border-radius: 40px;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-600);
    cursor: pointer;
    transition: var(--transition);
}

.payment-btn-cancel:hover { background: var(--gray-200); }

.payment-btn-submit {
    background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
    border: none;
    padding: 10px 28px;
    border-radius: 40px;
    font-size: 13px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.payment-btn-submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
}

.payment-btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
}

/* ===== EMPTY STATE ===== */
.empty-state {
    text-align: center;
    padding: 60px 20px;
}

.empty-state .empty-icon {
    font-size: 64px;
    color: var(--gray-300);
    margin-bottom: 16px;
}

.empty-state h3 {
    font-size: 20px;
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
    
    .modern-table {
        font-size: 12px;
    }
    
    .modern-table thead th,
    .modern-table tbody td {
        padding: 8px 10px;
    }
    
    .pagination-wrapper {
        flex-direction: column;
        align-items: stretch;
    }
    
    .pagination-controls { order: 1; justify-content: center; }
    .pagination-info { order: 2; text-align: center; }
    .pagination-perpage { order: 3; justify-content: center; }
    .pagination-goto { order: 4; justify-content: center; }
    
    .payment-modal-container {
        width: 96%;
        max-width: 96%;
        border-radius: var(--radius-lg);
    }
    
    .payment-row-2col { flex-direction: column; gap: 0; }
    .payment-buttons { flex-direction: column; }
    .payment-btn-cancel, .payment-btn-submit { width: 100%; justify-content: center; }
}

@media (max-width: 480px) {
    .page-container { padding: 10px 12px; }
    
    .page-header .header-left .brand-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
    }
    
    .page-header .header-left .header-text h1 {
        font-size: 18px;
    }
    
    .modern-table {
        font-size: 11px;
    }
    
    .modern-table thead th,
    .modern-table tbody td {
        padding: 6px 8px;
    }
    
    .pagination-btn,
    .pagination-num {
        min-width: 30px;
        height: 30px;
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
    .search-section { display: none !important; }
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
            <div class="brand-icon"><i class="fas fa-file-invoice"></i></div>
            <div class="header-text">
                <h1>Sales Management</h1>
                <p><i class="far fa-calendar-alt"></i> <?php echo date('d F, Y'); ?> &bull; <i class="far fa-clock"></i> <?php echo date('h:i A'); ?></p>
            </div>
        </div>
        <div class="header-actions no-print">
            <a href="pos.php" class="btn btn-primary"><i class="fas fa-plus-circle"></i> New Sale</a>
        </div>
    </div>

    <!-- ===== LIVE SEARCH BAR ===== -->
    <div class="search-section no-print">
        <div class="search-wrapper">
            <span class="search-icon"><i class="fas fa-search"></i></span>
            <input type="text" 
                   id="liveSearch" 
                   placeholder="Search by Invoice No, Customer Name, Phone or Product (Type to search)..." 
                   autocomplete="off">
            <span class="search-loading" id="searchLoading"><i class="fas fa-spinner fa-spin"></i></span>
        </div>
    </div>

    <!-- ===== TABLE ===== -->
    <div class="table-container">
        <div class="table-header">
            <div class="header-title">
                <i class="fas fa-list-ul"></i>
                <h3>Sales List</h3>
                <span class="badge-count"><?php echo number_format($total_records); ?></span>
            </div>
            <div class="showing-info no-print">
                <i class="far fa-file-alt"></i> Showing <?php echo count($sales); ?> of <?php echo number_format($total_records); ?>
            </div>
        </div>

        <div class="table-scroll" id="tableContainer">
            <?php if (count($sales) > 0): ?>
            <table class="modern-table" id="salesTable">
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th style="min-width: 120px;">Invoice</th>
                        <th style="min-width: 150px;">Customer</th>
                        <th style="min-width: 200px;">Products</th>
                        <th style="min-width: 100px;">Date</th>
                        <th class="text-right" style="min-width: 80px;">Amount</th>
                        <th class="text-right" style="min-width: 80px;">Paid</th>
                        <th class="text-right" style="min-width: 80px;">Due</th>
                        <th class="text-center" style="min-width: 90px;">Status</th>
                        <th class="text-center no-print" style="min-width: 60px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <?php $serial = $offset + 1; foreach($sales as $sale): 
                        $total_amount = isset($sale['receivable']) ? (float)$sale['receivable'] : 0;
                        $paid_amount = isset($sale['paid']) ? (float)$sale['paid'] : 0;
                        $due = isset($sale['due']) ? (float)$sale['due'] : 0;
                        
                        $status_text = ($due <= 0) ? 'Completed' : 'Pending';
                        $invoice_no = !empty($sale['invoice_no']) ? $sale['invoice_no'] : 'INV-' . str_pad($sale['id'], 6, '0', STR_PAD_LEFT);
                        $status_class = ($due <= 0) ? 'completed' : 'pending';
                        
                        $date_str = !empty($sale['created_at']) ? $sale['created_at'] : (!empty($sale['date']) ? $sale['date'] : date('Y-m-d H:i:s'));
                        try {
                            $date_obj = new DateTime($date_str);
                            $display_date = $date_obj->format('d M Y');
                            $display_time = $date_obj->format('h:i A');
                        } catch (Exception $e) {
                            $timestamp = strtotime($date_str);
                            $display_date = ($timestamp && $timestamp > 0) ? date('d M Y', $timestamp) : date('d M Y');
                            $display_time = ($timestamp && $timestamp > 0) ? date('h:i A', $timestamp) : date('h:i A');
                        }
                    ?>
                    <tr>
                        <td><?php echo $serial++; ?></td>
                        <td>
                            <a href="invoice.php?id=<?php echo $sale['id']; ?>" target="_blank" class="invoice-link">
                                <?php echo safeHtml($invoice_no); ?>
                            </a>
                        </td>
                        <td>
                            <div class="customer-info">
                                <div class="name"><?php echo safeHtml($sale['customer_name'] ?? 'Walk-in Customer'); ?></div>
                                <?php if(!empty($sale['customer_phone'])): ?>
                                    <div class="phone"><i class="fas fa-phone"></i> <?php echo safeHtml($sale['customer_phone']); ?></div>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td>
                            <?php if(!empty($sale['products'])): ?>
                                <ul class="products-list">
                                    <?php 
                                    $shown = 0;
                                    foreach($sale['products'] as $product):
                                        if($shown >= 5) {
                                            echo '<li style="color: var(--gray-400); font-style: italic;">+' . (count($sale['products']) - 5) . ' more</li>';
                                            break;
                                        }
                                        $pname = !empty($product['product_name']) ? $product['product_name'] : 'Unknown';
                                    ?>
                                        <li>
                                            <?php echo safeHtml($pname); ?>
                                            <span class="qty">×<?php echo $product['quantity']; ?></span>
                                        </li>
                                    <?php 
                                        $shown++;
                                    endforeach; 
                                    ?>
                                </ul>
                            <?php else: ?>
                                <span style="color: var(--gray-400); font-size: 12px;">—</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <div style="font-weight: 500;"><?php echo $display_date; ?></div>
                            <div style="font-size: 10px; color: var(--gray-400);"><?php echo $display_time; ?></div>
                        </td>
                        <td class="text-right amount"><?php echo formatMoney($total_amount); ?></td>
                        <td class="text-right amount paid"><?php echo formatMoney($paid_amount); ?></td>
                        <td class="text-right amount <?php echo $due > 0 ? 'due' : ''; ?>">
                            <?php echo formatMoney($due); ?>
                        </td>
                        <td class="text-center">
                            <span class="status-badge <?php echo $status_class; ?>">
                                <span class="dot"></span>
                                <?php echo $status_text; ?>
                            </span>
                        </td>
                        <td class="text-center no-print">
                            <div class="action-dropdown">
                                <button class="action-btn" onclick="toggleActionMenu(this)"><i class="fas fa-ellipsis-v"></i></button>
                                <div class="action-menu">
                                    <a href="invoice.php?id=<?php echo $sale['id']; ?>" target="_blank"><i class="fas fa-eye"></i> View</a>
                                    <a href="javascript:void(0);" onclick="printInvoiceDirect(<?php echo $sale['id']; ?>); closeActionMenu(this)"><i class="fas fa-print"></i> Print</a>
                                    <a href="chalan.php?id=<?php echo $sale['id']; ?>" onclick="closeActionMenu(this)"><i class="fas fa-truck"></i> Chalan</a>
                                    <a href="edit-sale.php?id=<?php echo $sale['id']; ?>" onclick="closeActionMenu(this)"><i class="fas fa-edit"></i> Edit</a>
                                    <?php if($due > 0): ?>
                                    <a href="javascript:void(0);" onclick="showPaymentModal(<?php echo $sale['id']; ?>, '<?php echo safeHtml($invoice_no); ?>', <?php echo $due; ?>); closeActionMenu(this)"><i class="fas fa-hand-holding-usd"></i> Payment</a>
                                    <?php endif; ?>
                                    <form method="POST" onsubmit="return confirm('Delete this sale? This will restore all products to stock!');">
                                        <input type="hidden" name="sale_id" value="<?php echo $sale['id']; ?>">
                                        <button type="submit" name="delete_sale" class="delete" onclick="closeActionMenu(this)"><i class="fas fa-trash-alt"></i> Delete</button>
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
                <div class="empty-icon"><i class="fas fa-file-invoice"></i></div>
                <h3>No Sales Found</h3>
                <p>Try adjusting your search criteria.</p>
                <a href="pos.php" class="btn btn-primary" style="margin-top: 16px; display: inline-flex;"><i class="fas fa-plus-circle"></i> Create New Sale</a>
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

<!-- ===== PAYMENT MODAL ===== -->
<div id="paymentModal" class="modal-overlay">
    <div class="payment-modal-container">
        <div class="payment-modal-header">
            <div class="payment-modal-icon"><i class="fas fa-hand-holding-usd"></i></div>
            <h3>Add Payment</h3>
            <button class="payment-modal-close" onclick="closePaymentModal()">&times;</button>
        </div>
        <div id="paymentContent" class="payment-modal-body">
            <div style="text-align:center; padding:40px;">
                <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i>
                <p style="margin-top:10px; color: var(--gray-500);">Loading...</p>
            </div>
        </div>
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
// LIVE SEARCH - Table Update (Like purchase.php)
// ============================================================
$(document).ready(function() {
    var searchInput = $('#liveSearch');
    var tableBody = $('#tableBody');
    var searchLoading = $('#searchLoading');
    var searchTimeout;
    
    searchInput.on('keyup', function() {
        var term = $(this).val().trim();
        
        clearTimeout(searchTimeout);
        
        if(term.length < 1) {
            location.reload();
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
                        $.each(response.data, function(index, sale) {
                            html += '<tr style="border-bottom: 1px solid #f1f5f9;">';
                            html += '<td style="padding: 10px 12px;">' + sale.sl + '</td>';
                            html += '<td style="padding: 10px 12px;">';
                            html += '<a href="invoice.php?id=' + sale.id + '" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 500;">';
                            html += sale.invoice_no;
                            html += '</a></td>';
                            html += '<td style="padding: 10px 12px;">';
                            html += '<div style="font-weight: 600; color: #1e293b;">' + sale.customer_name + '</div>';
                            if(sale.customer_phone) {
                                html += '<div style="font-size: 11px; color: #94a3b8;"><i class="fas fa-phone"></i> ' + sale.customer_phone + '</div>';
                            }
                            html += '</td>';
                            html += '<td style="padding: 10px 12px;"><ul style="margin:0; padding-left:18px; list-style-type:disc;">' + sale.product_list_html + '</ul></td>';
                            html += '<td style="padding: 10px 12px;">';
                            html += '<div style="font-weight: 500;">' + sale.date + '</div>';
                            html += '<div style="font-size: 10px; color: #94a3b8;">' + sale.time + '</div>';
                            html += '</td>';
                            html += '<td style="padding: 10px 12px; text-align: right; font-weight: 600;">' + sale.total_amount + '</td>';
                            html += '<td style="padding: 10px 12px; text-align: right; color: #10b981;">' + sale.paid_amount + '</td>';
                            html += '<td style="padding: 10px 12px; text-align: right; ' + sale.due_class + ' font-weight: 600;">' + sale.due_amount + '</td>';
                            html += '<td style="padding: 10px 12px; text-align: center;">';
                            html += '<span style="background: ' + sale.status_bg + '; color: ' + sale.status_color + '; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;">';
                            html += '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:' + (sale.status === 'Completed' ? '#10b981' : '#ef4444') + '; margin-right:6px;"></span>';
                            html += sale.status;
                            html += '</span></td>';
                            html += '<td style="padding: 10px 12px; text-align: center;">';
                            html += '<div class="action-dropdown" style="position: relative; display: inline-block;">';
                            html += '<button class="action-btn" onclick="toggleActionMenu(this)" style="background: none; border: none; cursor: pointer; color: #64748b; font-size: 18px; padding: 4px 8px;">';
                            html += '<i class="fas fa-ellipsis-v"></i>';
                            html += '</button>';
                            html += '<div class="action-menu" style="display: none; position: absolute; right: 0; top: 100%; background: #fff; min-width: 190px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); border-radius: 10px; z-index: 100; margin-top: 5px; overflow: hidden; border: 1px solid #eef2f6;">';
                            html += '<a href="invoice.php?id=' + sale.id + '" target="_blank" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-eye" style="color: #667eea; width: 18px;"></i> View</a>';
                            html += '<a href="javascript:void(0);" onclick="printInvoiceDirect(' + sale.id + '); closeActionMenu(this)" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-print" style="color: #667eea; width: 18px;"></i> Print</a>';
                            html += '<a href="chalan.php?id=' + sale.id + '" onclick="closeActionMenu(this)" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-truck" style="color: #f59e0b; width: 18px;"></i> Chalan</a>';
                            html += '<a href="edit-sale.php?id=' + sale.id + '" onclick="closeActionMenu(this)" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                            html += '<i class="fas fa-edit" style="color: #f59e0b; width: 18px;"></i> Edit</a>';
                            
                            var dueAmount = parseFloat(sale.due_amount);
                            if(dueAmount > 0) {
                                html += '<a href="javascript:void(0);" onclick="showPaymentModal(' + sale.id + ', \'' + sale.invoice_no + '\', ' + dueAmount + '); closeActionMenu(this)" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #475569; text-decoration: none; font-size: 13px; border-bottom: 1px solid #f1f5f9;">';
                                html += '<i class="fas fa-hand-holding-usd" style="color: #10b981; width: 18px;"></i> Payment</a>';
                            }
                            
                            html += '<form method="POST" onsubmit="return confirm(\'Delete this sale? This will restore all products to stock!\');" style="margin: 0;">';
                            html += '<input type="hidden" name="sale_id" value="' + sale.id + '">';
                            html += '<button type="submit" name="delete_sale" class="delete" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 13px; background: none; border: none; cursor: pointer; width: 100%; text-align: left;">';
                            html += '<i class="fas fa-trash-alt" style="width: 18px;"></i> Delete</button>';
                            html += '</form>';
                            html += '</div></div></td>';
                            html += '</tr>';
                        });
                        
                        tableBody.html(html);
                        
                        // Update header badge count
                        $('.badge-count').text(response.total);
                        $('.showing-info').text('Showing ' + response.data.length + ' of ' + response.total);
                    } else {
                        tableBody.html('<tr><td colspan="10" style="text-align: center; padding: 40px; color: #94a3b8;">' +
                            '<i class="fas fa-search" style="font-size: 48px; display: block; margin-bottom: 10px; color: #cbd5e1;"></i>' +
                            'No sales found for "<strong>' + term + '</strong>"' +
                            '</td></tr>');
                        $('.badge-count').text('0');
                        $('.showing-info').text('Showing 0 of 0');
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

function closeActionMenu(element) {
    var menu = element.closest('.action-menu');
    if (menu) menu.classList.remove('show');
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
// PRINT INVOICE
// ============================================================
function printInvoiceDirect(saleId) {
    var printWindow = window.open('invoice.php?id=' + saleId, '_blank');
    printWindow.focus();
    setTimeout(function() { printWindow.print(); }, 1000);
}

// ============================================================
// PAYMENT MODAL
// ============================================================
var bankAccounts = <?php echo json_encode($bank_accounts); ?>;

function showPaymentModal(saleId, invoiceNo, dueAmount) {
    $('#paymentModal').fadeIn(200);
    
    var paymentOptions = '';
    if (bankAccounts.length > 0) {
        paymentOptions += '<option value="cash" data-account-id="">💵 Cash</option>';
        for (var i = 0; i < bankAccounts.length; i++) {
            var account = bankAccounts[i];
            if (account.account_name !== 'CASH') {
                paymentOptions += '<option value="' + account.account_name.toLowerCase().replace(/ /g, '_') + '" data-account-id="' + account.id + '">🏦 ' + escapeHtml(account.account_name) + '</option>';
            }
        }
    } else {
        paymentOptions = '<option value="cash">💵 Cash</option>';
    }
    
    $('#paymentContent').html(`
        <form id="paymentForm" method="POST">
            <input type="hidden" name="sale_id" value="${saleId}">
            <input type="hidden" name="add_payment_ajax" value="1">
            <input type="hidden" name="original_due" value="${dueAmount}" id="originalDue">
            
            <div class="payment-info-card">
                <div class="payment-info-row">
                    <span class="payment-info-label">📄 Invoice No:</span>
                    <span class="payment-info-value">${escapeHtml(invoiceNo)}</span>
                </div>
                <div class="payment-info-row">
                    <span class="payment-info-label">💰 Due Amount:</span>
                    <span class="payment-info-value due" id="displayDue">${formatMoney(dueAmount)}</span>
                </div>
            </div>
            
            <div class="payment-form-group">
                <label>Payment Amount *</label>
                <input type="number" name="amount" id="paymentAmount" step="0.01" value="${dueAmount}" required>
            </div>
            
            <div class="payment-row-2col">
                <div class="payment-form-group">
                    <label>Payment Method</label>
                    <select name="payment_method" id="paymentMethodSelect">
                        ${paymentOptions}
                    </select>
                </div>
                <input type="hidden" name="account_id" id="selectedAccountId" value="">
                
                <div class="payment-form-group">
                    <label>Payment Date</label>
                    <input type="datetime-local" name="payment_date" value="${getCurrentDateTime()}">
                </div>
            </div>
            
            <div class="payment-form-group">
                <label>Reference No <span style="color: var(--gray-400); font-weight: 400;">(Optional)</span></label>
                <input type="text" name="reference_no" placeholder="Transaction ID, Check No...">
            </div>
            
            <div class="payment-form-group">
                <label>Note <span style="color: var(--gray-400); font-weight: 400;">(Optional)</span></label>
                <textarea name="note" rows="2" placeholder="Enter any note..."></textarea>
            </div>
            
            <div class="payment-buttons">
                <button type="button" onclick="closePaymentModal()" class="payment-btn-cancel">Cancel</button>
                <button type="submit" class="payment-btn-submit" id="submitPaymentBtn"><i class="fas fa-save"></i> Save Payment</button>
            </div>
        </form>
    `);
    
    $('#paymentMethodSelect').on('change', function() {
        var selectedOption = $(this).find('option:selected');
        var accountId = selectedOption.data('account-id') || '';
        $('#selectedAccountId').val(accountId);
    });
    
    $('#paymentAmount').on('input keyup change', function() {
        let originalDue = parseFloat($('#originalDue').val());
        let paymentAmount = parseFloat($(this).val()) || 0;
        
        if (paymentAmount > originalDue) {
            $(this).val(originalDue);
            paymentAmount = originalDue;
            alert('Payment amount cannot exceed due amount!');
        }
        
        let newDue = originalDue - paymentAmount;
        if (newDue < 0) newDue = 0;
        $('#displayDue').text(formatMoney(newDue));
        
        if (newDue <= 0) {
            $('#displayDue').css('color', '#10b981');
        } else {
            $('#displayDue').css('color', '#ef4444');
        }
    });
    
    $('#paymentForm').off('submit').on('submit', function(e) {
        e.preventDefault();
        
        let paymentAmount = parseFloat($('#paymentAmount').val()) || 0;
        let originalDue = parseFloat($('#originalDue').val());
        
        if (paymentAmount <= 0) {
            alert('Please enter a valid payment amount');
            return false;
        }
        
        if (paymentAmount > originalDue) {
            alert('Payment amount cannot exceed due amount!');
            return false;
        }
        
        var submitBtn = $('#submitPaymentBtn');
        var originalText = submitBtn.html();
        submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Processing...').prop('disabled', true);
        
        $.ajax({
            url: window.location.href,
            type: 'POST',
            data: $(this).serialize(),
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    alert('✅ Payment added successfully!');
                    closePaymentModal();
                    location.reload();
                } else {
                    alert('❌ Error: ' + (response.error || 'Failed to add payment'));
                    submitBtn.html(originalText).prop('disabled', false);
                }
            },
            error: function(xhr, status, error) {
                console.log('AJAX Error:', error);
                alert('❌ Error processing payment. Please try again.');
                submitBtn.html(originalText).prop('disabled', false);
            }
        });
        
        return false;
    });
}

function closePaymentModal() { 
    $('#paymentModal').fadeOut(200); 
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function formatMoney(amount) { 
    return parseFloat(amount).toFixed(2); 
}

function getCurrentDateTime() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + 'T' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

$(window).click(function(e) {
    if ($(e.target).is('#paymentModal')) closePaymentModal();
});

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