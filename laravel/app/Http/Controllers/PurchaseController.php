<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class PurchaseController extends Controller
{
    public function index(): View
    {
        $purchases = Purchase::query()->with('supplier')->orderByDesc('id')->paginate(25);
        $suppliers = Supplier::query()->where('status', true)->orderBy('name')->get();
        $products = Product::query()->where('status', true)->orderBy('name')->get();

        return view('purchases.index', compact('purchases', 'suppliers', 'products'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'paid' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
            'note' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($data) {
            $product = Product::query()->lockForUpdate()->findOrFail($data['product_id']);
            $qty = (int) $data['quantity'];
            $price = (float) $data['price'];
            $subtotal = $qty * $price;
            $discount = (float) ($data['discount'] ?? 0);
            $total = max(0, $subtotal - $discount);
            $paid = min($total, (float) $data['paid']);
            $due = max(0, $total - $paid);

            $invoiceNo = 'PUR-' . date('Ymd') . '-' . str_pad((string) ((Purchase::query()->max('id') ?? 0) + 1), 4, '0', STR_PAD_LEFT);

            $purchase = Purchase::query()->create([
                'invoice_no' => $invoiceNo,
                'supplier_id' => $data['supplier_id'],
                'purchase_date' => now(),
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'total_amount' => $total,
                'paid' => $paid,
                'paid_amount' => $paid,
                'due' => $due,
                'due_amount' => $due,
                'payment_method' => $data['payment_method'],
                'note' => $data['note'] ?? null,
                'status' => true,
                'user_id' => Auth::id() ?? 1,
            ]);

            PurchaseItem::query()->create([
                'purchase_id' => $purchase->id,
                'product_id' => $product->id,
                'quantity' => $qty,
                'price' => $price,
                'total' => $subtotal,
            ]);

            $oldQty = $product->quantity;
            $newQty = $oldQty + $qty;
            $product->update([
                'quantity' => $newQty,
                'stock_quantity' => $newQty,
                'purchase_price' => $price,
            ]);

            StockMovement::query()->create([
                'product_id' => $product->id,
                'old_quantity' => $oldQty,
                'new_quantity' => $newQty,
                'difference' => $qty,
                'reason' => "Purchase {$invoiceNo}",
                'created_by' => Auth::id(),
                'created_at' => now(),
            ]);

            if ($paid > 0) {
                SupplierPayment::query()->create([
                    'purchase_id' => $purchase->id,
                    'supplier_id' => $data['supplier_id'],
                    'amount' => $paid,
                    'payment_date' => now(),
                    'payment_method' => $data['payment_method'],
                    'created_by' => Auth::id(),
                ]);
            }
        });

        return back()->with('success', 'Purchase recorded and stock updated.');
    }

    public function paySupplier(Request $request, Purchase $purchase): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', 'max:50'],
        ]);

        DB::transaction(function () use ($purchase, $data) {
            $purchase->refresh();
            $pay = min((float) $purchase->due, (float) $data['amount']);
            if ($pay <= 0) {
                return;
            }
            $newPaid = (float) $purchase->paid + $pay;
            $newDue = max(0, (float) $purchase->total - $newPaid);

            $purchase->update([
                'paid' => $newPaid,
                'paid_amount' => $newPaid,
                'due' => $newDue,
                'due_amount' => $newDue,
            ]);

            SupplierPayment::query()->create([
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'amount' => $pay,
                'payment_date' => now(),
                'payment_method' => $data['payment_method'],
                'created_by' => Auth::id(),
            ]);
        });

        return back()->with('success', 'Supplier payment recorded.');
    }
}
