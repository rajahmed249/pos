<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PartyController extends Controller
{
    public function customers(Request $request): View
    {
        $customers = Customer::query()
            ->withSum('sales as total_billed', 'receivable')
            ->withSum('sales as total_due', 'due')
            ->when($request->filled('q'), fn ($q) => $q->where('name', 'like', '%' . $request->string('q')->toString() . '%')->orWhere('phone', 'like', '%' . $request->string('q')->toString() . '%'))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('parties.customers', compact('customers'));
    }

    public function storeCustomer(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'opening_balance' => ['nullable', 'numeric'],
        ]);
        Customer::query()->create($data + ['status' => true]);
        return back()->with('success', 'Customer added.');
    }

    public function updateCustomer(Request $request, Customer $customer): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
        ]);
        $customer->update($data);
        return back()->with('success', 'Customer updated.');
    }

    public function suppliers(Request $request): View
    {
        $suppliers = Supplier::query()
            ->withSum('purchases as total_purchased', 'total')
            ->withSum('purchases as total_due', 'due')
            ->when($request->filled('q'), fn ($q) => $q->where('name', 'like', '%' . $request->string('q')->toString() . '%')->orWhere('phone', 'like', '%' . $request->string('q')->toString() . '%'))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        return view('parties.suppliers', compact('suppliers'));
    }

    public function storeSupplier(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'opening_balance' => ['nullable', 'numeric'],
        ]);
        Supplier::query()->create($data + ['status' => true]);
        return back()->with('success', 'Supplier added.');
    }

    public function updateSupplier(Request $request, Supplier $supplier): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
        ]);
        $supplier->update($data);
        return back()->with('success', 'Supplier updated.');
    }
}
