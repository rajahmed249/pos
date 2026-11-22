<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Estimate;
use App\Models\EstimateItem;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class EstimateController extends Controller
{
    public function index(): View
    {
        $estimates = Estimate::query()->with('items')->orderByDesc('id')->paginate(20);
        $customers = Customer::query()->orderBy('name')->get();
        $products = Product::query()->where('status', true)->orderBy('name')->get();

        return view('estimates.index', compact('estimates', 'customers', 'products'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'valid_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($data) {
            $product = Product::query()->findOrFail($data['product_id']);
            $subtotal = (int) $data['quantity'] * (float) $data['price'];
            $discount = (float) ($data['discount'] ?? 0);
            $total = max(0, $subtotal - $discount);

            $estimate = Estimate::query()->create([
                'estimate_no' => 'EST-' . date('Ymd') . '-' . str_pad((string) ((Estimate::query()->max('id') ?? 0) + 1), 4, '0', STR_PAD_LEFT),
                'customer_id' => $data['customer_id'] ?? null,
                'customer_name' => $data['customer_name'],
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'status' => 'pending',
                'valid_until' => $data['valid_until'] ?? now()->addDays(7)->toDateString(),
                'notes' => $data['notes'] ?? null,
                'created_by' => Auth::id(),
            ]);

            EstimateItem::query()->create([
                'estimate_id' => $estimate->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => (int) $data['quantity'],
                'price' => (float) $data['price'],
                'total' => $subtotal,
            ]);
        });

        return back()->with('success', 'Estimate / quotation created.');
    }

    public function updateStatus(Request $request, Estimate $estimate): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', 'in:pending,approved,rejected,expired']]);
        $estimate->update($data);
        return back()->with('success', 'Estimate status updated.');
    }
}
