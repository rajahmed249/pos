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
        $transactions = BankTransaction::query()->with('bankAccount')->orderByDesc('transaction_date')->orderByDesc('id')->limit(150)->get();
        $transactionsByAccount = $transactions->groupBy('bank_account_id')->map(function ($rows) {
            return $rows->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (float) $t->amount,
                'description' => $t->description ?: ucfirst($t->type),
                'transaction_date' => $t->transaction_date?->format('Y-m-d') ?? $t->created_at?->format('Y-m-d') ?? date('Y-m-d'),
            ])->values();
        });

        return view('accounts.index', compact('accounts', 'transactions', 'transactionsByAccount'));
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'account_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
        ]);

        $opening = round((float) ($data['opening_balance'] ?? 0), 2);

        BankAccount::query()->create([
            'account_name' => $data['account_name'],
            'bank_name' => $data['bank_name'] ?? '',
            'branch' => $data['branch'] ?? null,
            'opening_balance' => $opening,
            'balance' => $opening,
        ]);

        return back()->with('success', 'Account created successfully.');
    }

    public function updateAccount(Request $request, BankAccount $bankAccount): RedirectResponse
    {
        $data = $request->validate([
            'account_name' => ['required', 'string', 'max:255'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($data, $bankAccount) {
            $account = BankAccount::query()->lockForUpdate()->findOrFail($bankAccount->id);
            $oldOpening = (float) ($account->opening_balance ?? 0);
            $newOpening = array_key_exists('opening_balance', $data) && $data['opening_balance'] !== null
                ? round((float) $data['opening_balance'], 2)
                : $oldOpening;
            $delta = $newOpening - $oldOpening;

            $account->update([
                'account_name' => trim($data['account_name']),
                'bank_name' => trim((string) ($data['bank_name'] ?? '')),
                'branch' => trim((string) ($data['branch'] ?? '')) ?: null,
                'opening_balance' => $newOpening,
                'balance' => round((float) ($account->balance ?? 0) + $delta, 2),
            ]);
        });

        return back()->with('success', 'Account updated successfully.');
    }

    public function storeTransaction(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bank_account_id' => ['required', 'exists:bank_accounts,id'],
            'type' => ['required', 'in:deposit,withdraw'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string'],
            'transaction_date' => ['nullable', 'date'],
        ]);

        $txDate = !empty($data['transaction_date']) ? $data['transaction_date'] : now()->toDateString();

        DB::transaction(function () use ($data, $txDate) {
            $account = BankAccount::query()->lockForUpdate()->findOrFail($data['bank_account_id']);
            if ($data['type'] === 'withdraw' && (float) $data['amount'] > (float) $account->balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => 'Insufficient balance in ' . $account->account_name . '.',
                ]);
            }
            BankTransaction::query()->create([
                'bank_account_id' => $account->id,
                'type' => $data['type'],
                'amount' => (float) $data['amount'],
                'description' => $data['description'] ?: ($data['type'] === 'deposit' ? 'Balance Added' : 'Balance Withdrawn'),
                'transaction_date' => $txDate,
            ]);
            if ($data['type'] === 'deposit') {
                $account->increment('balance', (float) $data['amount']);
            } else {
                $account->decrement('balance', (float) $data['amount']);
            }
        });

        return back()->with('success', 'Transaction recorded successfully.');
    }

    public function transferAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_account_id' => ['required', 'exists:bank_accounts,id'],
            'to_account_id' => ['required', 'exists:bank_accounts,id', 'different:from_account_id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string', 'max:255'],
            'transaction_date' => ['nullable', 'date'],
        ]);

        $amount = round((float) $data['amount'], 2);
        $txDate = !empty($data['transaction_date']) ? $data['transaction_date'] : now()->toDateString();
        $note = trim((string) ($data['description'] ?? ''));

        DB::transaction(function () use ($data, $amount, $txDate, $note) {
            $from = BankAccount::query()->lockForUpdate()->findOrFail($data['from_account_id']);
            $to = BankAccount::query()->lockForUpdate()->findOrFail($data['to_account_id']);

            if ($amount > (float) $from->balance + 0.009) {
                throw ValidationException::withMessages([
                    'amount' => 'Insufficient balance in ' . $from->account_name . '.',
                ]);
            }

            $from->decrement('balance', $amount);
            $to->increment('balance', $amount);

            BankTransaction::query()->create([
                'bank_account_id' => $from->id,
                'type' => 'withdraw',
                'amount' => $amount,
                'description' => 'Transfer to ' . $to->account_name . ($note ? " ({$note})" : ''),
                'transaction_date' => $txDate,
            ]);

            BankTransaction::query()->create([
                'bank_account_id' => $to->id,
                'type' => 'deposit',
                'amount' => $amount,
                'description' => 'Transfer from ' . $from->account_name . ($note ? " ({$note})" : ''),
                'transaction_date' => $txDate,
            ]);
        });

        return back()->with('success', 'Balance transferred successfully.');
    }

    public function expenses(Request $request): View
    {
        $limit = in_array($request->integer('limit'), [10, 20, 50, 100], true)
            ? $request->integer('limit')
            : 10;

        $expenses = Expense::query()->orderByDesc('id')->paginate($limit)->withQueryString();
        $categories = ExpenseCategory::query()->where('status', true)->orderBy('name')->get();

        return view('expenses.index', compact('expenses', 'categories', 'limit'));
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
