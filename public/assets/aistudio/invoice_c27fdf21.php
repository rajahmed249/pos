<?php
$page_title = 'Invoice - Youth IT POS';
require 'config.php';
require 'includes/functions.php';
redirectIfNotLoggedIn();

$invoice_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($invoice_id <= 0) {
    header("Location: sales.php");
    exit();
}

// Get invoice details
$stmt = $pdo->prepare("SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address 
                       FROM sales s 
                       LEFT JOIN customers c ON s.customer_id = c.id 
                       WHERE s.id = ?");
$stmt->execute([$invoice_id]);
$invoice = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$invoice) {
    $_SESSION['error'] = "Invoice not found!";
    header("Location: sales.php");
    exit();
}

// Get invoice items with product names
$stmt = $pdo->prepare("SELECT 
                       si.id,
                       si.product_id,
                       si.quantity,
                       si.price,
                       si.total,
                       si.serial_no,
                       si.warranty,
                       p.name as product_name,
                       p.sku,
                       c.name as category_name
                       FROM sale_items si
                       LEFT JOIN products p ON si.product_id = p.id
                       LEFT JOIN categories c ON p.category_id = c.id
                       WHERE si.sale_id = ? 
                       ORDER BY si.id ASC");
$stmt->execute([$invoice_id]);
$items_raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Process items
$items = [];
foreach($items_raw as $item) {
    $category_name = !empty($item['category_name']) ? $item['category_name'] : 'Electronics';
    $warranty_display = !empty($item['warranty']) ? $item['warranty'] : '';
    
    $items[] = [
        'product_name' => $item['product_name'] ?? 'Unknown Product',
        'category_name' => $category_name,
        'display_warranty' => $warranty_display,
        'display_serial' => $item['serial_no'] ?? '',
        'quantity' => $item['quantity'] ?? 1,
        'price' => floatval($item['price'] ?? 0),
        'total' => floatval($item['total'] ?? 0)
    ];
}

// Calculate subtotal from items
$calculated_subtotal = 0;
foreach($items as $item) {
    $calculated_subtotal += $item['total'];
}

// Total amount
$total_amount = isset($invoice['total']) ? floatval($invoice['total']) : 0;
if($total_amount == 0) {
    $total_amount = isset($invoice['total_amount']) ? floatval($invoice['total_amount']) : 0;
}
if($total_amount == 0) {
    $total_amount = $calculated_subtotal;
}

$discount = isset($invoice['discount']) ? floatval($invoice['discount']) : 0;
$vat_amount = isset($invoice['tax']) ? floatval($invoice['tax']) : 0;
if ($vat_amount == 0 && isset($invoice['vat'])) {
    $vat_amount = floatval($invoice['vat']);
}

// Net Payable = Total - Discount + VAT
$net_payable = $total_amount - $discount + $vat_amount;
if ($net_payable < 0) $net_payable = 0;

// Paid amount
$db_paid = isset($invoice['paid']) ? floatval($invoice['paid']) : 0;

// Payments table থেকে মোট পেমেন্ট (fallback)
$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE sale_id = ?");
$stmt->execute([$invoice_id]);
$extra_payments = floatval($stmt->fetch(PDO::FETCH_ASSOC)['total_paid'] ?? 0);

$paid = $db_paid;
if ($paid == 0 && $extra_payments > 0) {
    $paid = $extra_payments;
}

// Current Due = Net Payable - Paid
$due = $net_payable - $paid;
if ($due < 0) $due = 0;

// Get company settings
$settings = [];
$stmt = $pdo->query("SELECT key_name, value FROM settings");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $settings[$row['key_name']] = $row['value'];
}

$company_name = isset($settings['shop_name']) && !empty($settings['shop_name']) ? $settings['shop_name'] : 'YOUTH IT POS';
$company_address = isset($settings['shop_address']) && !empty($settings['shop_address']) ? $settings['shop_address'] : 'Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216';
$company_phone = isset($settings['shop_phone']) && !empty($settings['shop_phone']) ? $settings['shop_phone'] : '01401400800, 01576400800';
$company_email = isset($settings['shop_email']) && !empty($settings['shop_email']) ? $settings['shop_email'] : 'info@youthit.com.bd';
$company_website = isset($settings['shop_website']) && !empty($settings['shop_website']) ? $settings['shop_website'] : 'www.youthit.com.bd';
$company_logo = isset($settings['shop_logo']) && !empty($settings['shop_logo']) ? $settings['shop_logo'] : '';
$company_qr = isset($settings['shop_qr']) && !empty($settings['shop_qr']) ? $settings['shop_qr'] : '';

// Split company name
$company_name_upper = strtoupper($company_name);
$youth_it_part = '';
$pos_part = '';
if (strpos($company_name_upper, 'YOUTH IT') !== false) {
    $youth_it_part = 'YOUTH IT';
    $pos_part = str_replace('YOUTH IT', '', $company_name_upper);
} else {
    $youth_it_part = $company_name_upper;
    $pos_part = '';
}

// Previous Due calculation
$customer_opening_balance = 0;
if (!empty($invoice['customer_id'])) {
    $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
    $stmt->execute([$invoice['customer_id']]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    $customer_opening_balance = floatval($customer['opening_balance'] ?? 0);
}

$previous_due = $customer_opening_balance - $due;
if ($previous_due < 0) $previous_due = 0;

$payment_method = isset($invoice['payment_method']) && !empty($invoice['payment_method']) ? $invoice['payment_method'] : 'Cash';
$payment_method = ucfirst(strtolower($payment_method));

// Get user name
$user_name = 'Youth IT';
$user_id_from_sale = isset($invoice['user_id']) ? (int)$invoice['user_id'] : 0;

if ($user_id_from_sale > 0) {
    $stmt = $pdo->prepare("SELECT name FROM users WHERE id = ?");
    $stmt->execute([$user_id_from_sale]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        $user_name = !empty($user['name']) ? $user['name'] : 'User #' . $user_id_from_sale;
    }
}

if ($user_name == 'Youth IT' && isset($_SESSION['user_id'])) {
    $stmt = $pdo->prepare("SELECT name FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        $user_name = !empty($user['name']) ? $user['name'] : 'User #' . $_SESSION['user_id'];
    }
}

// ============================================================
// NUMBER TO WORDS (Bangladeshi/Indian system with Lac & Crore)
// ============================================================
function numberToWords($number) {
    $hyphen = '-';
    $conjunction = ' and ';
    $decimal = ' point ';
    $negative = 'negative ';
    
    $dictionary = array(
        0 => 'Zero', 1 => 'One', 2 => 'Two', 3 => 'Three', 4 => 'Four', 
        5 => 'Five', 6 => 'Six', 7 => 'Seven', 8 => 'Eight', 9 => 'Nine',
        10 => 'Ten', 11 => 'Eleven', 12 => 'Twelve', 13 => 'Thirteen', 
        14 => 'Fourteen', 15 => 'Fifteen', 16 => 'Sixteen', 17 => 'Seventeen', 
        18 => 'Eighteen', 19 => 'Nineteen',
        20 => 'Twenty', 30 => 'Thirty', 40 => 'Forty', 50 => 'Fifty', 
        60 => 'Sixty', 70 => 'Seventy', 80 => 'Eighty', 90 => 'Ninety',
        100 => 'Hundred'
    );
    
    if (!is_numeric($number)) {
        return false;
    }
    
    $number = floatval($number);
    if ($number < 0) {
        return $negative . numberToWords(abs($number));
    }
    
    $twoDigits = function($n) use ($dictionary, $hyphen) {
        $n = (int)$n;
        if ($n < 21) {
            return $dictionary[$n];
        } elseif ($n < 100) {
            $tens = floor($n / 10) * 10;
            $units = $n % 10;
            $str = $dictionary[$tens];
            if ($units) $str .= $hyphen . $dictionary[$units];
            return $str;
        }
        return '';
    };
    
    $integerPart = floor($number);
    $fraction = round(($number - $integerPart) * 100);
    
    $string = '';
    
    if ($integerPart == 0) {
        $string = 'Zero';
    } else {
        $crore    = floor($integerPart / 10000000);
        $lac      = floor(($integerPart % 10000000) / 100000);
        $thousand = floor(($integerPart % 100000) / 1000);
        $hundred  = floor(($integerPart % 1000) / 100);
        $rest     = $integerPart % 100;
        
        $parts = [];
        
        if ($crore > 0) {
            $parts[] = numberToWords($crore) . ' Crore';
        }
        if ($lac > 0) {
            $parts[] = $twoDigits($lac) . ' Lac';
        }
        if ($thousand > 0) {
            $parts[] = $twoDigits($thousand) . ' Thousand';
        }
        if ($hundred > 0) {
            $parts[] = $dictionary[$hundred] . ' Hundred';
        }
        if ($rest > 0) {
            $restStr = $twoDigits($rest);
            if (count($parts) > 0) {
                $parts[] = 'and ' . $restStr;
            } else {
                $parts[] = $restStr;
            }
        }
        
        $string = implode(' ', $parts);
    }
    
    if ($fraction > 0) {
        $string .= $decimal . $twoDigits($fraction);
    }
    
    return $string;
}

$total_in_words = numberToWords($net_payable) . ' Taka Only';

// ============================================================
// FIXED: Invoice Date calculation
// NULL, '0000-00-00' handle করা হচ্ছে
// ক্রম: sale_date → date → created_at → আজকের তারিখ
// ============================================================
$invoice_date_str = '';

if (!empty($invoice['sale_date']) 
    && $invoice['sale_date'] !== '0000-00-00 00:00:00' 
    && $invoice['sale_date'] !== '0000-00-00') {
    $invoice_date_str = $invoice['sale_date'];
} 
elseif (!empty($invoice['date']) 
    && $invoice['date'] !== '0000-00-00 00:00:00' 
    && $invoice['date'] !== '0000-00-00') {
    $invoice_date_str = $invoice['date'];
} 
elseif (!empty($invoice['created_at']) 
    && $invoice['created_at'] !== '0000-00-00 00:00:00' 
    && $invoice['created_at'] !== '0000-00-00') {
    $invoice_date_str = $invoice['created_at'];
} 
else {
    $invoice_date_str = date('Y-m-d H:i:s');
}

// Extra safety: strtotime ব্যর্থ হলে আজকের তারিখ
$invoice_timestamp = strtotime($invoice_date_str);
if ($invoice_timestamp === false || $invoice_timestamp <= 0) {
    $invoice_timestamp = time();
}
?>
<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - Youth IT POS</title>
    <link rel="icon" type="image/png" href="/assets/images/favicon.png">
    <link rel="shortcut icon" type="image/png" href="/assets/images/favicon.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            background: #eef2f6;
            min-height: 100vh;
            padding: 30px 15px;
        }
        .invoice-wrapper {
            max-width: 1000px;
            margin: 0 auto;
        }
        .invoice-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            overflow: hidden;
        }
        
        /* Header Section */
        .header-section {
            padding: 18px 25px;
            border-bottom: 2px solid #eef2f6;
            position: relative;
        }
        .header-flex {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo-area {
            flex-shrink: 0;
            width: 100px;
        }
        .logo-img {
            max-height: 70px;
            max-width: 90px;
            width: auto;
            height: auto;
        }
        .logo-placeholder {
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo-placeholder i {
            font-size: 35px;
            color: white;
        }
        .qr-area {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
        }
        .qr-box {
            width: 70px;
            height: 70px;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
        }
        .qr-box i {
            font-size: 35px;
            color: #94a3b8;
        }
        .company-info {
            text-align: right;
            flex: 1;
        }
        .company-name {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 1px;
        }
        .company-name .blue {
            color: #065AA4;
        }
        .company-name .dark {
            color: #1e293b;
        }
        .company-address {
            margin: 6px 0 0;
            font-size: 11px;
            color: #64748b;
            line-height: 1.3;
        }
        .company-contact {
            margin: 4px 0 0;
            font-size: 11px;
            color: #64748b;
        }
        
        /* Title */
        .invoice-title {
            padding: 5px 25px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-bottom: 1px solid #eef2f6;
            text-align: center;
        }
        .invoice-title h2 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 2px;
            color: #1e293b;
        }
        
        /* To Section */
        .to-section {
            padding: 12px 25px;
            border-bottom: 1px solid #eef2f6;
        }
        .to-flex {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 15px;
        }
        .to-customer {
            flex: 1;
        }
        .to-customer p {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            color: #1e293b;
        }
        .to-customer .details {
            margin: 5px 0 0;
            font-size: 12px;
            color: #475569;
            line-height: 1.4;
        }
        .to-right {
            text-align: left;
        }
        .to-right .info-row {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
        }
        .to-right .info-row .label {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
            min-width: 95px;
            text-align: left;
        }
        .to-right .info-row .colon {
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
            margin: 0 8px;
            text-align: center;
            min-width: 8px;
        }
        .to-right .info-row .value {
            font-size: 12px;
            color: #475569;
            text-align: left;
        }
        
        /* Items Table */
        .items-section {
            padding: 12px 25px;
            overflow-x: auto;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .invoice-table thead tr {
            background: #f1f5f9;
            border-bottom: 2px solid #e2e8f0;
        }
        .invoice-table th {
            padding: 8px 6px;
            text-align: center;
            font-weight: 600;
            color: #1e293b;
        }
        .invoice-table th.left { text-align: left; }
        .invoice-table th.right { text-align: right; }
        .invoice-table td {
            padding: 6px 6px;
            border-bottom: 1px solid #f1f5f9;
        }
        .invoice-table td.center { text-align: center; }
        .invoice-table td.left { text-align: left; }
        .invoice-table td.right { text-align: right; }
        .invoice-table td .serial-text {
            font-size: 10px;
            color: #2563eb;
            margin-top: 3px;
        }
        .warranty-badge {
            background: #eef2ff;
            color: #667eea;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
        }
        .no-warranty {
            color: #94a3b8;
            font-size: 10px;
        }
        
        /* Totals */
        .totals-section {
            padding: 10px 25px;
            background: white;
            border-top: 1px solid #eef2f6;
        }
        .totals-flex {
            display: flex;
            justify-content: flex-end;
        }
        .totals-box {
            width: 320px;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
        }
        .totals-row .label { 
            font-size: 12px;
            font-weight: 500;
            color: #475569;
        }
        .totals-row .value { 
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
        }
        .totals-row.total .label { 
            font-size: 12px;
            font-weight: 600;
            color: #1e293b;
        }
        .totals-row.total .value { 
            font-size: 12px;
            font-weight: 600;
            color: #667eea;
        }
        .totals-row.discount .value { color: #ef4444; }
        .totals-row.paid .value { color: #10b981; }
        .totals-row.due .value { color: #ef4444; }
        .totals-row.total-due .value { color: #ef4444; font-weight: 600; }
        .totals-border {
            padding: 8px 0;
            margin-top: 4px;
            border-top: 2px solid #e2e8f0;
        }
        .totals-border-bottom {
            padding: 8px 0;
            margin-top: 4px;
            border-top: 1px solid #eef2f6;
        }
        
        /* Amount in Words */
        .words-section {
            padding: 10px 25px;
            background: #fff;
            border-bottom: 1px solid #eef2f6;
        }
        .words-section p {
            margin: 0;
            font-size: 12px;
        }
        .words-section p strong {
            color: #1e293b;
        }
        
        /* Signature */
        .signature-section {
            padding: 15px 25px 12px 25px;
            background: white;
        }
        .signature-flex {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 25px;
        }
        .signature-box {
            text-align: left;
            flex: 1;
        }
        .signature-box p {
            margin: 0;
            font-size: 11px;
            color: #64748b;
        }
        .signature-line {
            margin-top: 35px;
            border-top: 1px dashed #cbd5e1;
            width: 180px;
        }
        .signature-box.right {
            text-align: right;
        }
        .signature-box.right .signature-line {
            margin-left: auto;
        }
        
        /* Warranty Note */
        .warranty-note {
            padding: 8px 25px 12px 25px;
            background: #fff;
            text-align: center;
            border-top: 1px solid #eef2f6;
        }
        .warranty-note p {
            margin: 0;
            font-size: 11px;
            color: #94a3b8;
            font-style: italic;
        }
        
        /* Buttons - No Print */
        .no-print {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
        }
        .btn-print-gradient {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 10px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        .btn-print-gradient:hover {
            background: linear-gradient(135deg, #764ba2, #667eea) !important;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-back {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #e2e8f0;
            padding: 10px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
        }
        .btn-back:hover {
            background: #e2e8f0;
        }
        
        @media print {
            .no-print { display: none !important; }
            body { background: white; padding: 0; margin: 0; }
            .invoice-wrapper { margin: 0; padding: 0; max-width: 100% !important; }
            .invoice-card { margin: 0; padding: 0; box-shadow: none !important; border-radius: 0 !important; }
            @page { size: A4; margin: 0.5cm; }
            .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 4px; }
            .invoice-table thead tr { background: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>

<div class="invoice-wrapper">
    <div class="invoice-card">
        
        <!-- Header Section -->
        <div class="header-section">
            <div class="header-flex">
                <div class="logo-area">
                    <?php if(!empty($company_logo) && file_exists($company_logo)): ?>
                        <img src="<?php echo htmlspecialchars($company_logo); ?>" alt="Logo" class="logo-img">
                    <?php else: ?>
                        <div class="logo-placeholder">
                            <i class="fas fa-store"></i>
                        </div>
                    <?php endif; ?>
                </div>
                
                <div class="qr-area">
                    <?php if(!empty($company_qr) && file_exists($company_qr)): ?>
                        <div style="width: 70px; height: 70px;">
                            <img src="<?php echo htmlspecialchars($company_qr); ?>" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                    <?php else: ?>
                        <div class="qr-box">
                            <i class="fas fa-qrcode"></i>
                        </div>
                    <?php endif; ?>
                </div>
                
                <div class="company-info">
                    <?php if(!empty($youth_it_part)): ?>
                        <h1 class="company-name">
                            <span class="blue"><?php echo htmlspecialchars($youth_it_part); ?></span>
                            <?php if(!empty($pos_part)): ?>
                            <span class="dark"><?php echo htmlspecialchars($pos_part); ?></span>
                            <?php endif; ?>
                        </h1>
                    <?php else: ?>
                        <h1 class="company-name" style="color: #065AA4;"><?php echo htmlspecialchars($company_name_upper); ?></h1>
                    <?php endif; ?>
                    <p class="company-address"><?php echo nl2br(htmlspecialchars($company_address)); ?></p>
                    <p class="company-contact">📞 Cell: <?php echo htmlspecialchars($company_phone); ?></p>
                    <p class="company-contact">✉️ <?php echo htmlspecialchars($company_email); ?> | 🌐 <?php echo htmlspecialchars($company_website); ?></p>
                </div>
            </div>
        </div>
        
        <!-- INVOICE Title -->
        <div class="invoice-title">
            <h2>INVOICE</h2>
        </div>
        
        <!-- To Section -->
        <div class="to-section">
            <div class="to-flex">
                <div class="to-customer">
                    <p>To,</p>
                    <div class="details">
                        <?php echo htmlspecialchars($invoice['customer_name'] ?? 'Walk-in Customer'); ?><br>
                        <?php echo htmlspecialchars($invoice['customer_address'] ?? '—'); ?><br>
                        <?php echo htmlspecialchars($invoice['customer_phone'] ?? '—'); ?>
                    </div>
                </div>
                <div class="to-right">
                    <div class="info-row">
                        <span class="label">Invoice No</span>
                        <span class="colon">:</span>
                        <span class="value"><?php echo htmlspecialchars($invoice['invoice_no']); ?></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Date</span>
                        <span class="colon">:</span>
                        <span class="value"><?php echo date('d-m-Y', $invoice_timestamp); ?></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Sold By</span>
                        <span class="colon">:</span>
                        <span class="value"><?php echo htmlspecialchars($user_name); ?></span>
                    </div>
                    <div class="info-row">
                        <span class="label">Payment Method</span>
                        <span class="colon">:</span>
                        <span class="value"><?php echo htmlspecialchars($payment_method); ?></span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Items Table -->
        <div class="items-section">
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width: 40px;">S.N</th>
                        <th style="text-align:left; width: 80px;">Component</th>
                        <th style="text-align:left;">Product Name & Specification</th>
                        <th style="width: 80px;">Warranty</th>
                        <th style="width: 45px;">Qty</th>
                        <th style="text-align:right; width: 95px;">Unit Price</th>
                        <th style="text-align:right; width: 95px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <?php $sl = 1; foreach($items as $item): ?>
                    <tr>
                        <td class="center"><?php echo $sl++; ?></td>
                        <td class="left"><?php echo htmlspecialchars($item['category_name']); ?></td>
                        <td class="left">
                            <?php echo htmlspecialchars($item['product_name']); ?>
                            <?php if(!empty($item['display_serial'])): ?>
                                <div class="serial-text">S.N: <?php echo htmlspecialchars($item['display_serial']); ?></div>
                            <?php endif; ?>
                        </td>
                        <td class="center">
                            <?php 
                            $warranty_text = trim($item['display_warranty']);
                            if(!empty($warranty_text) && $warranty_text != '—' && $warranty_text != 'No Warranty'): 
                            ?>
                                <span class="warranty-badge"><?php echo htmlspecialchars($warranty_text); ?></span>
                            <?php else: ?>
                                <span class="no-warranty">No Warranty</span>
                            <?php endif; ?>
                        </td>
                        <td class="center"><?php echo $item['quantity']; ?> pc</td>
                        <td class="right"><?php echo number_format($item['price'], 2); ?> Tk</td>
                        <td class="right" style="font-weight: 500;"><?php echo number_format($item['total'], 2); ?> Tk</td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        
        <!-- Totals Section -->
        <div class="totals-section">
            <div class="totals-flex">
                <div class="totals-box">
                    <div class="totals-row">
                        <span class="label">Total Amount</span>
                        <span class="value"><?php echo number_format($total_amount, 2); ?> Tk</span>
                    </div>
                    <div class="totals-row">
                        <span class="label">Vat, Tax & AIT</span>
                        <span class="value"><?php echo number_format($vat_amount, 2); ?> Tk</span>
                    </div>
                    <div class="totals-row discount">
                        <span class="label">Discount</span>
                        <span class="value">- <?php echo number_format($discount, 2); ?> Tk</span>
                    </div>
                    <div class="totals-row total totals-border">
                        <span class="label">Net Payable Amount</span>
                        <span class="value"><?php echo number_format($net_payable, 2); ?> Tk</span>
                    </div>
                    <?php if($previous_due > 0): ?>
                    <div class="totals-row due">
                        <span class="label">Previous Due Amount</span>
                        <span class="value"><?php echo number_format($previous_due, 2); ?> Tk</span>
                    </div>
                    <?php endif; ?>
                    <div class="totals-row paid">
                        <span class="label">Received Amount</span>
                        <span class="value"><?php echo number_format($paid, 2); ?> Tk</span>
                    </div>
                    <div class="totals-row total-due totals-border-bottom">
                        <span class="label" style="font-weight:600;">Current Due Amount</span>
                        <span class="value" style="font-weight:600; color:#ef4444;"><?php echo number_format($due, 2); ?> Tk</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Amount in Words -->
        <div class="words-section">
            <p><strong>In words:</strong> <?php echo $total_in_words; ?></p>
        </div>
        
        <!-- Signature Section -->
        <div class="signature-section">
            <div class="signature-flex">
                <div class="signature-box">
                    <p>Customer's Signature</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box right">
                    <p>Authority Signature</p>
                    <div class="signature-line"></div>
                </div>
            </div>
        </div>
        
        <!-- Warranty Note -->
        <div class="warranty-note">
            <p>No warranty will valid upon burn or physical damage cases.</p>
        </div>
        
    </div>
    
    <!-- Buttons -->
    <div class="no-print">
        <button onclick="window.print()" class="btn-print-gradient"><i class="fas fa-print"></i> Print Invoice</button>
        <a href="sales.php" class="btn-back"><i class="fas fa-arrow-left"></i> Back to Sales</a>
    </div>
</div>

</body>
</html>