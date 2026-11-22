<?php
$page_title = 'Add Product - Youth IT POS';
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

// Create brands table if not exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS brands (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        logo VARCHAR(255),
        status TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) {
    // Table creation failed but continue
}

// Create warranties table if not exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS warranties (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        duration VARCHAR(50) NOT NULL,
        status TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) {
    // Table creation failed but continue
}

// Create units table if not exists
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS units (
        id INT(11) AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        status TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
} catch (Exception $e) {
    // Table creation failed but continue
}

// Check and add missing columns to products table
try {
    $stmt = $pdo->query("SHOW COLUMNS FROM products");
    $existing_columns = [];
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existing_columns[] = $row['Field'];
    }
    
    if (!in_array('brand_id', $existing_columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN brand_id INT(11) NULL AFTER category_id");
    }
    
    if (!in_array('warranty_id', $existing_columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN warranty_id INT(11) NULL AFTER brand_id");
    }
    
    if (!in_array('unit_id', $existing_columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN unit_id INT(11) NULL AFTER warranty_id");
    }
    
    if (!in_array('description', $existing_columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN description TEXT NULL AFTER alert_quantity");
    }
    
    if (!in_array('image', $existing_columns)) {
        $pdo->exec("ALTER TABLE products ADD COLUMN image VARCHAR(255) NULL AFTER description");
    }
} catch (Exception $e) {
    // Columns may already exist
}

// Get categories for dropdown
$categories = [];
try {
    $stmt = $pdo->query("SELECT id, name FROM categories WHERE status = 1 ORDER BY name");
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $categories = [];
}

// Get brands for dropdown
$brands = [];
try {
    $stmt = $pdo->query("SELECT id, name FROM brands WHERE status = 1 ORDER BY name");
    $brands = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $brands = [];
}

// Get warranties for dropdown
$warranties = [];
try {
    $stmt = $pdo->query("SELECT id, duration FROM warranties WHERE status = 1 ORDER BY duration");
    $warranties = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $warranties = [];
}

// Get units for dropdown
$units = [];
try {
    $stmt = $pdo->query("SELECT id, name FROM units WHERE status = 1 ORDER BY name");
    $units = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $units = [];
}

$success = '';
$error = '';

// Handle Add Category via POST
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['add_category'])) {
    $cat_name = trim($_POST['category_name']);
    if (!empty($cat_name)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO categories (name, status) VALUES (?, 1)");
            $stmt->execute([$cat_name]);
            $success = "Category added successfully!";
            $stmt = $pdo->query("SELECT id, name FROM categories WHERE status = 1 ORDER BY name");
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $error = "Error adding category: " . $e->getMessage();
        }
    } else {
        $error = "Please enter category name!";
    }
}

// Handle Add Brand via POST
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['add_brand'])) {
    $brand_name = trim($_POST['brand_name']);
    if (!empty($brand_name)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO brands (name, status) VALUES (?, 1)");
            $stmt->execute([$brand_name]);
            $success = "Brand added successfully!";
            $stmt = $pdo->query("SELECT id, name FROM brands WHERE status = 1 ORDER BY name");
            $brands = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $error = "Error adding brand: " . $e->getMessage();
        }
    } else {
        $error = "Please enter brand name!";
    }
}

// Handle Add Warranty via POST
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['add_warranty'])) {
    $warranty_duration = trim($_POST['warranty_duration']);
    if (!empty($warranty_duration)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO warranties (duration, status) VALUES (?, 1)");
            $stmt->execute([$warranty_duration]);
            $success = "Warranty added successfully!";
            $stmt = $pdo->query("SELECT id, duration FROM warranties WHERE status = 1 ORDER BY duration");
            $warranties = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $error = "Error adding warranty: " . $e->getMessage();
        }
    } else {
        $error = "Please enter warranty duration!";
    }
}

// Handle Add Unit via POST
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['add_unit'])) {
    $unit_name = trim($_POST['unit_name']);
    if (!empty($unit_name)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO units (name, status) VALUES (?, 1)");
            $stmt->execute([$unit_name]);
            $success = "Unit added successfully!";
            $stmt = $pdo->query("SELECT id, name FROM units WHERE status = 1 ORDER BY name");
            $units = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $error = "Error adding unit: " . $e->getMessage();
        }
    } else {
        $error = "Please enter unit name!";
    }
}

// Handle Add Product
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['add_product'])) {
    $name = trim($_POST['name']);
    $sku = trim($_POST['sku']);
    $category_id = !empty($_POST['category_id']) ? (int)$_POST['category_id'] : null;
    $brand_id = !empty($_POST['brand_id']) ? (int)$_POST['brand_id'] : null;
    $warranty_id = !empty($_POST['warranty_id']) ? (int)$_POST['warranty_id'] : null;
    $unit_id = !empty($_POST['unit_id']) ? (int)$_POST['unit_id'] : null;
    $purchase_price = floatval($_POST['purchase_price']);
    $selling_price = floatval($_POST['selling_price']);
    $stock_quantity = intval($_POST['stock_quantity']);
    $alert_quantity = intval($_POST['alert_quantity']);
    $description = trim($_POST['description']);
    
    // ===== IMAGE UPLOAD - FIXED: রুট ফোল্ডারে আপলোড হবে =====
    $image_name = '';
    if (isset($_FILES['product_image']) && $_FILES['product_image']['error'] == 0) {
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $file_type = $_FILES['product_image']['type'];
        $file_size = $_FILES['product_image']['size'];
        $max_size = 2 * 1024 * 1024; // 2MB
        
        if ($file_size > $max_size) {
            $error = "File size too large! Maximum 2MB allowed.";
        } elseif (!in_array($file_type, $allowed_types)) {
            $error = "Only JPG, PNG, GIF, and WEBP images are allowed.";
        } else {
            // রুট ডিরেক্টরিতে uploads/products ফোল্ডার (2 লেভেল উপরে)
            $upload_dir = dirname(__DIR__, 2) . '/uploads/products/';
            
            // ফোল্ডার তৈরি করুন যদি না থাকে
            if (!file_exists($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }
            
            if (is_writable($upload_dir)) {
                $file_extension = strtolower(pathinfo($_FILES['product_image']['name'], PATHINFO_EXTENSION));
                $image_name = time() . '_' . uniqid() . '.' . $file_extension;
                $upload_path = $upload_dir . $image_name;
                
                if (!move_uploaded_file($_FILES['product_image']['tmp_name'], $upload_path)) {
                    $error = "Failed to upload image. Please check directory permissions.";
                    $image_name = '';
                }
            } else {
                $error = "Upload directory is not writable. Please check permissions.";
            }
        }
    }
    
    // Check if SKU already exists
    if (!empty($sku) && empty($error)) {
        $stmt = $pdo->prepare("SELECT id FROM products WHERE sku = ?");
        $stmt->execute([$sku]);
        if ($stmt->fetch()) {
            $error = 'SKU already exists!';
        }
    }
    
    if (empty($error)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO products (name, sku, category_id, brand_id, warranty_id, unit_id, purchase_price, selling_price, stock_quantity, alert_quantity, description, image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
            $stmt->execute([$name, $sku, $category_id, $brand_id, $warranty_id, $unit_id, $purchase_price, $selling_price, $stock_quantity, $alert_quantity, $description, $image_name]);
            $success = 'Product added successfully!';
            
            // Clear POST data after successful submission
            $_POST = [];
            $_FILES = [];
        } catch (Exception $e) {
            $error = 'Error: ' . $e->getMessage();
        }
    }
}

// Store form data in session to retain after modal submission
if (isset($_POST['add_category']) || isset($_POST['add_brand']) || isset($_POST['add_warranty']) || isset($_POST['add_unit'])) {
    // Store current form data in session
    $_SESSION['product_form_data'] = [
        'name' => $_POST['name'] ?? '',
        'sku' => $_POST['sku'] ?? '',
        'category_id' => $_POST['category_id'] ?? '',
        'brand_id' => $_POST['brand_id'] ?? '',
        'warranty_id' => $_POST['warranty_id'] ?? '',
        'unit_id' => $_POST['unit_id'] ?? '',
        'purchase_price' => $_POST['purchase_price'] ?? '',
        'selling_price' => $_POST['selling_price'] ?? '',
        'stock_quantity' => $_POST['stock_quantity'] ?? '',
        'alert_quantity' => $_POST['alert_quantity'] ?? '',
        'description' => $_POST['description'] ?? ''
    ];
    // Redirect to refresh page and show updated dropdowns
    header('Location: /product/add');
    exit;
}

// Retrieve form data from session if exists
$form_data = $_SESSION['product_form_data'] ?? [];
// Clear session after retrieving
unset($_SESSION['product_form_data']);

// Merge with POST data
$form_data = array_merge($_POST, $form_data);

// Get current date and time
$current_date = date('d F, Y');
$current_time = date('h:i A');

require_once __DIR__ . '/../../includes/header.php';

// Determine active tab
$active_tab = 'add';
?>

<style>
/* ============================================================
   MODERN ADD PRODUCT - SAME AS INDEX PAGE
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

/* ===== FORM CARD ===== */
.form-card {
    background: #fff;
    border-radius: var(--radius-xl);
    padding: 30px 32px;
    box-shadow: var(--shadow);
    border: 1px solid var(--gray-100);
    transition: var(--transition);
}

.form-card:hover {
    box-shadow: var(--shadow-md);
}

.form-card .form-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-800);
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--gray-100);
    display: flex;
    align-items: center;
    gap: 12px;
}

.form-card .form-title i {
    color: var(--primary);
    font-size: 24px;
}

/* ===== FORM GROUP ===== */
.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: 6px;
}

.form-group label .required {
    color: var(--danger);
    margin-left: 2px;
}

.form-group .form-control {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid var(--gray-200);
    border-radius: 10px;
    font-size: 14px;
    color: var(--gray-700);
    background: #fff;
    transition: var(--transition);
    box-sizing: border-box;
}

.form-group .form-control:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

.form-group .form-control::placeholder {
    color: var(--gray-400);
}

.form-group .form-control[readonly] {
    background: var(--gray-50);
    cursor: not-allowed;
}

.form-group .form-help {
    font-size: 11px;
    color: var(--gray-400);
    margin-top: 4px;
}

/* ===== FORM ROW ===== */
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

/* ===== FORM ROW - NAME & SKU SIDE BY SIDE ===== */
.form-row-name-sku {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.form-row-name-sku .form-group:first-child {
    flex: 0 0 25%;
    min-width: 100px;
}

.form-row-name-sku .form-group:last-child {
    flex: 1;
}

/* ===== FIELD WITH BUTTON ===== */
.field-with-btn {
    display: flex;
    gap: 10px;
    align-items: center;
}

.field-with-btn .form-control {
    flex: 1;
}

.field-with-btn .btn-add-field {
    padding: 12px 18px;
    background: var(--primary-gradient);
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.field-with-btn .btn-add-field:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* ===== IMAGE UPLOAD ===== */
.image-upload-area {
    border: 2px dashed var(--gray-200);
    border-radius: 12px;
    padding: 30px 20px;
    text-align: center;
    background: var(--gray-50);
    transition: var(--transition);
    cursor: pointer;
}

.image-upload-area:hover {
    border-color: var(--primary);
    background: #f8f7ff;
}

.image-upload-area .upload-icon {
    font-size: 48px;
    color: var(--gray-300);
    display: block;
    margin-bottom: 12px;
}

.image-upload-area .upload-text {
    font-size: 14px;
    color: var(--gray-500);
}

.image-upload-area .upload-text strong {
    color: var(--primary);
    cursor: pointer;
}

.image-upload-area .file-name {
    font-size: 12px;
    color: var(--gray-400);
    margin-top: 8px;
}

.image-upload-area .image-preview {
    margin-top: 12px;
}

.image-upload-area .image-preview img {
    max-width: 150px;
    max-height: 150px;
    border-radius: 10px;
    box-shadow: var(--shadow-md);
}

/* ===== FORM ACTIONS ===== */
.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 2px solid var(--gray-100);
}

.form-actions .btn-cancel {
    padding: 12px 28px;
    background: var(--gray-100);
    color: var(--gray-600);
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.form-actions .btn-cancel:hover {
    background: var(--gray-200);
}

.form-actions .btn-submit {
    padding: 12px 32px;
    background: linear-gradient(135deg, var(--success), #059669);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.form-actions .btn-submit:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

/* ============================================================
   MODERN MODAL - ULTRA CLEAN DESIGN
   ============================================================ */
.modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px);
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: modalFadeIn 0.3s ease-out;
}

@keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-container {
    background: #fff;
    border-radius: var(--radius-xl);
    width: 92%;
    max-width: 440px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.2);
    animation: modalSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
}

@keyframes modalSlideUp {
    from { 
        opacity: 0; 
        transform: translateY(30px) scale(0.95);
    }
    to { 
        opacity: 1; 
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    padding: 20px 24px 16px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-bottom: 1px solid var(--gray-100);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header .modal-icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.modal-header .modal-icon-wrapper i {
    font-size: 20px;
    color: #fff;
}

.modal-header .modal-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.modal-header .modal-title-group h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--gray-800);
}

.modal-header .modal-title-group .modal-subtitle {
    font-size: 12px;
    color: var(--gray-500);
    font-weight: 400;
    margin-top: 1px;
}

.modal-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--gray-100);
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--gray-400);
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-close:hover {
    background: var(--gray-200);
    color: var(--gray-600);
    transform: rotate(90deg);
}

.modal-body {
    padding: 20px 24px 12px;
}

.modal-body .form-group {
    margin-bottom: 16px;
}

.modal-body .form-group:last-child {
    margin-bottom: 0;
}

.modal-body .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: 6px;
}

.modal-body .form-group label .required {
    color: var(--danger);
    margin-left: 2px;
}

.modal-body .form-group .form-control {
    width: 100%;
    padding: 11px 14px;
    border: 2px solid var(--gray-200);
    border-radius: 10px;
    font-size: 14px;
    color: var(--gray-700);
    background: #fff;
    transition: var(--transition);
    box-sizing: border-box;
}

.modal-body .form-group .form-control:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

.modal-body .form-group .form-control::placeholder {
    color: var(--gray-400);
}

.modal-body .form-group .form-help {
    font-size: 11px;
    color: var(--gray-400);
    margin-top: 4px;
}

.modal-footer {
    padding: 12px 24px 20px;
    border-top: 1px solid var(--gray-100);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    background: #fafbfc;
}

.modal-footer .btn-cancel-modal {
    padding: 10px 22px;
    background: var(--gray-100);
    color: var(--gray-600);
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
}

.modal-footer .btn-cancel-modal:hover {
    background: var(--gray-200);
}

.modal-footer .btn-submit-modal {
    padding: 10px 24px;
    background: var(--primary-gradient);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.modal-footer .btn-submit-modal:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(79, 70, 229, 0.35);
}

.modal-footer .btn-submit-modal i {
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
    
    .form-card {
        padding: 20px 16px;
    }
    
    .form-row {
        grid-template-columns: 1fr;
    }
    
    .form-row-name-sku {
        flex-direction: column;
    }
    
    .form-row-name-sku .form-group:first-child {
        flex: 1;
        min-width: 100%;
    }
    
    .field-with-btn {
        flex-direction: column;
    }
    
    .field-with-btn .btn-add-field {
        width: 100%;
        justify-content: center;
    }
    
    .form-actions {
        flex-direction: column;
    }
    
    .form-actions .btn-cancel,
    .form-actions .btn-submit {
        width: 100%;
        justify-content: center;
    }
    
    .modal-container {
        width: 96%;
        max-width: 96%;
        border-radius: var(--radius-lg);
    }
    
    .modal-header {
        padding: 16px 18px 12px;
    }
    
    .modal-header .modal-title-group h3 {
        font-size: 16px;
    }
    
    .modal-body {
        padding: 16px 18px 10px;
    }
    
    .modal-footer {
        padding: 10px 18px 16px;
        flex-direction: column;
    }
    
    .modal-footer .btn-cancel-modal,
    .modal-footer .btn-submit-modal {
        width: 100%;
        justify-content: center;
    }
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
    
    .form-card .form-title {
        font-size: 17px;
    }
    
    .image-upload-area {
        padding: 20px 16px;
    }
    
    .image-upload-area .upload-icon {
        font-size: 36px;
    }
    
    .modal-header .modal-icon-wrapper {
        width: 36px;
        height: 36px;
    }
    
    .modal-header .modal-icon-wrapper i {
        font-size: 16px;
    }
}

@media print {
    .no-print { display: none !important; }
    .page-container { background: white !important; padding: 0 !important; }
    .form-card { box-shadow: none !important; border: 1px solid #ddd !important; }
}
</style>

<div class="page-container">
    <!-- ===== ALERTS ===== -->
    <?php if($success): ?>
    <div class="alert alert-success" id="successAlert">
        <div class="alert-content">
            <div class="alert-icon"><i class="fas fa-check-circle"></i></div>
            <div class="alert-message"><?php echo safeHtml($success); ?></div>
            <button class="alert-close" onclick="closeAlert(this)">&times;</button>
        </div>
    </div>
    <?php endif; ?>
    
    <?php if($error): ?>
    <div class="alert alert-danger" id="errorAlert">
        <div class="alert-content">
            <div class="alert-icon"><i class="fas fa-exclamation-circle"></i></div>
            <div class="alert-message"><?php echo safeHtml($error); ?></div>
            <button class="alert-close" onclick="closeAlert(this)">&times;</button>
        </div>
    </div>
    <?php endif; ?>

    <!-- ===== HEADER ===== -->
    <div class="page-header">
        <div class="header-left">
            <div class="brand-icon"><i class="fas fa-plus-circle"></i></div>
            <div class="header-text">
                <h1>Add <span>Product</span></h1>
                <p><i class="far fa-calendar-alt"></i> <?php echo $current_date; ?> &bull; <i class="far fa-clock"></i> <?php echo $current_time; ?></p>
            </div>
        </div>
        <div class="header-actions no-print">
            <a href="/product" class="btn btn-primary"><i class="fas fa-arrow-left"></i> Back to Products</a>
        </div>
    </div>
    
    <!-- ===== TABS ===== -->
    <div class="tabs-container no-print">
        <a href="/product" class="tab-btn">
            <i class="fas fa-list"></i> Products
        </a>
        <a href="/product/add" class="tab-btn active">
            <i class="fas fa-plus-circle"></i> Add Product
        </a>
    </div>    

    <!-- ===== FORM ===== -->
    <div class="form-card">
        <div class="form-title">
            <i class="fas fa-box"></i>
            Product Information
        </div>
        
        <form method="POST" enctype="multipart/form-data" id="productForm">
            <!-- Product Code & Name - Side by Side -->
            <div class="form-row-name-sku">
                <div class="form-group">
                    <label>Product Code / SKU</label>
                    <input type="text" name="sku" class="form-control" placeholder="Enter SKU..." value="<?php echo safeHtml($form_data['sku'] ?? ''); ?>">
                    <div class="form-help">Unique identifier (optional)</div>
                </div>
                
                <div class="form-group">
                    <label>Product Name <span class="required">*</span></label>
                    <input type="text" name="name" class="form-control" placeholder="Enter product name..." value="<?php echo safeHtml($form_data['name'] ?? ''); ?>" required>
                </div>
            </div>
            
            <!-- Category and Brand -->
            <div class="form-row">
                <div class="form-group">
                    <label>Category <span class="required">*</span></label>
                    <div class="field-with-btn">
                        <select name="category_id" class="form-control" required>
                            <option value="">Select Category</option>
                            <?php foreach($categories as $cat): ?>
                                <option value="<?php echo $cat['id']; ?>" <?php echo (($form_data['category_id'] ?? '') == $cat['id']) ? 'selected' : ''; ?>>
                                    <?php echo safeHtml($cat['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="button" class="btn-add-field" onclick="openModal('categoryModal')">
                            <i class="fas fa-plus"></i> New
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Brand</label>
                    <div class="field-with-btn">
                        <select name="brand_id" class="form-control">
                            <option value="">Select Brand</option>
                            <?php foreach($brands as $brand): ?>
                                <option value="<?php echo $brand['id']; ?>" <?php echo (($form_data['brand_id'] ?? '') == $brand['id']) ? 'selected' : ''; ?>>
                                    <?php echo safeHtml($brand['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="button" class="btn-add-field" onclick="openModal('brandModal')">
                            <i class="fas fa-plus"></i> New
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Warranty and Unit -->
            <div class="form-row">
                <div class="form-group">
                    <label>Warranty</label>
                    <div class="field-with-btn">
                        <select name="warranty_id" class="form-control">
                            <option value="">Select Warranty</option>
                            <?php foreach($warranties as $warranty): ?>
                                <option value="<?php echo $warranty['id']; ?>" <?php echo (($form_data['warranty_id'] ?? '') == $warranty['id']) ? 'selected' : ''; ?>>
                                    <?php echo safeHtml($warranty['duration']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="button" class="btn-add-field" onclick="openModal('warrantyModal')">
                            <i class="fas fa-plus"></i> New
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Main Unit</label>
                    <div class="field-with-btn">
                        <select name="unit_id" class="form-control">
                            <option value="">Select Unit</option>
                            <?php foreach($units as $unit): ?>
                                <option value="<?php echo $unit['id']; ?>" <?php echo (($form_data['unit_id'] ?? '') == $unit['id']) ? 'selected' : ''; ?>>
                                    <?php echo safeHtml($unit['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="button" class="btn-add-field" onclick="openModal('unitModal')">
                            <i class="fas fa-plus"></i> New
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Stock -->
            <div class="form-row">
                <div class="form-group">
                    <label>Opening Stock</label>
                    <input type="number" name="stock_quantity" class="form-control" placeholder="0" value="<?php echo $form_data['stock_quantity'] ?? '0'; ?>" min="0">
                    <div class="form-help">Initial stock quantity</div>
                </div>
                
                <div class="form-group">
                    <label>Alert Quantity</label>
                    <input type="number" name="alert_quantity" class="form-control" placeholder="5" value="<?php echo $form_data['alert_quantity'] ?? '5'; ?>" min="1">
                    <div class="form-help">Notify when stock falls below this quantity</div>
                </div>
            </div>
            
            <!-- Pricing -->
            <div class="form-row">
                <div class="form-group">
                    <label>Purchase Cost</label>
                    <input type="number" name="purchase_price" class="form-control" step="0.01" placeholder="0.00" value="<?php echo $form_data['purchase_price'] ?? '0'; ?>" min="0">
                </div>
                
                <div class="form-group">
                    <label>Sale Price <span class="required">*</span></label>
                    <input type="number" name="selling_price" class="form-control" step="0.01" placeholder="0.00" value="<?php echo $form_data['selling_price'] ?? '0'; ?>" min="0" required>
                </div>
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label>Product Details</label>
                <textarea name="description" class="form-control" rows="4" placeholder="Enter product description..."><?php echo safeHtml($form_data['description'] ?? ''); ?></textarea>
            </div>
            
            <!-- Image Upload -->
            <div class="form-group">
                <label>Product Image</label>
                <div class="image-upload-area" onclick="document.getElementById('product_image').click()">
                    <span class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></span>
                    <div class="upload-text">
                        <strong>Click to choose</strong> or drag and drop
                    </div>
                    <input type="file" name="product_image" id="product_image" accept="image/*" style="display: none;" onchange="previewImage(this)">
                    <div class="file-name" id="file_name">No file chosen</div>
                    <div class="image-preview" id="image_preview"></div>
                    <div class="form-help" style="margin-top: 8px;">Recommended: 300x300px, Max 2MB, JPG/PNG/GIF</div>
                </div>
            </div>
            
            <!-- Form Actions -->
            <div class="form-actions">
                <a href="/product" class="btn-cancel"><i class="fas fa-times"></i> Cancel</a>
                <button type="submit" name="add_product" class="btn-submit"><i class="fas fa-save"></i> Submit</button>
            </div>
        </form>
    </div>
</div>

<!-- ===== MODALS - MODERN DESIGN ===== -->

<!-- Category Modal -->
<div id="categoryModal" class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-icon-wrapper">
                    <i class="fas fa-tag"></i>
                </div>
                <div>
                    <h3>Add New Category</h3>
                    <div class="modal-subtitle">Create a new product category</div>
                </div>
            </div>
            <button class="modal-close" onclick="closeModal('categoryModal')">&times;</button>
        </div>
        <form method="POST" id="categoryForm">
            <div class="modal-body">
                <div class="form-group">
                    <label>Category Name <span class="required">*</span></label>
                    <input type="text" name="category_name" class="form-control" placeholder="Enter category name..." required autofocus>
                    <div class="form-help">Example: Electronics, Clothing, Food</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel-modal" onclick="closeModal('categoryModal')">Cancel</button>
                <button type="submit" name="add_category" class="btn-submit-modal"><i class="fas fa-plus"></i> Add Category</button>
            </div>
        </form>
    </div>
</div>

<!-- Brand Modal -->
<div id="brandModal" class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-icon-wrapper">
                    <i class="fas fa-copyright"></i>
                </div>
                <div>
                    <h3>Add New Brand</h3>
                    <div class="modal-subtitle">Create a new product brand</div>
                </div>
            </div>
            <button class="modal-close" onclick="closeModal('brandModal')">&times;</button>
        </div>
        <form method="POST" id="brandForm">
            <div class="modal-body">
                <div class="form-group">
                    <label>Brand Name <span class="required">*</span></label>
                    <input type="text" name="brand_name" class="form-control" placeholder="Enter brand name..." required autofocus>
                    <div class="form-help">Example: Apple, Samsung, Nike</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel-modal" onclick="closeModal('brandModal')">Cancel</button>
                <button type="submit" name="add_brand" class="btn-submit-modal"><i class="fas fa-plus"></i> Add Brand</button>
            </div>
        </form>
    </div>
</div>

<!-- Warranty Modal -->
<div id="warrantyModal" class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-icon-wrapper">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div>
                    <h3>Add New Warranty</h3>
                    <div class="modal-subtitle">Create a new warranty period</div>
                </div>
            </div>
            <button class="modal-close" onclick="closeModal('warrantyModal')">&times;</button>
        </div>
        <form method="POST" id="warrantyForm">
            <div class="modal-body">
                <div class="form-group">
                    <label>Warranty Duration <span class="required">*</span></label>
                    <input type="text" name="warranty_duration" class="form-control" placeholder="e.g., 1 Year, 6 Months..." required autofocus>
                    <div class="form-help">Example: 1 Year, 6 Months, 2 Years, Lifetime</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel-modal" onclick="closeModal('warrantyModal')">Cancel</button>
                <button type="submit" name="add_warranty" class="btn-submit-modal"><i class="fas fa-plus"></i> Add Warranty</button>
            </div>
        </form>
    </div>
</div>

<!-- Unit Modal -->
<div id="unitModal" class="modal-overlay">
    <div class="modal-container">
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-icon-wrapper">
                    <i class="fas fa-cubes"></i>
                </div>
                <div>
                    <h3>Add New Unit</h3>
                    <div class="modal-subtitle">Create a new measurement unit</div>
                </div>
            </div>
            <button class="modal-close" onclick="closeModal('unitModal')">&times;</button>
        </div>
        <form method="POST" id="unitForm">
            <div class="modal-body">
                <div class="form-group">
                    <label>Unit Name <span class="required">*</span></label>
                    <input type="text" name="unit_name" class="form-control" placeholder="e.g., PC, KG, Meter..." required autofocus>
                    <div class="form-help">Example: PC, KG, Meter, Dozen, Box</div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-cancel-modal" onclick="closeModal('unitModal')">Cancel</button>
                <button type="submit" name="add_unit" class="btn-submit-modal"><i class="fas fa-plus"></i> Add Unit</button>
            </div>
        </form>
    </div>
</div>

<script>
// ============================================================
// MODAL FUNCTIONS
// ============================================================
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = '';
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Close modal on ESC key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(function(modal) {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }
});

// ============================================================
// PRESERVE FORM DATA BEFORE MODAL SUBMISSION
// ============================================================
document.querySelectorAll('#categoryForm, #brandForm, #warrantyForm, #unitForm').forEach(function(form) {
    form.addEventListener('submit', function(e) {
        // Get all form data from main form
        var mainForm = document.getElementById('productForm');
        var formData = new FormData(mainForm);
        
        // Create hidden inputs to preserve data
        var hiddenInputs = '';
        for (var pair of formData.entries()) {
            if (pair[0] !== 'add_product' && pair[0] !== 'product_image') {
                hiddenInputs += '<input type="hidden" name="' + pair[0] + '" value="' + pair[1] + '">';
            }
        }
        
        // Append hidden inputs to modal form
        var hiddenContainer = document.createElement('div');
        hiddenContainer.style.display = 'none';
        hiddenContainer.innerHTML = hiddenInputs;
        this.appendChild(hiddenContainer);
    });
});

// ============================================================
// IMAGE PREVIEW
// ============================================================
function previewImage(input) {
    const file = input.files[0];
    const fileNameSpan = document.getElementById('file_name');
    const previewDiv = document.getElementById('image_preview');
    
    if (file) {
        // Check file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('File size too large! Maximum 2MB allowed.');
            input.value = '';
            fileNameSpan.textContent = 'No file chosen';
            previewDiv.innerHTML = '';
            return;
        }
        
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Only JPG, PNG, GIF, and WEBP images are allowed.');
            input.value = '';
            fileNameSpan.textContent = 'No file chosen';
            previewDiv.innerHTML = '';
            return;
        }
        
        fileNameSpan.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewDiv.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
        }
        reader.readAsDataURL(file);
    } else {
        fileNameSpan.textContent = 'No file chosen';
        previewDiv.innerHTML = '';
    }
}

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