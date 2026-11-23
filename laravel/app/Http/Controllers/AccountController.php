<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AccountController extends Controller
{
    public function index(): View
    {
        $accounts = BankAccount::query()->orderBy('id')->get();
        $transactions = BankTransaction::query()->with('bankAccount')->orderByDesc('id')->limit(50)->get();

        return view('accounts.index', compact('accounts', 'transactions'));
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'account_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'opening_balance' => ['required', 'numeric'],
        ]);

        BankAccount::query()->create([
            'account_name' => $data['account_name'],
            'bank_name' => $data['bank_name'] ?? '',
            'branch' => $data['branch'] ?? null,
            'opening_balance' => $data['opening_balance'],
            'balance' => $data['opening_balance'],
        ]);

        return back()->with('success', 'Account created.');
    }

    public function storeTransaction(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'type' => ['required', 'in:deposit,withdraw'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string'],
            'transaction_date' => ['required', 'date'],
        ]);

        DB::transaction(function () use ($data) {
            $account = BankAccount::query()->lockForUpdate()->findOrFail($data['bank_account_id']);
            if ($data['type'] === 'withdraw' && (float) $data['amount'] > (float) $account->balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => 'Insufficient balance in ' . $account->account_name . '.',
                ]);
            }
            BankTransaction::query()->create($data);
            if ($data['type'] === 'deposit') {
                $account->increment('balance', (float) $data['amount']);
            } else {
                $account->decrement('balance', (float) $data['amount']);
            }
        });

        return back()->with('success', 'Transaction recorded.');
    }

    public function expenses(): View
    {
        $expenses = Expense::query()->orderByDesc('id')->paginate(25);
        $categories = ExpenseCategory::query()->where('status', true)->orderBy('name')->get();

        return view('expenses.index', compact('expenses', 'categories'));
    }

    public function storeExpense(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'category' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'description' => ['nullable', 'string'],
        ]);

        Expense::query()->create($data + ['created_by' => Auth::id()]);

        return back()->with('success', 'Expense recorded.');
    }
}
