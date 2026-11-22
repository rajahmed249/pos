<?php
$page_title = 'POS Management - Youth IT POS';

require_once $_SERVER['DOCUMENT_ROOT'] . '/config.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/includes/functions.php';
redirectIfNotLoggedIn();

// ===== SESSION INITIALIZATION =====
if (!isset($_SESSION['cart'])) $_SESSION['cart'] = [];
if (!isset($_SESSION['pos_customer'])) $_SESSION['pos_customer'] = 0;
if (!isset($_SESSION['pos_date'])) $_SESSION['pos_date'] = date('Y-m-d');
if (!isset($_SESSION['pos_previous_due'])) $_SESSION['pos_previous_due'] = 0;

// ===== AJAX HANDLERS =====

// Set customer (AJAX)
if (isset($_POST['ajax_set_customer'])) {
    header('Content-Type: application/json');
    $customer_id = (int)$_POST['customer_id'];
    $_SESSION['pos_customer'] = $customer_id;
    
    $due = 0;
    $name = 'Walk-in Customer';
    if ($customer_id > 0) {
        $stmt = $pdo->prepare("SELECT name, opening_balance FROM customers WHERE id = ?");
        $stmt->execute([$customer_id]);
        $cust = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($cust) {
            $due = floatval($cust['opening_balance'] ?? 0);
            $name = $cust['name'];
        }
    }
    $_SESSION['pos_previous_due'] = $due;
    
    echo json_encode(['success' => true, 'customer_id' => $customer_id, 'customer_name' => $name, 'previous_due' => $due]);
    exit;
}

// Set date (AJAX)
if (isset($_POST['ajax_set_date'])) {
    header('Content-Type: application/json');
    $_SESSION['pos_date'] = $_POST['date'];
    echo json_encode(['success' => true, 'date' => $_SESSION['pos_date']]);
    exit;
}

// Save cart edits (AJAX) - serial/qty/price
if (isset($_POST['ajax_save_cart_edits'])) {
    header('Content-Type: application/json');
    $serials = $_POST['cart_serials'] ?? [];
    $qtys = $_POST['cart_qtys'] ?? [];
    $prices = $_POST['cart_prices'] ?? [];
    
    if (is_array($serials)) {
        foreach ($serials as $pid => $serial) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['serial'] = $serial;
            }
        }
    }
    if (is_array($qtys)) {
        foreach ($qtys as $pid => $qty) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['qty'] = (int)$qty;
                $_SESSION['cart'][$pid]['total'] = (int)$qty * $_SESSION['cart'][$pid]['price'];
            }
        }
    }
    if (is_array($prices)) {
        foreach ($prices as $pid => $prc) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['price'] = floatval($prc);
                $_SESSION['cart'][$pid]['total'] = $_SESSION['cart'][$pid]['qty'] * floatval($prc);
            }
        }
    }
    echo json_encode(['success' => true]);
    exit;
}

// Update cart item (AJAX)
if (isset($_POST['ajax_update_item'])) {
    header('Content-Type: application/json');
    $id = $_POST['product_id'];
    $qty = (int)$_POST['qty'];
    $price = floatval($_POST['price']);
    $serial = $_POST['serial'] ?? '';
    
    if (isset($_SESSION['cart'][$id])) {
        $_SESSION['cart'][$id]['qty'] = $qty;
        $_SESSION['cart'][$id]['price'] = $price;
        $_SESSION['cart'][$id]['serial'] = $serial;
        $_SESSION['cart'][$id]['total'] = $qty * $price;
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false]);
    }
    exit;
}

// Get customer due
if (isset($_POST['ajax_get_due'])) {
    header('Content-Type: application/json');
    $customer_id = (int)$_POST['customer_id'];
    $due = 0;
    if ($customer_id > 0) {
        $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
        $stmt->execute([$customer_id]);
        $cust = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($cust) $due = floatval($cust['opening_balance'] ?? 0);
    }
    echo json_encode(['success' => true, 'previous_due' => $due]);
    exit;
}

// ===== FORM HANDLERS =====

// Add to cart
if (isset($_POST['add_to_cart'])) {
    $id = $_POST['product_id'];
    $name = $_POST['product_name'];
    $price = floatval($_POST['product_price']);
    $sku = $_POST['product_sku'] ?? '';
    $warranty = $_POST['product_warranty'] ?? '';
    
    // IMPORTANT: Save customer and date from POST if they came with add_to_cart
    if (isset($_POST['current_customer_id'])) {
        $_SESSION['pos_customer'] = (int)$_POST['current_customer_id'];
        if ($_SESSION['pos_customer'] > 0) {
            $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
            $stmt->execute([$_SESSION['pos_customer']]);
            $cust = $stmt->fetch(PDO::FETCH_ASSOC);
            $_SESSION['pos_previous_due'] = $cust ? floatval($cust['opening_balance'] ?? 0) : 0;
        } else {
            $_SESSION['pos_previous_due'] = 0;
        }
    }
    if (isset($_POST['current_date']) && !empty($_POST['current_date'])) {
        $_SESSION['pos_date'] = $_POST['current_date'];
    }
    
    // Save existing cart item edits from POST
    if (isset($_POST['cart_serials']) && is_array($_POST['cart_serials'])) {
        foreach ($_POST['cart_serials'] as $pid => $serial) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['serial'] = $serial;
            }
        }
    }
    if (isset($_POST['cart_qtys']) && is_array($_POST['cart_qtys'])) {
        foreach ($_POST['cart_qtys'] as $pid => $qty) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['qty'] = (int)$qty;
                $_SESSION['cart'][$pid]['total'] = (int)$qty * $_SESSION['cart'][$pid]['price'];
            }
        }
    }
    if (isset($_POST['cart_prices']) && is_array($_POST['cart_prices'])) {
        foreach ($_POST['cart_prices'] as $pid => $prc) {
            if (isset($_SESSION['cart'][$pid])) {
                $_SESSION['cart'][$pid]['price'] = floatval($prc);
                $_SESSION['cart'][$pid]['total'] = $_SESSION['cart'][$pid]['qty'] * floatval($prc);
            }
        }
    }
    
    $stockStmt = $pdo->prepare("SELECT stock_quantity FROM products WHERE id = ? AND status = 1");
    $stockStmt->execute([$id]);
    $productStock = $stockStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($productStock) {
        $availableStock = intval($productStock['stock_quantity']);
        if ($availableStock > 0) {
            if (isset($_SESSION['cart'][$id])) {
                if ($_SESSION['cart'][$id]['qty'] < $availableStock) {
                    $_SESSION['cart'][$id]['qty']++;
                    $_SESSION['cart'][$id]['total'] = $_SESSION['cart'][$id]['qty'] * $_SESSION['cart'][$id]['price'];
                }
            } else {
                $_SESSION['cart'][$id] = [
                    'id' => $id, 'name' => $name, 'price' => $price, 'qty' => 1,
                    'total' => $price, 'sku' => $sku, 'warranty' => $warranty, 'serial' => ''
                ];
            }
        }
    }
    
    header('Location: /pos');
    exit;
}

// Remove from cart
if (isset($_GET['remove'])) {
    unset($_SESSION['cart'][$_GET['remove']]);
    header('Location: /pos');
    exit;
}

// Clear cart
if (isset($_GET['clear_cart'])) {
    unset($_SESSION['cart'], $_SESSION['pos_customer'], $_SESSION['pos_date'], $_SESSION['pos_previous_due']);
    header("Location: /pos");
    exit();
}

// Set customer (form)
if (isset($_POST['set_customer'])) {
    $_SESSION['pos_customer'] = (int)$_POST['customer_id'];
    if ($_SESSION['pos_customer'] > 0) {
        $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
        $stmt->execute([$_SESSION['pos_customer']]);
        $cust = $stmt->fetch(PDO::FETCH_ASSOC);
        $_SESSION['pos_previous_due'] = $cust ? floatval($cust['opening_balance'] ?? 0) : 0;
    } else {
        $_SESSION['pos_previous_due'] = 0;
    }
    header('Location: /pos');
    exit;
}

// Set date (form)
if (isset($_POST['set_date'])) {
    $_SESSION['pos_date'] = $_POST['date'];
    header('Location: /pos');
    exit;
}

// ===== SAVE SALE =====
if (isset($_POST['save_sale'])) {
    $subtotal = floatval($_POST['subtotal'] ?? 0);
    $discount = floatval($_POST['discount'] ?? 0);
    $vat = floatval($_POST['vat'] ?? 0);
    $paid = floatval($_POST['paid'] ?? 0);
    $customer_id = (int)($_POST['customer_id'] ?? 0);
    $payment_method = $_POST['payment_method'] ?? 'cash';
    $note = trim($_POST['note'] ?? '');
    
    // CRITICAL FIX: Use sale_date from form directly
    $sale_date = !empty($_POST['sale_date']) ? $_POST['sale_date'] : ($_SESSION['pos_date'] ?? date('Y-m-d'));
    // Ensure it has time component
    if (strlen($sale_date) <= 10) {
        $sale_date = $sale_date . ' ' . date('H:i:s');
    }
    
    $cart_items = json_decode($_POST['cart_items'] ?? '[]', true);
    
    if (empty($cart_items)) {
        $_SESSION['error'] = "Cart is empty!";
        header('Location: /pos');
        exit;
    }
    
    $invoice_no = 'INV-' . date('Ymd') . '-' . rand(1000, 9999);
    
    try {
        $pdo->beginTransaction();
        
        $previous_due = 0;
        if ($customer_id > 0) {
            $stmt = $pdo->prepare("SELECT opening_balance FROM customers WHERE id = ?");
            $stmt->execute([$customer_id]);
            $c = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($c) $previous_due = floatval($c['opening_balance'] ?? 0);
        }
        
        $total_amount = $subtotal - $discount + $vat;
        $due_amount = max(0, $total_amount - $paid);
        
        $columns = [];
        $colStmt = $pdo->query("SHOW COLUMNS FROM sales");
        while ($col = $colStmt->fetch(PDO::FETCH_ASSOC)) $columns[] = $col['Field'];
        
        $insert_fields = ['invoice_no'];
        $placeholders = ['?'];
        $values = [$invoice_no];
        
        $field_map = [
            'customer_id' => $customer_id,
            'total' => $total_amount,
            'total_amount' => $total_amount,
            'paid' => $paid,
            'paid_amount' => $paid,
            'due' => $due_amount,
            'due_amount' => $due_amount,
            'discount' => $discount,
            'tax' => $vat,
            'payment_method' => $payment_method,
            'note' => $note,
            'sale_date' => $sale_date,
            'user_id' => $_SESSION['user_id'] ?? 1,
            'status' => 1
        ];
        
        foreach ($field_map as $field => $value) {
            if (in_array($field, $columns) && !in_array($field, $insert_fields)) {
                $insert_fields[] = $field;
                $placeholders[] = '?';
                $values[] = $value;
            }
        }
        
        if (in_array('created_at', $columns) && !in_array('created_at', $insert_fields)) {
            $insert_fields[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        
        $sql = "INSERT INTO sales (" . implode(', ', $insert_fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
        $sale_id = $pdo->lastInsertId();
        
        $stmt_item = $pdo->prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price, total, serial_no, warranty) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt_stock = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
        
        foreach ($cart_items as $item) {
            $stmt_item->execute([
                $sale_id, $item['id'], $item['qty'], $item['price'], $item['total'],
                $item['serial'] ?? '', $item['warranty'] ?? ''
            ]);
            $stmt_stock->execute([$item['qty'], $item['id']]);
        }
        
        if ($customer_id > 0 && $due_amount > 0) {
            $stmt = $pdo->prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?");
            $stmt->execute([$due_amount, $customer_id]);
        }
        
        $pdo->commit();
        
        unset($_SESSION['cart'], $_SESSION['pos_customer'], $_SESSION['pos_date'], $_SESSION['pos_previous_due']);
        
        $_SESSION['success'] = "Sale completed successfully! Invoice: " . $invoice_no;
        header('Location: /invoice.php?id=' . $sale_id);
        exit;
        
    } catch (Exception $e) {
        $pdo->rollBack();
        $_SESSION['error'] = "Error: " . $e->getMessage();
        header('Location: /pos');
        exit;
    }
}

// ===== GET DATA =====
$products = [];
try {
    $stmt = $pdo->query("SELECT p.*, w.duration as warranty_name FROM products p LEFT JOIN warranties w ON p.warranty_id = w.id WHERE p.status = 1 ORDER BY p.name");
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$customers = [];
try {
    $stmt = $pdo->query("SELECT * FROM customers ORDER BY name");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$bankAccounts = [];
try {
    $stmt = $pdo->query("SELECT id, account_name FROM bank_accounts ORDER BY account_name");
    $bankAccounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$subtotal = 0;
foreach ($_SESSION['cart'] as $item) $subtotal += $item['total'];

$selected_customer = $_SESSION['pos_customer'] ?? 0;
$selected_date = $_SESSION['pos_date'] ?? date('Y-m-d');
$previous_due = $_SESSION['pos_previous_due'] ?? 0;

$selected_customer_name = 'Walk-in Customer';
if ($selected_customer > 0) {
    foreach ($customers as $c) {
        if ($c['id'] == $selected_customer) {
            $selected_customer_name = $c['name'];
            break;
        }
    }
}

include $_SERVER['DOCUMENT_ROOT'] . '/includes/header.php';
?>

<div class="content">
    <?php if (isset($_SESSION['success'])): ?>
        <div class="alert-success" style="background:#d1fae5; color:#065f46; padding:12px; border-radius:10px; margin-bottom:15px;">
            <i class="fas fa-check-circle"></i> <?php echo $_SESSION['success']; unset($_SESSION['success']); ?>
        </div>
    <?php endif; ?>
    <?php if (isset($_SESSION['error'])): ?>
        <div class="alert-danger" style="background:#fee2e2; color:#991b1b; padding:12px; border-radius:10px; margin-bottom:15px;">
            <i class="fas fa-exclamation-circle"></i> <?php echo $_SESSION['error']; unset($_SESSION['error']); ?>
        </div>
    <?php endif; ?>
    
    <div class="pos-wrapper">
        <div class="pos-left">
            <div class="pos-manager-card">
                <h3><i class="fas fa-cash-register"></i> New Sale</h3>
                
                <!-- Search Product Form (standalone) -->
                <div class="scan-barcode">
                    <input type="text" id="productSearchInput" class="search-product-input" placeholder="Search product by name or barcode..." autocomplete="off">
                    <div id="searchResults" class="product-search-results"></div>
                </div>
                
                <div class="date-customer-row">
                    <div class="date-box">
                        <i class="fas fa-calendar-alt"></i>
                        <input type="text" id="datePicker" value="<?php echo $selected_date; ?>" placeholder="Select Date" style="flex:1;border:none;background:transparent;padding:8px 0;font-size:14px;outline:none;">
                    </div>
                    <div class="customer-box" style="position:relative;">
                        <i class="fas fa-user"></i>
                        <input type="hidden" id="selectedCustomerId" value="<?php echo $selected_customer; ?>">
                        <input type="text" id="customerSearchInput" class="customer-search-input" placeholder="Search customer..." value="<?php echo htmlspecialchars($selected_customer_name); ?>" autocomplete="off" readonly style="cursor:pointer;">
                        <div id="customerDropdown" class="customer-dropdown" style="display:none;">
                            <div class="customer-search-wrapper">
                                <i class="fas fa-search"></i>
                                <input type="text" id="customerDropdownSearch" class="customer-dropdown-search" placeholder="Type to search customer..." autocomplete="off">
                            </div>
                            <div id="customerList" class="customer-list"></div>
                        </div>
                    </div>
                </div>
                
                <!-- HIDDEN FORM to submit add_to_cart from search results -->
                <form method="POST" action="/pos" id="globalAddToCartForm" style="display:none;">
                    <input type="hidden" name="add_to_cart" value="1">
                    <input type="hidden" name="product_id" id="gac_product_id">
                    <input type="hidden" name="product_name" id="gac_product_name">
                    <input type="hidden" name="product_price" id="gac_product_price">
                    <input type="hidden" name="product_sku" id="gac_product_sku">
                    <input type="hidden" name="product_warranty" id="gac_product_warranty">
                    <input type="hidden" name="current_customer_id" id="gac_customer_id">
                    <input type="hidden" name="current_date" id="gac_current_date">
                    <div id="gac_cart_edits"></div>
                </form>
                
                <div class="cart-items" id="cartItems">
                    <?php if (empty($_SESSION['cart'])): ?>
                    <div class="empty-cart">
                        <i class="fas fa-cart-plus"></i>
                        <p>Cart is empty</p>
                        <small>Search and add products to continue</small>
                    </div>
                    <?php else: ?>
                    <div class="table-responsive">
                        <table class="cart-table" id="cartTable">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Serial</th>
                                    <th>Warranty</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Sub Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($_SESSION['cart'] as $id => $item): ?>
                                <tr id="cartRow_<?php echo $id; ?>" data-id="<?php echo $id; ?>">
                                    <td data-label="Product">
                                        <strong><?php echo htmlspecialchars($item['name']); ?></strong>
                                        <br><small>SKU: <?php echo htmlspecialchars($item['sku']); ?></small>
                                    </td>
                                    <td data-label="Serial">
                                        <input type="text" class="serial-input" data-id="<?php echo $id; ?>" value="<?php echo htmlspecialchars($item['serial'] ?? ''); ?>" placeholder="Serial No" style="width:120px;padding:4px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;">
                                    </td>
                                    <td data-label="Warranty">
                                        <?php if (!empty($item['warranty'])): ?>
                                            <span class="warranty-badge"><?php echo htmlspecialchars($item['warranty']); ?></span>
                                        <?php else: ?>
                                            <span class="no-warranty">—</span>
                                        <?php endif; ?>
                                    </td>
                                    <td data-label="Qty">
                                        <input type="number" class="qty-input" data-id="<?php echo $id; ?>" value="<?php echo $item['qty']; ?>" min="1" style="width:60px;padding:4px;border:1px solid #e2e8f0;border-radius:4px;text-align:center;font-size:12px;">
                                    </td>
                                    <td data-label="Price">
                                        <input type="number" class="price-input" data-id="<?php echo $id; ?>" value="<?php echo $item['price']; ?>" step="0.01" style="width:80px;padding:4px;border:1px solid #e2e8f0;border-radius:4px;text-align:right;font-size:12px;">
                                    </td>
                                    <td data-label="Sub Total" class="item-total" id="total_<?php echo $id; ?>"><?php echo number_format($item['total'], 2); ?></td>
                                    <td data-label="Action">
                                        <a href="/pos?remove=<?php echo $id; ?>" onclick="return confirm('Remove this item?')" class="remove-btn"><i class="fas fa-trash-alt"></i></a>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <?php endif; ?>
                </div>
                
                <div class="cart-total">
                    <div class="total-line"><span>Subtotal:</span><span id="subtotal"><?php echo number_format($subtotal, 2); ?></span></div>
                    <div class="grand-total"><span>Total:</span><span id="totalAmount"><?php echo number_format($subtotal, 2); ?></span></div>
                </div>
                
                <button id="paymentBtn" class="payment-btn">
                    <i class="fas fa-credit-card"></i> Proceed to Payment
                </button>
            </div>
        </div>
        
        <div class="pos-right">
            <div class="product-list-card">
                <h3><i class="fas fa-box"></i> Product List</h3>
                <div class="product-list-header">
                    <h4>All Products</h4>
                    <input type="text" id="searchProduct" class="search-product-input" placeholder="Search...">
                </div>
                <div class="product-items" id="productItemsContainer">
                    <?php foreach ($products as $p): 
                        $stockQty = (int)($p['stock_quantity'] ?? 0);
                        $isStockOut = ($stockQty <= 0);
                    ?>
                    <div class="product-item <?php echo $isStockOut ? 'stock-out-product' : ''; ?>" data-product-name="<?php echo strtolower(htmlspecialchars($p['name'])); ?>">
                        <div class="product-info">
                            <div class="product-name"><?php echo htmlspecialchars($p['name']); ?></div>
                            <div class="product-sku">SKU: <?php echo $p['sku'] ?? 'N/A'; ?></div>
                            <?php if (!empty($p['warranty_name'])): ?>
                                <div class="product-warranty"><i class="fas fa-shield-alt"></i> <?php echo htmlspecialchars($p['warranty_name']); ?></div>
                            <?php endif; ?>
                            <div class="product-stock <?php echo $isStockOut ? 'stock-out' : 'in-stock'; ?>">
                                <i class="fas fa-boxes"></i> Stock: <?php echo $stockQty; ?>
                            </div>
                        </div>
                        <div class="product-price"><?php echo number_format($p['selling_price'], 2); ?></div>
                        <!-- CHANGED: button triggers JS instead of nested form -->
                        <button type="button" class="add-btn <?php echo $isStockOut ? 'disabled-btn' : ''; ?>" 
                            <?php echo $isStockOut ? 'disabled' : ''; ?>
                            data-pid="<?php echo $p['id']; ?>"
                            data-pname="<?php echo htmlspecialchars($p['name'], ENT_QUOTES); ?>"
                            data-pprice="<?php echo $p['selling_price']; ?>"
                            data-psku="<?php echo htmlspecialchars($p['sku'], ENT_QUOTES); ?>"
                            data-pwarranty="<?php echo htmlspecialchars($p['warranty_name'] ?? '', ENT_QUOTES); ?>">
                            <i class="fas fa-plus"></i> Add
                        </button>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Payment Modal -->
<div id="paymentModal" class="modal">
    <div class="modal-content payment-modal">
        <div class="modal-header payment-modal-header">
            <div class="modal-title">
                <i class="fas fa-credit-card"></i>
                <h4>Payment Details</h4>
            </div>
            <button class="close-modal" id="closeModalBtn"><i class="fas fa-times"></i></button>
        </div>
        
        <form method="POST" id="paymentForm" action="/pos">
            <input type="hidden" name="save_sale" value="1">
            <input type="hidden" name="subtotal" id="formSubtotal">
            <input type="hidden" name="discount" id="formDiscount">
            <input type="hidden" name="vat" id="formVat">
            <input type="hidden" name="paid" id="formPaid">
            <input type="hidden" name="customer_id" id="formCustomerId" value="<?php echo $selected_customer; ?>">
            <input type="hidden" name="payment_method" id="formPaymentMethod" value="cash">
            <input type="hidden" name="sale_date" id="formSaleDate" value="<?php echo $selected_date . ' ' . date('H:i:s'); ?>">
            <input type="hidden" name="cart_items" id="formCartItems">
        
            <div class="payment-modal-body">
                <div class="order-summary">
                    <h5><i class="fas fa-shopping-cart"></i> Order Summary</h5>
                    <div class="summary-stats">
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-label">Total Items</span>
                                <span class="stat-value" id="modalItemCount"><?php echo count($_SESSION['cart']); ?></span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-label">Subtotal</span>
                                <span class="stat-value" id="modalSubtotal"><?php echo number_format($subtotal, 2); ?></span>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-info">
                                <span class="stat-label">Previous Due</span>
                                <span class="stat-value" id="modalPreviousDue" style="color:#ef4444;"><?php echo number_format($previous_due, 2); ?></span>
                            </div>
                        </div>
                        <div class="stat-card highlight">
                            <div class="stat-info">
                                <span class="stat-label">Total Amount</span>
                                <span class="stat-value" id="modalTotalAmount"><?php echo number_format($subtotal, 2); ?></span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="payment-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="discountAmount"><i class="fas fa-percent"></i> Discount Amount</label>
                            <input type="number" id="discountAmount" placeholder="Enter discount amount" value="0" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label for="vatAmount"><i class="fas fa-percentage"></i> Vat, Tax & AIT</label>
                            <input type="number" id="vatAmount" placeholder="Enter VAT amount" value="0" step="0.01" min="0">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="transactionAccount"><i class="fas fa-university"></i> Payment Method</label>
                            <select id="transactionAccount">
                                <option value="cash" selected>Cash</option>
                                <option value="card">Card</option>
                                <option value="mobile_banking">Mobile Banking</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <?php foreach ($bankAccounts as $account): ?>
                                    <option value="<?php echo strtolower(str_replace(' ', '_', $account['account_name'])); ?>">
                                        <?php echo htmlspecialchars($account['account_name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="payAmount"><i class="fas fa-hand-holding-usd"></i> Received Amount</label>
                            <div class="amount-input-wrapper">
                                <input type="number" id="payAmount" placeholder="Enter received amount..." step="0.01" min="0">
                                <button type="button" id="paidBtn" class="paid-btn">PAID</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-bottom:12px;">
                        <label for="note"><i class="fas fa-sticky-note"></i> Note</label>
                        <input type="text" id="note" name="note" placeholder="Write your note here..." style="width:100%;padding:8px 10px;border:2px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
                    </div>
                    
                    <div class="payment-summary">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <strong id="modalSubtotalDisplay"><?php echo number_format($subtotal, 2); ?></strong>
                        </div>
                        <div class="summary-row" style="color:#ef4444;">
                            <span>Discount:</span>
                            <strong id="modalDiscountDisplay">0.00</strong>
                        </div>
                        <div class="summary-row" style="color:#667eea;">
                            <span>Vat, Tax & AIT:</span>
                            <strong id="modalVatDisplay">0.00</strong>
                        </div>
                        <div class="summary-row" style="font-weight:700;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;">
                            <span>Net Payable Amount:</span>
                            <strong id="modalNetPayable"><?php echo number_format($subtotal, 2); ?></strong>
                        </div>
                        <div class="summary-row" style="color:#ef4444;">
                            <span>Previous Due Amount:</span>
                            <strong id="modalPreviousDueDisplay"><?php echo number_format($previous_due, 2); ?></strong>
                        </div>
                        <div class="summary-row" style="color:#10b981;">
                            <span>Received Amount:</span>
                            <strong id="modalReceivedDisplay">0.00</strong>
                        </div>
                        <div class="summary-row" style="font-weight:700;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;">
                            <span>Current Due Amount:</span>
                            <strong id="modalCurrentDue" style="color:#ef4444;"><?php echo number_format($subtotal + $previous_due, 2); ?></strong>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-buttons payment-actions">
                <button type="button" id="cancelPayment" class="btn-cancel"><i class="fas fa-times"></i> Cancel</button>
                <button type="submit" id="confirmOrder" class="btn-order"><i class="fas fa-check-circle"></i> Confirm Order</button>
            </div>
        </form>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script>
$(document).ready(function() {
    var productsList = <?php echo json_encode($products); ?>;
    var customersList = <?php echo json_encode($customers); ?>;
    var updateTimeout = null;
    var previousDue = <?php echo $previous_due; ?>;
    var currentCustomerId = <?php echo (int)$selected_customer; ?>;
    var currentDate = '<?php echo $selected_date; ?>';
    
    // ===== DATE PICKER =====
    flatpickr("#datePicker", {
        dateFormat: "Y-m-d",
        defaultDate: currentDate,
        onChange: function(selectedDates, dateStr, instance) {
            currentDate = dateStr;
            $.post('/pos', { ajax_set_date: 1, date: dateStr }, function(resp) {
                // updated
            }, 'json');
        }
    });
    
    // ===== GLOBAL ADD TO CART FUNCTION =====
    function submitAddToCart(productId, productName, productPrice, productSku, productWarranty) {
        // Save cart edits first via AJAX
        var serials = {}, qtys = {}, prices = {};
        $('#cartTable tbody tr').each(function() {
            var pid = $(this).data('id');
            serials[pid] = $(this).find('.serial-input').val() || '';
            qtys[pid] = $(this).find('.qty-input').val() || 1;
            prices[pid] = $(this).find('.price-input').val() || 0;
        });
        
        // Save edits to session
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { 
                ajax_save_cart_edits: 1,
                cart_serials: serials,
                cart_qtys: qtys,
                cart_prices: prices
            },
            dataType: 'json',
            async: false
        });
        
        // Now submit add_to_cart form
        $('#gac_product_id').val(productId);
        $('#gac_product_name').val(productName);
        $('#gac_product_price').val(productPrice);
        $('#gac_product_sku').val(productSku);
        $('#gac_product_warranty').val(productWarranty);
        $('#gac_customer_id').val(currentCustomerId);
        $('#gac_current_date').val(currentDate);
        
        // Add cart edits as hidden inputs to the form
        var editHtml = '';
        $.each(serials, function(pid, serial) {
            editHtml += '<input type="hidden" name="cart_serials[' + pid + ']" value="' + $('<div>').text(serial).html() + '">';
        });
        $.each(qtys, function(pid, qty) {
            editHtml += '<input type="hidden" name="cart_qtys[' + pid + ']" value="' + qty + '">';
        });
        $.each(prices, function(pid, price) {
            editHtml += '<input type="hidden" name="cart_prices[' + pid + ']" value="' + price + '">';
        });
        $('#gac_cart_edits').html(editHtml);
        
        $('#globalAddToCartForm').submit();
    }
    
    // Product list Add button click
    $(document).on('click', '.add-btn[data-pid]', function(e) {
        e.preventDefault();
        if ($(this).prop('disabled')) return;
        submitAddToCart(
            $(this).data('pid'),
            $(this).data('pname'),
            $(this).data('pprice'),
            $(this).data('psku'),
            $(this).data('pwarranty')
        );
    });
    
    // ===== CUSTOMER DROPDOWN =====
    var customerSearchInput = $('#customerSearchInput');
    var customerDropdown = $('#customerDropdown');
    var customerList = $('#customerList');
    var customerDropdownSearch = $('#customerDropdownSearch');
    var selectedCustomerId = $('#selectedCustomerId');
    
    customerSearchInput.on('click', function(e) {
        e.stopPropagation();
        customerDropdownSearch.val('');
        renderCustomerList('');
        customerDropdown.show();
        setTimeout(function() { customerDropdownSearch.focus(); }, 50);
    });
    
    customerDropdownSearch.on('input', function() {
        renderCustomerList($(this).val());
    });
    
    customerDropdown.on('click', function(e) {
        e.stopPropagation();
    });
    
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.customer-box').length) {
            customerDropdown.hide();
        }
    });
    
    function renderCustomerList(filterText) {
        var search = (filterText || '').toLowerCase().trim();
        var results = [];
        var walkIn = { id: 0, name: 'Walk-in Customer', phone: '' };
        
        if (search.length > 0) {
            if ('walk-in customer'.includes(search) || 'walkin'.includes(search)) {
                results.push(walkIn);
            }
            $.each(customersList, function(i, customer) {
                var name = (customer.name || '').toLowerCase();
                var phone = (customer.phone || '').toLowerCase();
                if (name.includes(search) || phone.includes(search)) {
                    results.push(customer);
                }
            });
        } else {
            results.push(walkIn);
            results = results.concat(customersList);
        }
        
        var html = '';
        if (results.length > 0) {
            $.each(results, function(i, customer) {
                var isSelected = (selectedCustomerId.val() == customer.id);
                var phoneText = customer.phone ? ' <small style="color:#94a3b8;">(' + escapeHtml(customer.phone) + ')</small>' : '';
                html += '<div class="customer-item' + (isSelected ? ' selected' : '') + '" data-id="' + customer.id + '" data-name="' + escapeHtml(customer.name) + '">';
                html += '<div><strong>' + escapeHtml(customer.name) + '</strong>' + phoneText + '</div>';
                if (isSelected) html += '<div style="color:#10b981;"><i class="fas fa-check-circle"></i></div>';
                html += '</div>';
            });
        } else {
            html = '<div class="no-customers-found">No customers found</div>';
        }
        customerList.html(html);
    }
    
    // ===== SELECT CUSTOMER - using mousedown to fire before blur =====
    $(document).on('mousedown', '.customer-item', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var id = $(this).data('id');
        var name = $(this).data('name');
        
        selectedCustomerId.val(id);
        customerSearchInput.val(name);
        customerDropdown.hide();
        currentCustomerId = id;
        
        $('#formCustomerId').val(id);
        
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { ajax_set_customer: 1, customer_id: id },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    previousDue = response.previous_due || 0;
                    $('#modalPreviousDue').text(formatMoney(previousDue));
                    $('#modalPreviousDueDisplay').text(formatMoney(previousDue));
                    updateModalCalculations();
                }
            }
        });
    });
    
    // ===== AUTO UPDATE CART =====
    function updateCartItem(rowId) {
        var $row = $('#cartRow_' + rowId);
        var qty = parseInt($row.find('.qty-input').val()) || 1;
        var price = parseFloat($row.find('.price-input').val()) || 0;
        var serial = $row.find('.serial-input').val() || '';
        
        $('#total_' + rowId).text((qty * price).toFixed(2));
        
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { ajax_update_item: 1, product_id: rowId, qty: qty, price: price, serial: serial },
            dataType: 'json'
        });
        
        updateTotals();
    }
    
    function updateTotals() {
        var subtotal = 0;
        $('#cartTable tbody tr').each(function() {
            var qty = parseInt($(this).find('.qty-input').val()) || 0;
            var price = parseFloat($(this).find('.price-input').val()) || 0;
            subtotal += (qty * price);
        });
        
        $('#subtotal').text(subtotal.toFixed(2));
        $('#totalAmount').text(subtotal.toFixed(2));
        $('#modalSubtotal').text(subtotal.toFixed(2));
        $('#modalTotalAmount').text(subtotal.toFixed(2));
        $('#modalSubtotalDisplay').text(subtotal.toFixed(2));
        
        updateModalCalculations();
        updateCartItemsJson();
    }
    
    function updateCartItemsJson() {
        var cartItems = [];
        $('#cartTable tbody tr').each(function() {
            var $row = $(this);
            cartItems.push({
                id: $row.data('id'),
                name: $row.find('td:first strong').text(),
                price: parseFloat($row.find('.price-input').val()) || 0,
                qty: parseInt($row.find('.qty-input').val()) || 0,
                total: (parseFloat($row.find('.price-input').val()) || 0) * (parseInt($row.find('.qty-input').val()) || 0),
                sku: $row.find('td:first small').text().replace('SKU: ', ''),
                serial: $row.find('.serial-input').val() || '',
                warranty: $row.find('.warranty-badge').text() || ''
            });
        });
        $('#formCartItems').val(JSON.stringify(cartItems));
        $('#modalItemCount').text(cartItems.length);
    }
    
    $(document).on('input', '.qty-input, .price-input, .serial-input', function() {
        var rowId = $(this).data('id');
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(function() { updateCartItem(rowId); }, 400);
    });
    
    // ===== PRODUCT SEARCH =====
    $('#productSearchInput').on('keyup', function() {
        var search = $(this).val().toLowerCase();
        var resultsContainer = $('#searchResults');
        
        if (search.length > 0) {
            var results = [];
            $.each(productsList, function(i, product) {
                if (product.name.toLowerCase().includes(search) || (product.sku && product.sku.toLowerCase().includes(search))) {
                    results.push(product);
                }
            });
            
            if (results.length > 0) {
                var html = '';
                $.each(results, function(i, product) {
                    var stockQty = product.stock_quantity || 0;
                    var isStockOut = (stockQty <= 0);
                    
                    html += '<div class="product-search-item' + (isStockOut ? ' out-of-stock' : '') + '" data-pid="' + product.id + '" data-pname="' + escapeHtml(product.name) + '" data-pprice="' + (product.selling_price || 0) + '" data-psku="' + escapeHtml(product.sku || '') + '" data-pwarranty="' + escapeHtml(product.warranty_name || '') + '">';
                    html += '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">';
                    html += '<div style="flex:1;min-width:0;cursor:pointer;" class="search-item-click">';
                    html += '<strong>' + escapeHtml(product.name) + '</strong>';
                    html += '<br><small>SKU: ' + escapeHtml(product.sku || 'N/A') + '</small>';
                    if (product.warranty_name) {
                        html += '<br><small><i class="fas fa-shield-alt"></i> Warranty: ' + escapeHtml(product.warranty_name) + '</small>';
                    }
                    html += '<br><small style="color: ' + (isStockOut ? '#ef4444' : '#10b981') + ';"><i class="fas fa-boxes"></i> Stock: ' + stockQty + '</small>';
                    html += '</div>';
                    html += '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">';
                    html += '<span style="font-weight:700;color:#10b981;">' + formatMoney(product.selling_price) + '</span>';
                    html += '<button type="button" class="search-add-btn" style="background:#667eea;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;' + (isStockOut ? 'opacity:0.5;cursor:not-allowed;' : '') + '" ' + (isStockOut ? 'disabled' : '') + '>';
                    html += '<i class="fas fa-plus"></i> Add';
                    html += '</button>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                resultsContainer.html(html).show();
            } else {
                resultsContainer.html('<div class="no-results">No products found</div>').show();
            }
        } else {
            resultsContainer.hide();
        }
    });
    
    // Search result click (whole item clickable)
    $(document).on('click', '.search-item-click', function() {
        var $item = $(this).closest('.product-search-item');
        if ($item.hasClass('out-of-stock')) return;
        submitAddToCart(
            $item.data('pid'),
            $item.data('pname'),
            $item.data('pprice'),
            $item.data('psku'),
            $item.data('pwarranty')
        );
    });
    
    // Search add button click
    $(document).on('click', '.search-add-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var $item = $(this).closest('.product-search-item');
        if ($item.hasClass('out-of-stock')) return;
        submitAddToCart(
            $item.data('pid'),
            $item.data('pname'),
            $item.data('pprice'),
            $item.data('psku'),
            $item.data('pwarranty')
        );
    });
    
    $(document).click(function(e) {
        if (!$(e.target).closest('#productSearchInput, #searchResults').length) {
            $('#searchResults').hide();
        }
    });
    
    $('#searchProduct').on('keyup', function() {
        var searchText = $(this).val().toLowerCase();
        $('#productItemsContainer .product-item').each(function() {
            var productName = $(this).data('product-name');
            if (!searchText || (productName && productName.includes(searchText))) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
    
    // ===== HELPERS =====
    function formatMoney(amount) {
        if (isNaN(amount) || amount === null) return '0.00';
        return parseFloat(amount).toFixed(2);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        return $('<div>').text(text).html();
    }
    
    function updateModalCalculations() {
        var subtotal = parseFloat($('#modalSubtotal').text().replace(/,/g, '')) || 0;
        var discount = parseFloat($('#discountAmount').val()) || 0;
        var vat = parseFloat($('#vatAmount').val()) || 0;
        var received = parseFloat($('#payAmount').val()) || 0;
        
        var netPayable = subtotal - discount + vat;
        var currentDue = netPayable - received + previousDue;
        if (currentDue < 0) currentDue = 0;
        
        $('#modalDiscountDisplay').text(formatMoney(discount));
        $('#modalVatDisplay').text(formatMoney(vat));
        $('#modalNetPayable').text(formatMoney(netPayable));
        $('#modalPreviousDueDisplay').text(formatMoney(previousDue));
        $('#modalReceivedDisplay').text(formatMoney(received));
        $('#modalCurrentDue').text(formatMoney(currentDue));
        
        $('#modalCurrentDue').css('color', currentDue > 0 ? '#ef4444' : '#10b981');
        
        $('#formDiscount').val(discount);
        $('#formVat').val(vat);
        $('#formPaid').val(received);
        $('#formSubtotal').val(subtotal);
    }
    
    // ===== PAYMENT MODAL =====
    $('#paymentBtn').click(function() {
        if ($('#cartTable tbody tr').length === 0) {
            alert('Cart is empty!');
            return;
        }
        
        // Save cart edits + customer + date
        var serials = {}, qtys = {}, prices = {};
        $('#cartTable tbody tr').each(function() {
            var pid = $(this).data('id');
            serials[pid] = $(this).find('.serial-input').val() || '';
            qtys[pid] = $(this).find('.qty-input').val() || 1;
            prices[pid] = $(this).find('.price-input').val() || 0;
        });
        
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { 
                ajax_save_cart_edits: 1,
                cart_serials: serials,
                cart_qtys: qtys,
                cart_prices: prices
            },
            dataType: 'json',
            async: false
        });
        
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { ajax_set_customer: 1, customer_id: currentCustomerId },
            dataType: 'json',
            async: false
        });
        
        $.ajax({
            type: 'POST',
            url: '/pos',
            data: { ajax_set_date: 1, date: currentDate },
            dataType: 'json',
            async: false
        });
        
        $('#formCustomerId').val(currentCustomerId);
        // CRITICAL FIX: preserve date without time from picker, append current time
        $('#formSaleDate').val(currentDate + ' ' + new Date().toTimeString().slice(0, 8));
        
        $('#paymentModal').css('display', 'flex');
        updateModalCalculations();
        updateCartItemsJson();
    });
    
    $('#closeModalBtn, #cancelPayment').click(function() { $('#paymentModal').hide(); });
    
    $(window).click(function(e) {
        if ($(e.target).is('#paymentModal')) $('#paymentModal').hide();
    });
    
    $('#discountAmount, #vatAmount, #payAmount, #transactionAccount').on('input change', function() {
        updateModalCalculations();
        $('#formPaymentMethod').val($('#transactionAccount').val());
    });
    
    $('#paidBtn').click(function() {
        var subtotal = parseFloat($('#modalSubtotal').text().replace(/,/g, '')) || 0;
        var discount = parseFloat($('#discountAmount').val()) || 0;
        var vat = parseFloat($('#vatAmount').val()) || 0;
        $('#payAmount').val((subtotal - discount + vat + previousDue).toFixed(2));
        updateModalCalculations();
    });
    
    $('#confirmOrder').click(function(e) {
        e.preventDefault();
        if (JSON.parse($('#formCartItems').val() || '[]').length === 0) {
            alert('Cart is empty!');
            return;
        }
        $('#formCustomerId').val(currentCustomerId);
        $('#formSaleDate').val(currentDate + ' ' + new Date().toTimeString().slice(0, 8));
        $('#paymentForm').submit();
    });
    
    renderCustomerList('');
    updateTotals();
});
</script>

<style>
.pos-wrapper { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
@media (max-width: 992px) { .pos-wrapper { grid-template-columns: 1fr; } }

.pos-manager-card, .product-list-card {
    background: #fff; border-radius: 20px; padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.pos-manager-card h3, .product-list-card h3 {
    font-size: 18px; font-weight: 600; margin-bottom: 20px;
    padding-bottom: 10px; border-bottom: 2px solid #eef2f6;
    color: #667eea; display: inline-block;
}
.scan-barcode { position: relative; margin-bottom: 15px; }
.search-product-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; box-sizing: border-box; }
.search-product-input:focus { outline: none; border-color: #667eea; }
.product-search-results {
    position: absolute; top: 100%; left: 0; right: 0; background: #fff;
    border: 1px solid #e2e8f0; border-radius: 8px; max-height: 300px;
    overflow-y: auto; z-index: 1000; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.product-search-item { padding: 8px 12px; border-bottom: 1px solid #eef2f6; }
.product-search-item:last-child { border-bottom: none; }
.product-search-item:hover:not(.out-of-stock) { background: #f0f3ff; }
.product-search-item.out-of-stock { opacity: 0.6; background: #fef2f2; }
.search-item-click { cursor: pointer; }
.search-add-btn { background: #667eea; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap; }
.no-results { padding: 20px; text-align: center; color: #94a3b8; }
.date-customer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
.date-box, .customer-box {
    display: flex; align-items: center; gap: 10px; background: #f8fafc;
    padding: 8px 12px; border-radius: 10px; border: 1px solid #e2e8f0;
}
.date-box i, .customer-box i { color: #667eea; }
.customer-search-input {
    flex: 1; border: none; background: transparent; padding: 8px 0;
    font-size: 14px; outline: none; cursor: pointer;
}
.customer-search-input::placeholder { color: #94a3b8; }
.customer-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; background: #fff;
    border: 1px solid #e2e8f0; border-radius: 8px; max-height: 300px;
    overflow: hidden; z-index: 1001; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-top: 5px;
}
.customer-search-wrapper {
    padding: 10px; border-bottom: 1px solid #e2e8f0;
    background: #f8fafc; position: relative;
}
.customer-search-wrapper i {
    position: absolute; left: 20px; top: 50%;
    transform: translateY(-50%); color: #94a3b8; font-size: 13px;
}
.customer-dropdown-search {
    width: 100%; padding: 8px 12px 8px 32px; border: 1px solid #e2e8f0;
    border-radius: 6px; font-size: 13px; outline: none; background: #fff; box-sizing: border-box;
}
.customer-dropdown-search:focus { border-color: #667eea; }
.customer-list { max-height: 230px; overflow-y: auto; }
.customer-item {
    padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
    display: flex; justify-content: space-between; align-items: center;
}
.customer-item:hover { background: #f0f3ff; }
.customer-item.selected { background: #dbeafe; border-left: 3px solid #667eea; }
.customer-item:last-child { border-bottom: none; }
.customer-item strong { font-size: 13px; color: #1e293b; }
.no-customers-found { padding: 15px; text-align: center; color: #94a3b8; font-size: 13px; }
.cart-items { width: 100%; overflow-x: auto; }
.table-responsive { overflow-x: auto; }
.cart-table { width: 100%; font-size: 12px; border-collapse: collapse; }
.cart-table th {
    background: #f8fafc; padding: 12px 8px; font-weight: 600;
    color: #475569; text-align: left;
}
.cart-table td { padding: 10px 8px; border-bottom: 1px solid #eef2f6; vertical-align: middle; }
.cart-table td input[type="text"], .cart-table td input[type="number"] {
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;
    font-size: 12px; width: 100%; box-sizing: border-box;
}
.warranty-badge {
    background: #eef2ff; color: #667eea; padding: 4px 8px;
    border-radius: 12px; font-size: 11px; display: inline-block;
}
.no-warranty { color: #94a3b8; }
.empty-cart { text-align: center; padding: 60px 20px; color: #94a3b8; }
.empty-cart i { font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 10px; }
.item-total { font-weight: 600; color: #1e293b; }
.remove-btn { background: #ef4444; color: #fff; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 12px; }
.remove-btn:hover { background: #dc2626; }
.cart-total { margin-top: 20px; padding-top: 15px; border-top: 2px solid #eef2f6; }
.total-line { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #64748b; }
.grand-total { display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: 700; color: #667eea; }
.payment-btn {
    background: linear-gradient(135deg, #10b981, #059669); color: #fff;
    border: none; padding: 14px; border-radius: 12px; width: 100%;
    margin-top: 15px; font-size: 16px; font-weight: 600; cursor: pointer;
}
.payment-btn:hover { background: linear-gradient(135deg, #059669, #047857); }
.add-btn {
    background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
    border: none; padding: 8px 16px; border-radius: 8px;
    font-size: 12px; cursor: pointer; white-space: nowrap;
}
.add-btn.disabled-btn, .add-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #94a3b8; }
.product-items { max-height: 500px; overflow-y: auto; margin-top: 15px; }
.product-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px; border-bottom: 1px solid #eef2f6; gap: 8px;
}
.product-item:hover { background: #f8fafc; }
.product-item.stock-out-product { opacity: 0.6; background: #fef2f2; }
.product-info { flex: 1; min-width: 0; }
.product-name { font-weight: 600; color: #1e293b; font-size: 13px; }
.product-sku { font-size: 10px; color: #94a3b8; }
.product-warranty { font-size: 10px; color: #667eea; margin-top: 2px; }
.product-stock { font-size: 10px; margin-top: 2px; }
.product-stock.in-stock { color: #10b981; }
.product-stock.stock-out { color: #ef4444; }
.product-price { font-weight: 700; color: #10b981; font-size: 14px; white-space: nowrap; margin: 0 8px; }
.product-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.product-list-header input {
    padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
    width: 200px; font-size: 13px; outline: none;
}
.modal {
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 1000;
}
.modal-content {
    background: #fff; border-radius: 20px; width: 92%; max-width: 650px;
    overflow: hidden; max-height: 95vh; overflow-y: auto;
}
.payment-modal-header {
    background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
    padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
}
.payment-modal-header .modal-title { display: flex; align-items: center; gap: 10px; }
.payment-modal-header .modal-title h4 { margin: 0; font-size: 16px; }
.payment-modal-header .close-modal {
    color: #fff; background: rgba(255,255,255,0.2); border-radius: 50%;
    width: 30px; height: 30px; display: flex; align-items: center;
    justify-content: center; border: none; cursor: pointer; font-size: 16px;
}
.order-summary { padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #eef2f6; }
.order-summary h5 { margin: 0 0 10px 0; font-size: 14px; }
.summary-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.stat-card { background: #fff; padding: 10px; border-radius: 10px; border: 1px solid #eef2f6; }
.stat-card.highlight { background: linear-gradient(135deg, #667eea, #764ba2); border: none; }
.stat-card.highlight .stat-info .stat-label, .stat-card.highlight .stat-info .stat-value { color: #fff; }
.stat-info { text-align: center; }
.stat-label { display: block; font-size: 10px; color: #64748b; margin-bottom: 2px; }
.stat-value { display: block; font-size: 16px; font-weight: 700; color: #1e293b; }
.payment-form { padding: 16px 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.form-group label { display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px; }
.form-group input, .form-group select {
    width: 100%; padding: 8px 10px; border: 2px solid #e2e8f0;
    border-radius: 8px; font-size: 13px; box-sizing: border-box;
}
.form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; }
.amount-input-wrapper { display: flex; gap: 8px; }
.amount-input-wrapper input { flex: 1; }
.paid-btn {
    background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
    border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px;
    font-weight: 600; cursor: pointer; white-space: nowrap;
}
.payment-summary { background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
.summary-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.summary-row:first-child { border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
.payment-actions {
    padding: 12px 20px; background: #f8fafc; border-top: 1px solid #eef2f6;
    display: flex; justify-content: flex-end; gap: 10px;
}
.btn-cancel {
    background: #f1f5f9; color: #475569; border: none; padding: 8px 20px;
    border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;
}
.btn-order {
    background: linear-gradient(135deg, #10b981, #059669); color: #fff;
    border: none; padding: 8px 20px; border-radius: 8px; font-weight: 600;
    cursor: pointer; font-size: 13px;
}
@media (max-width: 768px) {
    .pos-manager-card, .product-list-card { padding: 12px; }
    .cart-table thead { display: none; }
    .cart-table, .cart-table tbody, .cart-table tr, .cart-table td { display: block; width: 100%; }
    .cart-table tr { margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .cart-table td {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 0; border-bottom: 1px solid #f1f5f9; text-align: right;
    }
    .cart-table td::before { content: attr(data-label); font-weight: 600; color: #475569; }
    .date-customer-row { grid-template-columns: 1fr; gap: 10px; }
    .summary-stats { grid-template-columns: repeat(2, 1fr) !important; }
    .form-row { grid-template-columns: 1fr !important; }
    .payment-actions { flex-direction: column; gap: 8px; }
    .btn-cancel, .btn-order { width: 100%; text-align: center; }
}
</style>

<?php include $_SERVER['DOCUMENT_ROOT'] . '/includes/footer.php'; ?>