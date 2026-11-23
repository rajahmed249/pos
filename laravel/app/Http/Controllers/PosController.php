<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\Warranty;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class PosController extends Controller
{
    public function index(Request $request): View|JsonResponse
    {
        $tokens = preg_split('/\s+/', trim((string) $request->query('q', '')), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $products = Product::query()
            ->with(['category', 'brand', 'warrantyRecord'])
            ->where('status', true)
            ->when(count($tokens) > 0, function ($q) use ($tokens) {
                foreach ($tokens as $tok) {
                    $term = '%' . $tok . '%';
                    $q->where(function ($w) use ($term) {
                        $w->where('name', 'like', $term)
                            ->orWhere('sku', 'like', $term)
                            ->orWhere('barcode', 'like', $term)
                            ->orWhere('warranty', 'like', $term)
                            ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $term))
                            ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', $term));
                    });
                }
            })
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->orderBy('name')
            ->get();

        if ($request->wantsJson()) {
            return response()->json(['items' => $products, 'total' => $products->count()]);
        }

        $categories = Category::query()->where('status', true)->orderBy('name')->get();
        $brands = Brand::query()->where('status', true)->orderBy('name')->get();
        $customers = Customer::query()->where('status', true)->orderBy('name')->get();
        $accounts = BankAccount::query()->orderBy('id')->get();
        $warranties = Warranty::query()->where('status', true)->orderBy('name')->get();

        return view('pos.index', compact('products', 'categories', 'brands', 'customers', 'accounts', 'warranties'));
    }

    public function checkout(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'account_id' => ['required', 'exists:bank_accounts,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'vat' => ['nullable', 'numeric', 'min:0'],
            'paid' => ['required', 'numeric', 'min:0'],
            'sale_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
            'items.*.serial_no' => ['nullable', 'string', 'max:100'],
            'items.*.warranty' => ['nullable', 'string', 'max:100'],
        ]);

        $sale = DB::transaction(function () use ($validated) {
            $subtotal = 0;
            $totalCost = 0;
            $preparedItems = [];

            $requestedByProduct = [];
            foreach ($validated['items'] as $row) {
                $product = Product::query()->with('category')->lockForUpdate()->findOrFail($row['product_id']);
                $qty = (int) $row['quantity'];
                $requestedByProduct[$product->id] = ($requestedByProduct[$product->id] ?? 0) + $qty;
                $availableStock = (int) ($product->stock_quantity ?? $product->quantity ?? 0);
                if ($requestedByProduct[$product->id] > $availableStock) {
                    throw ValidationException::withMessages([
                        'items' => "Insufficient stock for {$product->name}. Available: {$availableStock}, Requested: {$requestedByProduct[$product->id]}.",
                    ]);
                }
                $price = (float) $row['price'];
                $lineTotal = $qty * $price;
                $lineCost = $qty * (float) $product->purchase_price;

                $subtotal += $lineTotal;
                $totalCost += $lineCost;

                $preparedItems[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'price' => $price,
                    'total' => $lineTotal,
                    'purchase_cost' => $lineCost,
                    'buying_price' => (float) $product->purchase_price,
                    'serial_no' => $row['serial_no'] ?? null,
                    'warranty' => $row['warranty'] ?? $product->warranty,
                ];
            }

            $discount = (float) ($validated['discount'] ?? 0);
            if ($discount > $subtotal + 0.009) {
                throw ValidationException::withMessages([
                    'discount' => 'Discount cannot exceed Subtotal.',
                ]);
            }
            $vat = (float) ($validated['vat'] ?? 0);
            $receivable = max(0, $subtotal - $discount + $vat);
            $paid = min($receivable, (float) $validated['paid']);
            $due = max(0, $receivable - $paid);
            $profit = $receivable - $totalCost;

            $account = BankAccount::query()->lockForUpdate()->findOrFail($validated['account_id']);
            $customer = !empty($validated['customer_id']) ? Customer::query()->find($validated['customer_id']) : null;
            $isWalkIn = !$customer || strtolower(trim((string) $customer->name)) === 'walk-in customer';

            if ($isWalkIn && $due > 0.009) {
                throw ValidationException::withMessages([
                    'paid' => 'Walk-in Customer cannot have due balance! Please collect full payment or select a registered customer.',
                ]);
            }

            $invoiceNo = 'INV-' . date('Ymd') . '-' . str_pad((string) ((Sale::query()->max('id') ?? 0) + 1), 4, '0', STR_PAD_LEFT);
            $saleDateStr = $validated['sale_date'] ?? now()->toDateString();

            $sale = Sale::query()->create([
                'invoice_no' => $invoiceNo,
                'customer_id' => $customer?->id,
                'customer_name' => $customer?->name ?? ($validated['customer_name'] ?: 'Walk-in Customer'),
                'date' => $saleDateStr,
                'sale_date' => $saleDateStr . ' ' . now()->format('H:i:s'),
                'subtotal' => $subtotal,
                'discount' => $discount,
                'receivable' => $receivable,
                'paid' => $paid,
                'due' => $due,
                'purchase_cost' => $totalCost,
                'profit' => $profit,
                'status' => 'completed',
                'account_id' => $account->id,
                'account_name' => $account->account_name,
                'payment_status' => $due <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'due'),
            ]);

            foreach ($preparedItems as $item) {
                /** @var Product $product */
                $product = $item['product'];
                SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'category_name' => $product->category?->name,
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'total' => $item['total'],
                    'purchase_cost' => $item['purchase_cost'],
                    'buying_price' => $item['buying_price'],
                    'serial_no' => $item['serial_no'],
                    'warranty' => $item['warranty'],
                    'warranty_name' => $item['warranty'],
                ]);

                $oldQty = $product->quantity;
                $newQty = max(0, $oldQty - $item['quantity']);
                $product->update(['quantity' => $newQty, 'stock_quantity' => $newQty]);

                StockMovement::query()->create([
                    'product_id' => $product->id,
                    'old_quantity' => $oldQty,
                    'new_quantity' => $newQty,
                    'difference' => -$item['quantity'],
                    'reason' => "POS Sale {$invoiceNo}",
                    'created_by' => Auth::id(),
                    'created_at' => now(),
                ]);
            }

            if ($paid > 0) {
                Payment::query()->create([
                    'sale_id' => $sale->id,
                    'customer_id' => $customer?->id,
                    'amount' => $paid,
                    'payment_date' => now(),
                    'payment_method' => strtolower($account->account_name),
                    'note' => 'POS Checkout',
                    'created_by' => Auth::id(),
                ]);
                $account->increment('balance', $paid);
            }

            return $sale;
        });

        return redirect()->route('sales.invoice', $sale)->with('success', "Invoice {$sale->invoice_no} created successfully.");
    }
}
