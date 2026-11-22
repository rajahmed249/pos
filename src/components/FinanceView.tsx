import { useEffect, useState } from 'react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { BankAccount, BootstrapPayload, Product, Sale } from '../types/pos.ts';

interface FinanceViewProps {
  section: 'estimates' | 'accounts' | 'expenses' | 'returns' | 'damages';
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => void;
}

export function FinanceView({ section, bootstrap, onRefreshBootstrap }: FinanceViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Estimates state
  const [estimates, setEstimates] = useState<Array<{ id: number; estimate_no: string; customer_name: string; product_name: string; total: number; status: string }>>([]);
  const [estForm, setEstForm] = useState({ customer_name: '', product_id: '', quantity: '1', price: '' });

  // Accounts state
  const [accounts, setAccounts] = useState<BankAccount[]>(bootstrap.bankAccounts);
  const [transactions, setTransactions] = useState<Array<{ id: number; account_name: string; type: string; amount: number; description: string; transaction_date: string }>>([]);
  const [txForm, setTxForm] = useState({ bank_account_id: String(bootstrap.bankAccounts[0]?.id ?? ''), type: 'deposit', amount: '', description: '' });
  const [newAccForm, setNewAccForm] = useState({ account_name: '', bank_name: '', opening_balance: '0' });

  // Expenses state
  const [expenses, setExpenses] = useState<Array<{ id: number; category: string; amount: number; expense_date: string; description: string }>>([]);
  const [expForm, setExpForm] = useState({ category: bootstrap.expenseCategories[0]?.name ?? 'Other', amount: '', description: '' });

  // Returns & Damages state
  const [returnsList, setReturnsList] = useState<Array<{ id: number; invoice_no: string; product_name: string; quantity: number; total_amount: number }>>([]);
  const [damagesList, setDamagesList] = useState<Array<{ id: number; product_name: string; quantity: number; loss_amount: number }>>([]);
  const [retForm, setRetForm] = useState({ sale_id: '', product_id: '', quantity: '1', price: '0', reason: '' });
  const [dmgForm, setDmgForm] = useState({ product_id: '', quantity: '1', reason: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function loadSection() {
    if (section === 'estimates') {
      apiFetch<{ items: typeof estimates }>('/api/estimates').then((r) => setEstimates(r.items));
    } else if (section === 'accounts') {
      apiFetch<{ accounts: BankAccount[]; transactions: typeof transactions }>('/api/accounts').then((r) => {
        setAccounts(r.accounts);
        setTransactions(r.transactions);
      });
    } else if (section === 'expenses') {
      apiFetch<{ items: typeof expenses }>('/api/expenses').then((r) => setExpenses(r.items));
    } else if (section === 'returns' || section === 'damages') {
      apiFetch<{ returns: typeof returnsList; damages: typeof damagesList }>('/api/returns-damages').then((r) => {
        setReturnsList(r.returns);
        setDamagesList(r.damages);
      });
    }
  }

  useEffect(() => {
    setNotice(null);
    loadSection();
    if (section === 'estimates' || section === 'returns' || section === 'damages') {
      apiFetch<{ items: Product[] }>('/api/products?limit=150').then((r) => {
        setProducts(r.items);
        if (r.items[0]) {
          setEstForm((prev) => ({ ...prev, product_id: prev.product_id || String(r.items[0].id), price: prev.price || String(r.items[0].selling_price) }));
          setRetForm((prev) => ({ ...prev, product_id: prev.product_id || String(r.items[0].id), price: String(r.items[0].selling_price) }));
          setDmgForm((prev) => ({ ...prev, product_id: prev.product_id || String(r.items[0].id) }));
        }
      });
    }
    if (section === 'returns') {
      apiFetch<{ items: Sale[] }>('/api/sales?limit=50').then((r) => {
        setSales(r.items);
        if (r.items[0]) setRetForm((prev) => ({ ...prev, sale_id: prev.sale_id || String(r.items[0].id) }));
      });
    }
  }, [section]);

  const noticeBar = notice ? (
    <div
      className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold border ${
        notice.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      {notice.text}
    </div>
  ) : null;

  if (section === 'estimates') {
    return (
      <div>
        {noticeBar}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-lg p-4 h-fit">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Create Estimate</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                try {
                  await apiFetch('/api/estimates', { method: 'POST', body: JSON.stringify(estForm) });
                  setEstForm({ ...estForm, customer_name: '' });
                  setNotice({ type: 'success', text: 'Estimate created successfully!' });
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create estimate.' });
                }
              }}
              className="space-y-3 text-sm"
            >
              <input required placeholder="Customer / Company" value={estForm.customer_name} onChange={(e) => setEstForm({ ...estForm, customer_name: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
              <select value={estForm.product_id} onChange={(e) => {
                const p = products.find((x) => String(x.id) === e.target.value);
                setEstForm({ ...estForm, product_id: e.target.value, price: p ? String(p.selling_price) : estForm.price });
              }} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="number" min={1} value={estForm.quantity} onChange={(e) => setEstForm({ ...estForm, quantity: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums" />
                <input type="number" step="0.01" min={0} value={estForm.price} onChange={(e) => setEstForm({ ...estForm, price: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums" />
              </div>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">Create Estimate</button>
            </form>
          </div>

          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Estimate #</th>
                    <th className="px-4 py-2.5 text-left">Customer</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Total</th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estimates.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{e.estimate_no}</td>
                      <td className="px-4 py-2">{e.customer_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap">{formatMoney(e.total, cur)}</td>
                      <td className="px-4 py-2 text-xs uppercase text-slate-600 whitespace-nowrap">{e.status}</td>
                    </tr>
                  ))}
                  {estimates.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">No estimates created yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'accounts') {
    return (
      <div className="space-y-6">
        {noticeBar}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="min-w-0 bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500 truncate">{acc.account_name}</div>
              <div className="mt-1 text-lg font-display font-bold tabular-nums text-slate-900">{formatMoney(acc.balance, cur)}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 space-y-5">
            <div className="bg-white border border-slate-200 rounded-lg p-4 h-fit">
              <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Deposit / Withdraw</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch('/api/accounts/transactions', { method: 'POST', body: JSON.stringify(txForm) });
                    setTxForm({ ...txForm, amount: '', description: '' });
                    setNotice({ type: 'success', text: 'Account transaction posted!' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Transaction failed.' });
                  }
                }}
                className="space-y-3 text-sm"
              >
                <select value={txForm.bank_account_id} onChange={(e) => setTxForm({ ...txForm, bank_account_id: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
                <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md">
                  <option value="deposit">Deposit</option>
                  <option value="withdraw">Withdraw</option>
                </select>
                <input type="number" step="0.01" min="0.01" required placeholder="Amount" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md tabular-nums" />
                <input type="text" placeholder="Description" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
                <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">Post Transaction</button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 h-fit">
              <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Add Bank Account</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch('/api/accounts', { method: 'POST', body: JSON.stringify(newAccForm) });
                    setNewAccForm({ account_name: '', bank_name: '', opening_balance: '0' });
                    setNotice({ type: 'success', text: 'Bank account added!' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create account.' });
                  }
                }}
                className="space-y-3 text-sm"
              >
                <input required placeholder="Account Name *" value={newAccForm.account_name} onChange={(e) => setNewAccForm({ ...newAccForm, account_name: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
                <input placeholder="Bank Name" value={newAccForm.bank_name} onChange={(e) => setNewAccForm({ ...newAccForm, bank_name: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
                <input type="number" step="0.01" min="0" placeholder="Opening Balance" value={newAccForm.opening_balance} onChange={(e) => setNewAccForm({ ...newAccForm, opening_balance: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md tabular-nums" />
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-md font-medium cursor-pointer">Create Account</button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 text-left">Account</th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Type</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap">{tx.transaction_date}</td>
                      <td className="px-4 py-2">{tx.account_name}</td>
                      <td className={`px-4 py-2 text-xs uppercase whitespace-nowrap ${tx.type === 'deposit' ? 'text-emerald-700' : 'text-red-600'}`}>{tx.type}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap">{formatMoney(tx.amount, cur)}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">No manual bank transfers logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'expenses') {
    return (
      <div>
        {noticeBar}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-lg p-4 h-fit">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Record Expense</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                try {
                  await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(expForm) });
                  setExpForm({ ...expForm, amount: '', description: '' });
                  setNotice({ type: 'success', text: 'Expense recorded!' });
                  loadSection();
                  onRefreshBootstrap();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save expense.' });
                }
              }}
              className="space-y-3 text-sm"
            >
              <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md">
                {bootstrap.expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <input type="number" step="0.01" min="0.01" required placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md tabular-nums" />
              <textarea rows={2} placeholder="Description" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">Save Expense</button>
            </form>
          </div>

          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 text-left">Category</th>
                    <th className="px-4 py-2.5 text-left">Note</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((ex) => (
                    <tr key={ex.id}>
                      <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap">{ex.expense_date}</td>
                      <td className="px-4 py-2 font-medium">{ex.category}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{ex.description || '-'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600 font-medium whitespace-nowrap">{formatMoney(ex.amount, cur)}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">No expenses logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {noticeBar}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {section === 'returns' && (
        <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-slate-900 mb-4">Sales Return</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/returns', { method: 'POST', body: JSON.stringify(retForm) });
                setNotice({ type: 'success', text: 'Sales return processed and stock restored!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to process return.' });
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm mb-5"
          >
            <select value={retForm.sale_id} onChange={(e) => setRetForm({ ...retForm, sale_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg">
              {sales.map((s) => <option key={s.id} value={s.id}>{s.invoice_no} — {s.customer_name}</option>)}
            </select>
            <select value={retForm.product_id} onChange={(e) => setRetForm({ ...retForm, product_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg">
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" min={1} value={retForm.quantity} onChange={(e) => setRetForm({ ...retForm, quantity: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg tabular-nums" placeholder="Qty" />
            <input type="number" step="0.01" min={0} value={retForm.price} onChange={(e) => setRetForm({ ...retForm, price: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg tabular-nums" placeholder="Price" />
            <button type="submit" className="py-2 px-4 bg-slate-900 text-white rounded-lg font-medium cursor-pointer">Process Return</button>
          </form>
          <div className="divide-y divide-slate-100 text-xs">
            {returnsList.map((r) => (
              <div key={r.id} className="py-2.5 flex justify-between gap-2">
                <span className="truncate font-medium">{r.invoice_no} · {r.product_name} (x{r.quantity})</span>
                <span className="tabular-nums font-semibold shrink-0">{formatMoney(r.total_amount, cur)}</span>
              </div>
            ))}
            {returnsList.length === 0 && <div className="py-4 text-slate-500">No returns recorded.</div>}
          </div>
        </div>
        )}

        {section === 'damages' && (
        <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 shadow-xs">
          <h2 className="font-display text-base font-bold text-slate-900 mb-4">Damaged Stock</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/damages', { method: 'POST', body: JSON.stringify(dmgForm) });
                setNotice({ type: 'success', text: 'Damaged stock recorded!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to record damage.' });
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-5"
          >
            <select value={dmgForm.product_id} onChange={(e) => setDmgForm({ ...dmgForm, product_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg">
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>)}
            </select>
            <input type="number" min={1} value={dmgForm.quantity} onChange={(e) => setDmgForm({ ...dmgForm, quantity: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg tabular-nums" placeholder="Qty" />
            <input type="text" placeholder="Damage reason" value={dmgForm.reason} onChange={(e) => setDmgForm({ ...dmgForm, reason: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <button type="submit" className="py-2 px-4 bg-red-600 text-white rounded-lg font-medium cursor-pointer">Record Damage</button>
          </form>
          <div className="divide-y divide-slate-100 text-xs">
            {damagesList.map((d) => (
              <div key={d.id} className="py-2.5 flex justify-between gap-2">
                <span className="truncate font-medium">{d.product_name} (x{d.quantity})</span>
                <span className="tabular-nums text-red-600 font-semibold shrink-0">{formatMoney(d.loss_amount, cur)}</span>
              </div>
            ))}
            {damagesList.length === 0 && <div className="py-4 text-slate-500">No damages recorded.</div>}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
