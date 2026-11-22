<?php

namespace App\Http\Controllers;

use App\Models\Damage;
use App\Models\Product;
use App\Models\ReturnItem;
use App\Models\Sale;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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

            $product->increment('quantity', (int) $data['quantity']);
            $product->increment('stock_quantity', (int) $data['quantity']);
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
            $qty = min($product->quantity, (int) $data['quantity']);
            $loss = $qty * (float) $product->purchase_price;

            Damage::query()->create([
                'product_id' => $product->id,
                'quantity' => $qty,
                'reason' => $data['reason'] ?? null,
                'loss_amount' => $loss,
                'damage_date' => now()->toDateString(),
                'created_by' => Auth::id(),
            ]);

            $product->decrement('quantity', $qty);
            $product->decrement('stock_quantity', $qty);
        });

        return back()->with('success', 'Damage recorded and stock deducted.');
    }
}
