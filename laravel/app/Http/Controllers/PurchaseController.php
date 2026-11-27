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
    public function index(Request $request): View
    {
        $limit = in_array($request->integer('limit'), [10, 20, 50, 100], true)
            ? $request->integer('limit')
            : 10;

        $q = trim((string) $request->query('q', ''));
        $query = Purchase::query()->with(['supplier', 'items.product'])->orderByDesc('id');
        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('invoice_no', 'like', "%{$q}%")
                    ->orWhereHas('supplier', fn ($sup) => $sup->where('name', 'like', "%{$q}%"));
            });
        }

        $purchases = $query->paginate($limit)->withQueryString();
        $suppliers = Supplier::query()->where('status', true)->orderBy('name')->get();
        $products = Product::query()->where('status', true)->orderBy('name')->get();

        return view('purchases.index', compact('purchases', 'suppliers', 'products', 'limit'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'purchase_date' => ['nullable', 'date'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.price' => ['required_with:items', 'numeric', 'min:0'],
            'product_id' => ['required_without:items', 'nullable', 'exists:products,id'],
            'quantity' => ['required_without:items', 'nullable', 'integer', 'min:1'],
            'price' => ['required_without:items', 'nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'paid' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'max:50'],
            'note' => ['nullable', 'string'],
        ]);

        $lineItems = !empty($data['items'])
            ? $data['items']
            : [[
                'product_id' => $data['product_id'],
                'quantity' => $data['quantity'],
                'price' => $data['price'],
            ]];

        DB::transaction(function () use ($data, $lineItems) {
            $subtotal = 0.0;
            $prepared = [];

            foreach ($lineItems as $row) {
                $product = Product::query()->lockForUpdate()->findOrFail($row['product_id']);
                $qty = (int) $row['quantity'];
                $price = (float) $row['price'];
                $lineTotal = round($qty * $price, 2);
                $subtotal += $lineTotal;
                $prepared[] = compact('product', 'qty', 'price', 'lineTotal');
            }

            $discount = min($subtotal, (float) ($data['discount'] ?? 0));
            $total = max(0, round($subtotal - $discount, 2));
            $paid = min($total, (float) $data['paid']);
            $due = max(0, round($total - $paid, 2));

            $purchaseDate = !empty($data['purchase_date'])
                ? \Illuminate\Support\Carbon::parse($data['purchase_date'])->setTimeFromTimeString(now()->toTimeString())
                : now();

            $invoiceNo = 'PUR-' . $purchaseDate->format('Ymd') . '-' . str_pad((string) ((Purchase::query()->max('id') ?? 0) + 1), 4, '0', STR_PAD_LEFT);

            $purchase = Purchase::query()->create([
                'invoice_no' => $invoiceNo,
                'supplier_id' => $data['supplier_id'],
                'purchase_date' => $purchaseDate,
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

            foreach ($prepared as $item) {
                /** @var Product $product */
                $product = $item['product'];
                $qty = $item['qty'];
                $price = $item['price'];

                PurchaseItem::query()->create([
                    'purchase_id' => $purchase->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'price' => $price,
                    'total' => $item['lineTotal'],
                ]);

                $oldQty = (int) ($product->quantity ?? $product->stock_quantity ?? 0);
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
            }

            if ($paid > 0) {
                SupplierPayment::query()->create([
                    'purchase_id' => $purchase->id,
                    'supplier_id' => $data['supplier_id'],
                    'amount' => $paid,
                    'payment_date' => $purchaseDate,
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
