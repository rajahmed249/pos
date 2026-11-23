<?php

namespace App\Http\Controllers;

use App\Models\Damage;
use App\Models\Product;
use App\Models\ReturnItem;
use App\Models\Sale;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class ReturnDamageController extends Controller
{
    public function index(): View
    {
        $returns = ReturnItem::query()->with(['product', 'sale'])->orderByDesc('id')->limit(30)->get();
        $damages = Damage::query()->with('product')->orderByDesc('id')->limit(30)->get();
        $products = Product::query()->orderBy('name')->get();
        $sales = Sale::query()->orderByDesc('id')->limit(50)->get();

        return view('returns.index', compact('returns', 'damages', 'products', 'sales'));
    }

    public function storeReturn(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'sale_id' => ['required', 'exists:sales,id'],
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($data) {
            $sale = Sale::query()->findOrFail($data['sale_id']);
            $product = Product::query()->lockForUpdate()->findOrFail($data['product_id']);
            $total = (int) $data['quantity'] * (float) $data['price'];

            ReturnItem::query()->create([
                'sale_id' => $sale->id,
                'invoice_no' => $sale->invoice_no,
                'customer_id' => $sale->customer_id,
                'product_id' => $product->id,
                'quantity' => (int) $data['quantity'],
                'price' => (float) $data['price'],
                'total_amount' => $total,
                'reason' => $data['reason'] ?? null,
                'return_date' => now()->toDateString(),
                'created_by' => Auth::id(),
            ]);

            $oldQty = (int) ($product->stock_quantity ?? $product->quantity ?? 0);
            $newQty = $oldQty + (int) $data['quantity'];
            $product->update(['quantity' => $newQty, 'stock_quantity' => $newQty]);

            StockMovement::query()->create([
                'product_id' => $product->id,
                'old_quantity' => $oldQty,
                'new_quantity' => $newQty,
                'difference' => (int) $data['quantity'],
                'reason' => "Sales Return ({$sale->invoice_no})",
                'created_by' => Auth::id(),
                'created_at' => now(),
            ]);
        });

        return back()->with('success', 'Sales return processed and stock restored.');
    }

    public function storeDamage(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($data) {
            $product = Product::query()->lockForUpdate()->findOrFail($data['product_id']);
            $availableStock = (int) ($product->stock_quantity ?? $product->quantity ?? 0);
            $reqQty = (int) $data['quantity'];
            if ($reqQty > $availableStock) {
                throw ValidationException::withMessages([
                    'quantity' => "Damaged quantity ({$reqQty}) exceeds available stock ({$availableStock}) for {$product->name}.",
                ]);
            }
            $loss = $reqQty * (float) $product->purchase_price;

            Damage::query()->create([
                'product_id' => $product->id,
                'quantity' => $reqQty,
                'reason' => $data['reason'] ?? null,
                'loss_amount' => $loss,
                'damage_date' => now()->toDateString(),
                'created_by' => Auth::id(),
            ]);

            $newQty = max(0, $availableStock - $reqQty);
            $product->update(['quantity' => $newQty, 'stock_quantity' => $newQty]);

            StockMovement::query()->create([
                'product_id' => $product->id,
                'old_quantity' => $availableStock,
                'new_quantity' => $newQty,
                'difference' => -$reqQty,
                'reason' => $data['reason'] ?? 'Damaged Stock',
                'created_by' => Auth::id(),
                'created_at' => now(),
            ]);
        });

        return back()->with('success', 'Damage recorded and stock deducted.');
    }
}
