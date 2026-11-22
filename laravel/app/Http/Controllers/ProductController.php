<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\Warranty;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class ProductController extends Controller
{
    public function index(Request $request): View
    {
        $limit = in_array($request->integer('limit'), [10, 20, 50, 100], true)
            ? $request->integer('limit')
            : 10;

        $products = Product::query()
            ->with(['category', 'brand', 'unit', 'warrantyRecord'])
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%' . $request->string('q')->toString() . '%';
                $q->where(function ($w) use ($term) {
                    $w->where('name', 'like', $term)
                        ->orWhere('sku', 'like', $term)
                        ->orWhere('barcode', 'like', $term)
                        ->orWhere('warranty', 'like', $term)
                        ->orWhereHas('category', fn ($c) => $c->where('name', 'like', $term))
                        ->orWhereHas('brand', fn ($b) => $b->where('name', 'like', $term));
                });
            })
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->boolean('low_stock'), fn ($q) => $q->whereColumn('stock_quantity', '<=', 'alert_quantity'))
            ->orderByDesc('id')
            ->paginate($limit)
            ->withQueryString();

        $categories = Category::query()->orderBy('name')->get();
        $brands = Brand::query()->orderBy('name')->get();
        $units = Unit::query()->orderBy('name')->get();
        $warranties = Warranty::query()->orderBy('name')->get();

        return view('products.index', compact('products', 'categories', 'brands', 'units', 'warranties', 'limit'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'unit_id' => ['nullable', 'exists:units,id'],
            'warranty_id' => ['nullable', 'exists:warranties,id'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'quantity' => ['required', 'integer', 'min:0'],
            'alert_quantity' => ['nullable', 'integer', 'min:0'],
            'warranty' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
        ]);

        $data['stock_quantity'] = $data['quantity'];
        $data['status'] = true;

        Product::query()->create($data);

        return back()->with('success', 'Product created successfully.');
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'purchase_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'alert_quantity' => ['nullable', 'integer', 'min:0'],
            'warranty' => ['nullable', 'string', 'max:100'],
            'status' => ['boolean'],
        ]);

        $product->update($data);

        return back()->with('success', 'Product updated.');
    }

    public function adjustStock(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'new_quantity' => ['required', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $old = $product->stock_quantity;
        $new = (int) $data['new_quantity'];
        $product->update(['quantity' => $new, 'stock_quantity' => $new]);

        StockMovement::query()->create([
            'product_id' => $product->id,
            'old_quantity' => $old,
            'new_quantity' => $new,
            'difference' => $new - $old,
            'reason' => $data['reason'] ?: 'Manual stock adjustment',
            'created_by' => Auth::id(),
            'created_at' => now(),
        ]);

        return back()->with('success', 'Stock adjusted successfully.');
    }

    public function toggle(Product $product): RedirectResponse
    {
        $product->update(['status' => !$product->status]);

        return back()->with('success', 'Product status updated.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->update(['status' => false]);

        return back()->with('success', 'Product archived.');
    }
}
