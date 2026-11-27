<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class SaleController extends Controller
{
    public function index(Request $request): View
    {
        $limit = in_array($request->integer('limit'), [10, 20, 50, 100], true)
            ? $request->integer('limit')
            : 10;

        $sales = Sale::query()
            ->with(['customer', 'items.product'])
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%' . $request->string('q')->toString() . '%';
                $q->where(function ($w) use ($term) {
                    $w->where('invoice_no', 'like', $term)
                        ->orWhere('customer_name', 'like', $term)
                        ->orWhereHas('customer', fn ($c) => $c->where('phone', 'like', $term))
                        ->orWhereHas('items', fn ($it) => $it->where('product_name', 'like', $term));
                });
            })
            ->when($request->filled('payment_status'), fn ($q) => $q->where('payment_status', $request->string('payment_status')->toString()))
            ->orderByDesc('id')
            ->paginate($limit)
            ->withQueryString();

        $accounts = BankAccount::query()->orderBy('id')->get();

        return view('sales.index', compact('sales', 'accounts', 'limit'));
    }

    public function invoice(Sale $sale): View
    {
        $sale->load(['items.product.category', 'customer', 'payments']);

        return view('sales.invoice', compact('sale'));
    }

    public function printInvoice(Sale $sale): View
    {
        $sale->load(['items.product.category', 'customer', 'payments']);

        return view('sales.print_invoice', compact('sale'));
    }

    public function collectDue(Request $request, Sale $sale): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'account_id' => ['required', 'exists:bank_accounts,id'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'payment_date' => ['nullable', 'date'],
            'reference_no' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($sale, $data) {
            $sale->refresh();
            $collect = min((float) $sale->due, (float) $data['amount']);
            if ($collect <= 0) {
                return;
            }

            $account = BankAccount::query()->lockForUpdate()->findOrFail($data['account_id']);
            $newPaid = (float) $sale->paid + $collect;
            $newDue = max(0, (float) $sale->receivable - $newPaid);

            $sale->update([
                'paid' => $newPaid,
                'due' => $newDue,
                'payment_status' => $newDue <= 0 ? 'paid' : 'partial',
            ]);

            Payment::query()->create([
                'sale_id' => $sale->id,
                'customer_id' => $sale->customer_id,
                'amount' => $collect,
                'payment_date' => $data['payment_date'] ?? now(),
                'payment_method' => $data['payment_method'] ?: strtolower($account->account_name),
                'reference_no' => $data['reference_no'] ?? null,
                'note' => $data['note'] ?: 'Due collection',
                'created_by' => Auth::id(),
            ]);

            $account->increment('balance', $collect);
        });

        return back()->with('success', 'Payment recorded successfully.');
    }

    public function destroy(Sale $sale): RedirectResponse
    {
        DB::transaction(function () use ($sale) {
            $sale->load('items');
            foreach ($sale->items as $item) {
                if ($item->product_id) {
                    $product = Product::query()->lockForUpdate()->find($item->product_id);
                    if ($product) {
                        $old = $product->stock_quantity;
                        $new = $old + $item->quantity;
                        $product->update(['quantity' => $new, 'stock_quantity' => $new]);

                        StockMovement::query()->create([
                            'product_id' => $product->id,
                            'old_quantity' => $old,
                            'new_quantity' => $new,
                            'difference' => $item->quantity,
                            'reason' => "Restored from deleted sale {$sale->invoice_no}",
                            'created_by' => Auth::id(),
                            'created_at' => now(),
                        ]);
                    }
                }
            }
            if ((float) $sale->paid > 0) {
                $account = $sale->account_id
                    ? BankAccount::query()->lockForUpdate()->find($sale->account_id)
                    : BankAccount::query()->lockForUpdate()->orderBy('id')->first();
                if ($account) {
                    $account->update([
                        'balance' => max(0, (float) $account->balance - (float) $sale->paid),
                    ]);
                }
            }
            $sale->items()->delete();
            $sale->payments()->delete();
            $sale->delete();
        });

        return back()->with('success', 'Sale deleted successfully and stock restored.');
    }
}
