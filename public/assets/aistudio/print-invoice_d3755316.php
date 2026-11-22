<?php
$page_title = 'Print Invoice - Youth IT POS';
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

// print-invoice.php - শুধুমাত্র এই অংশটি পরিবর্তন করুন

// Get invoice items with serial numbers - সরাসরি sale_items থেকে
$stmt = $pdo->prepare("SELECT 
                       si.product_name,
                       si.category_name,
                       si.quantity,
                       si.price,
                       si.total,
                       si.serial_no as display_serial,
                       si.warranty as display_warranty
                       FROM sale_items si 
                       WHERE si.sale_id = ?");
$stmt->execute([$invoice_id]);
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get category for each item
foreach($items as $key => $item) {
    $stmt_cat = $pdo->prepare("SELECT c.name as category_name FROM categories c 
                               INNER JOIN products p ON p.category_id = c.id 
                               WHERE p.id = ?");
    $stmt_cat->execute([$item['product_id']]);
    $cat = $stmt_cat->fetch(PDO::FETCH_ASSOC);
    $items[$key]['category_name'] = $cat['category_name'] ?? '—';
    
    // Warranty
    $items[$key]['display_warranty'] = $item['warranty_name'] ?? '';
    
    // Serial number - from sale_items
    $items[$key]['display_serial'] = $item['serial_number'] ?? '';
}

// Get company settings
$stmt = $pdo->query("SELECT key_name, value FROM settings");
$settings = [];
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

// Calculate previous due
$previous_due = 0;
if ($invoice['customer_id']) {
    $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
    $stmt->execute([$invoice['customer_id']]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    $previous_due = $customer['opening_balance'] ?? 0;
}

$total_due = $previous_due + $invoice['due'];
$subtotal = $invoice['total'] + $invoice['discount'];
$payment_term = isset($invoice['payment_term']) && !empty($invoice['payment_term']) ? $invoice['payment_term'] : 'Cash';

function numberToWords($number) {
    $hyphen = '-';
    $conjunction = ' and ';
    $separator = ', ';
    $negative = 'negative ';
    $decimal = ' point ';
    $dictionary = array(
        0 => 'Zero', 1 => 'One', 2 => 'Two', 3 => 'Three', 4 => 'Four', 5 => 'Five', 6 => 'Six', 7 => 'Seven', 8 => 'Eight', 9 => 'Nine',
        10 => 'Ten', 11 => 'Eleven', 12 => 'Twelve', 13 => 'Thirteen', 14 => 'Fourteen', 15 => 'Fifteen', 16 => 'Sixteen', 17 => 'Seventeen', 18 => 'Eighteen', 19 => 'Nineteen',
        20 => 'Twenty', 30 => 'Thirty', 40 => 'Forty', 50 => 'Fifty', 60 => 'Sixty', 70 => 'Seventy', 80 => 'Eighty', 90 => 'Ninety',
        100 => 'Hundred', 1000 => 'Thousand', 1000000 => 'Million', 1000000000 => 'Billion'
    );
    
    if (!is_numeric($number)) {
        return false;
    }
    
    $number = floatval($number);
    if ($number < 0) {
        return $negative . numberToWords(abs($number));
    }
    
    $string = $fraction = null;
    if (strpos($number, '.') !== false) {
        list($number, $fraction) = explode('.', $number);
    }
    
    switch (true) {
        case $number < 21:
            $string = $dictionary[$number];
            break;
        case $number < 100:
            $tens = floor($number / 10) * 10;
            $units = $number % 10;
            $string = $dictionary[$tens];
            if ($units) {
                $string .= $hyphen . $dictionary[$units];
            }
            break;
        case $number < 1000:
            $hundreds = floor($number / 100);
            $remainder = $number % 100;
            $string = $dictionary[$hundreds] . ' ' . $dictionary[100];
            if ($remainder) {
                $string .= $conjunction . numberToWords($remainder);
            }
            break;
        default:
            $baseUnits = array(1000000000 => 'Billion', 1000000 => 'Million', 1000 => 'Thousand');
            foreach ($baseUnits as $unit => $unitName) {
                if ($number >= $unit) {
                    $numUnits = floor($number / $unit);
                    $remainder = $number % $unit;
                    $string = numberToWords($numUnits) . ' ' . $unitName;
                    if ($remainder) {
                        $string .= $remainder < 100 ? $conjunction : $separator;
                        $string .= numberToWords($remainder);
                    }
                    break;
                }
            }
            break;
    }
    
    if (null !== $fraction && $fraction > 0) {
        $string .= $decimal;
        $fraction = (string)$fraction;
        for ($i = 0; $i < strlen($fraction); $i++) {
            $string .= ' ' . $dictionary[$fraction[$i]];
        }
    }
    
    return $string;
}

$total_in_words = numberToWords($invoice['total']) . ' Taka Only';

require 'includes/header.php';
?>

<div class="content" style="background: #eef2f6; min-height: 100vh; padding: 30px 15px;">
    <div class="invoice-wrapper" style="max-width: 1000px; margin: 0 auto;">
        <div class="invoice-card" style="background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">
            
            <!-- Header Section -->
            <div style="padding: 18px 25px; border-bottom: 2px solid #eef2f6; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex-shrink: 0; width: 100px;">
                        <?php if(!empty($company_logo) && file_exists($company_logo)): ?>
                            <img src="<?php echo htmlspecialchars($company_logo); ?>" alt="Logo" style="max-height: 70px; max-width: 90px; width: auto; height: auto;">
                        <?php else: ?>
                            <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-store" style="font-size: 35px; color: white;"></i>
                            </div>
                        <?php endif; ?>
                    </div>
                    
                    <div style="position: absolute; left: 50%; transform: translateX(-50%);">
                        <?php if(!empty($company_qr) && file_exists($company_qr)): ?>
                            <div style="width: 70px; height: 70px;">
                                <img src="<?php echo htmlspecialchars($company_qr); ?>" style="width: 100%; height: 100%; object-fit: contain;">
                            </div>
                        <?php else: ?>
                            <div style="width: 70px; height: 70px; background: #f8fafc; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 8px;">
                                <i class="fas fa-qrcode" style="font-size: 35px; color: #94a3b8;"></i>
                            </div>
                        <?php endif; ?>
                    </div>
                    
                    <div style="text-align: right; flex: 1;">
                        <?php if(!empty($youth_it_part)): ?>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">
                                <span style="color: #065AA4;"><?php echo htmlspecialchars($youth_it_part); ?></span>
                                <?php if(!empty($pos_part)): ?>
                                <span style="color: #1e293b;"><?php echo htmlspecialchars($pos_part); ?></span>
                                <?php endif; ?>
                            </h1>
                        <?php else: ?>
                            <h1 style="margin: 0; font-size: 24px; color: #065AA4; font-weight: 800;"><?php echo htmlspecialchars($company_name_upper); ?></h1>
                        <?php endif; ?>
                        <p style="margin: 6px 0 0; font-size: 11px; color: #64748b; line-height: 1.3;"><?php echo nl2br(htmlspecialchars($company_address)); ?></p>
                        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">📞 Cell: <?php echo htmlspecialchars($company_phone); ?></p>
                        <p style="margin: 2px 0 0; font-size: 11px; color: #64748b;">✉️ <?php echo htmlspecialchars($company_email); ?> | 🌐 <?php echo htmlspecialchars($company_website); ?></p>
                    </div>
                </div>
            </div>
            
            <!-- INVOICE Title -->
            <div style="padding: 5px 25px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 1px solid #eef2f6; text-align: center;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; background-clip: text; color: darkblue;">INVOICE</h2>
            </div>
            
            <!-- To Section -->
            <div style="padding: 12px 25px; border-bottom: 1px solid #eef2f6;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1;">
                        <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1e293b;">To,</p>
                        <p style="margin: 5px 0 0; font-size: 12px; color: #475569; line-height: 1.4;">
                            <?php echo htmlspecialchars($invoice['customer_name'] ?? 'Walk-in Customer'); ?><br>
                            <?php echo htmlspecialchars($invoice['customer_address'] ?? '—'); ?><br>
                            <?php echo htmlspecialchars($invoice['customer_phone'] ?? '—'); ?>
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0 0 5px; font-size: 12px;"><strong>Invoice No:</strong> <?php echo htmlspecialchars($invoice['invoice_no']); ?></p>
                        <p style="margin: 0 0 5px; font-size: 12px;"><strong>Date:</strong> <?php echo date('d-m-Y', strtotime($invoice['created_at'])); ?></p>
                        <p style="margin: 0 0 5px; font-size: 12px;"><strong>Sold By:</strong> <?php echo htmlspecialchars($invoice['created_by'] ?? 'Youth IT'); ?></p>
                        <p style="margin: 0; font-size: 12px;"><strong>Payment Term:</strong> <?php echo htmlspecialchars($payment_term); ?></p>
                    </div>
                </div>
            </div>
            
            <!-- Items Table -->
            <div style="padding: 12px 25px; overflow-x: auto;">
                <table class="invoice-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 8px 6px; text-align: center; width: 40px;">S.N</th>
                            <th style="padding: 8px 6px; text-align: left; width: 80px;">Component</th>
                            <th style="padding: 8px 6px; text-align: center;">Product Name & Specification</th>
                            <th style="padding: 8px 6px; text-align: center; width: 80px;">Warranty</th>
                            <th style="padding: 8px 6px; text-align: center; width: 45px;">Qty</th>
                            <th style="padding: 8px 6px; text-align: right; width: 95px;">Unit Price</th>
                            <th style="padding: 8px 6px; text-align: right; width: 95px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php $sl = 1; foreach($items as $item): ?>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 6px 6px; text-align: center;"><?php echo $sl++; ?></td>
                            <td style="padding: 6px 6px; text-align: left;"><?php echo htmlspecialchars($item['category_name']); ?></td>
                            <td style="padding: 6px 6px; text-align: left;">
                                <?php echo htmlspecialchars($item['product_name']); ?>
                                <?php if(!empty($item['display_serial'])): ?>
                                    <div style="font-size: 10px; color: #2563eb; margin-top: 3px; text-align: left;">
                                        S.N: <?php echo htmlspecialchars($item['display_serial']); ?>
                                    </div>
                                <?php endif; ?>
                            </td>
                            <td style="padding: 6px 6px; text-align: center;">
                                <?php if(!empty($item['display_warranty'])): ?>
                                    <span style="color: #000000; font-size: 10px;"><?php echo htmlspecialchars($item['display_warranty']); ?></span>
                                <?php else: ?>
                                    <span style="color: #94a3b8;">—</span>
                                <?php endif; ?>
                            </td>
                            <td style="padding: 6px 6px; text-align: center;"><?php echo $item['quantity']; ?> pc</td>
                            <td style="padding: 6px 6px; text-align: right;"><?php echo formatMoney($item['price']); ?> Tk</td>
                            <td style="padding: 6px 6px; text-align: right; font-weight: 500;"><?php echo formatMoney($item['total']); ?> Tk</td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            
            <!-- Totals Section -->
            <div style="padding: 10px 25px; background: #fafcff; border-top: 1px solid #eef2f6;">
                <div style="display: flex; justify-content: flex-end;">
                    <div style="width: 280px;">
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">Subtotal:</span><span style="font-size: 12px;"><?php echo formatMoney($subtotal); ?> Tk</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">VAT (8%):</span><span style="font-size: 12px;">0.00 Tk</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">Discount:</span><span style="font-size: 12px; color: #ef4444;"><?php echo formatMoney($invoice['discount']); ?> Tk</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 4px; border-top: 2px solid #e2e8f0;"><span style="font-size: 14px; font-weight: 700;">Total Amount:</span><span style="font-size: 14px; font-weight: 700; color: #667eea;"><?php echo formatMoney($invoice['total']); ?> Tk</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">Total Paid:</span><span style="font-size: 12px; color: #10b981;"><?php echo formatMoney($invoice['paid']); ?> Tk</span></div>
                        <?php if($previous_due > 0): ?><div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">Previous Due:</span><span style="font-size: 12px; color: #ef4444;"><?php echo formatMoney($previous_due); ?> Tk</span></div><?php endif; ?>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span style="font-size: 12px;">Current Due:</span><span style="font-size: 12px; <?php echo $invoice['due'] > 0 ? 'color: #ef4444;' : 'color: #10b981;'; ?>"><?php echo formatMoney($invoice['due']); ?> Tk</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 4px; border-top: 1px solid #eef2f6;"><span style="font-size: 13px; font-weight: 700;">Total Due:</span><span style="font-size: 13px; font-weight: 700; color: #ef4444;"><?php echo formatMoney($total_due); ?> Tk</span></div>
                    </div>
                </div>
            </div>
            
            <!-- Amount in Words -->
            <div style="padding: 10px 25px; background: #fff; border-bottom: 1px solid #eef2f6;">
                <p style="margin: 0; font-size: 12px;"><strong>In words:</strong> <?php echo $total_in_words; ?></p>
            </div>
            
            <!-- Signature Section -->
            <div style="padding: 15px 25px 12px 25px; background: #f8fafc;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 25px;">
                    <div style="text-align: left; flex: 1;"><p style="margin: 0; font-size: 11px;">Customer's Signature</p><div style="margin-top: 35px; border-top: 1px dashed #cbd5e1; width: 180px;"></div></div>
                    <div style="text-align: right; flex: 1;"><p style="margin: 0; font-size: 11px;">Authority Signature</p><div style="margin-top: 35px; border-top: 1px dashed #cbd5e1; width: 180px; margin-left: auto;"></div></div>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="padding: 8px 25px; background: #f8fafc; text-align: center; border-top: 1px solid #eef2f6;">
                <p style="margin: 0; font-size: 10px; color: #94a3b8;">Thank you for your business!</p>
                <p style="margin: 3px 0 0; font-size: 10px; color: #94a3b8;">This is a computer generated invoice</p>
            </div>
            
        </div>
        
        <div class="no-print" style="display: flex; gap: 15px; justify-content: center; margin-top: 20px;">
            <button onclick="window.print()" class="btn-print-gradient" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 10px 30px; border-radius: 8px; cursor: pointer; font-weight: 600;"><i class="fas fa-print"></i> Print Invoice</button>
            <a href="sales.php" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; padding: 10px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;"><i class="fas fa-arrow-left"></i> Back to Sales</a>
        </div>
    </div>
</div>

<style>
.btn-print-gradient:hover {
    background: linear-gradient(135deg, #764ba2, #667eea) !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

@media print {
    .no-print, .sidebar, .top-bar, .action-dropdown, .modal-custom, .btn-print-gradient, a[href="sales.php"], button, .btn { display: none !important; }
    .main-content { margin-left: 0 !important; padding: 0 !important; }
    .content { padding: 0 !important; background: white !important; margin: 0 !important; }
    .invoice-wrapper { margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
    .invoice-card { margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
    body { background: white; margin: 0; padding: 0; }
    @page { size: A4; margin: 0.5cm; }
    .invoice-card, .content, .invoice-wrapper { page-break-after: avoid; page-break-before: avoid; page-break-inside: avoid; }
    .invoice-table { width: 100% !important; }
    .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 4px; }
    thead tr { background: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>

<?php require 'includes/footer.php'; ?>