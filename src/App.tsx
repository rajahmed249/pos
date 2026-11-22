import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Code2,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  ShoppingCart,
  User as UserIcon,
  UserCircle2,
} from 'lucide-react';
import { apiFetch } from './lib/api.ts';
import type { BootstrapPayload, Sale, SaleItem, UserAccount } from './types/pos.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { LoginView } from './components/LoginView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PosTerminalView } from './components/PosTerminalView.tsx';
import { SalesView } from './components/SalesView.tsx';
import { ProductsView } from './components/ProductsView.tsx';
import { PurchasesView } from './components/PurchasesView.tsx';
import { PartiesView } from './components/PartiesView.tsx';
import { FinanceView } from './components/FinanceView.tsx';
import { OperationsView } from './components/OperationsView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { MenuManagerView } from './components/MenuManagerView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { UsersView } from './components/UsersView.tsx';
import { BackupRestoreView } from './components/BackupRestoreView.tsx';
import { LaravelCodeView } from './components/LaravelCodeView.tsx';
import { InvoiceModal } from './components/InvoiceModal.tsx';
import { CenterPopupAlert } from './components/CenterPopupAlert.tsx';

function getInitialRoute(): string {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!path || path === 'index.php' || path === 'login') return 'dashboard';
  if (path === 'warranties') return 'units';
  if (path === 'user') return 'users';
  if (path === 'laravel-code') return 'laravel';
  return path;
}

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  owners: 'Owners',
  accounts: 'Bank Accounts',
  cashbook: 'Cash Book',
  pos: 'POS Terminal',
  sales: 'Sales',
  returns: 'Returns',
  estimates: 'Estimate',
  purchases: 'Purchase',
  stock: 'Stock',
  damages: 'Damages',
  units: 'Unit & Warranty',
  products: 'Products',
  categories: 'Categories',
  brands: 'Brand',
  catalog: 'Categories & Brands',
  expenses: 'Expenses',
  payments: 'Payments',
  customers: 'Customers',
  suppliers: 'Suppliers',
  employees: 'Employee & Salary',
  reports: 'Reports',
  settings: 'Shop Settings',
  users: 'User & Roles',
  backup: 'Backup & Restore',
  menus: 'Menu Manager',
  laravel: 'Laravel 13 Blade & Export',
};

export default function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [activeRoute, setActiveRoute] = useState<string>(getInitialRoute);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string>('admin');
  const [showLogin, setShowLogin] = useState<boolean>(
    () => window.location.pathname.replace(/^\/+|\/+$/g, '') === 'login'
  );
  // Desktop view keeps sidebar ALWAYS active by default; toggles smoothly open/closed with push layout
  const [desktopOpen, setDesktopOpen] = useState<boolean>(true);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [usersTab, setUsersTab] = useState<'directory' | 'roles' | 'account'>('directory');
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [invoiceModal, setInvoiceModal] = useState<{
    sale: Sale;
    items: SaleItem[];
    autoPrint?: boolean;
  } | null>(null);

  function loadBootstrap() {
    apiFetch<BootstrapPayload>('/api/bootstrap').then((data) => {
      setBootstrap(data);
      setCurrentUser((prev) => {
        if (prev) {
          const refreshed = data.users?.find((u) => u.id === prev.id);
          return refreshed ?? prev;
        }
        return data.users?.find((u) => u.is_active) ?? data.users?.[0] ?? null;
      });
    });
  }

  useEffect(() => {
    loadBootstrap();
    const onPop = () => {
      const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
      setShowLogin(p === 'login');
      setActiveRoute(getInitialRoute());
    };
    const onOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('mousedown', onOutsideClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('mousedown', onOutsideClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function navigate(routeKey: string) {
    setShowLogin(false);
    setActiveRoute(routeKey);
    const targetPath = routeKey === 'laravel' ? '/laravel-code' : routeKey === 'dashboard' ? '/' : `/${routeKey}`;
    window.history.pushState({}, '', targetPath);
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
    } catch {
      // continue sign out cleanly
    }
    setAuthToken(null);
    setShowLogin(true);
    window.history.pushState({}, '', '/login');
  }

  async function openInvoice(saleId: number, autoPrint = false) {
    const res = await apiFetch<{ sale: Sale; items: SaleItem[] }>(`/api/sales/${saleId}`);
    setInvoiceModal({ ...res, autoPrint });
  }

  if (!bootstrap) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <div className="h-6 w-40 bg-indigo-100 rounded animate-pulse" />
          <div className="h-24 bg-white border border-slate-100 rounded-2xl shadow-xs animate-pulse" />
        </div>
      </div>
    );
  }

  const settings = bootstrap.settings;
  const currency = settings.currency || '৳';
  const compact = settings.layout_mode === 'compact';
  const shopName = (settings.shop_name || 'YOUTH IT POS').trim();
  const isYouthItPos = shopName.toUpperCase().includes('YOUTH IT');

  if (showLogin) {
    return (
      <LoginView
        settings={settings}
        users={bootstrap.users}
        canReturnToWorkspace={Boolean(authToken || currentUser)}
        onReturnToWorkspace={() => navigate(activeRoute)}
        onSuccess={({ token, user }) => {
          setAuthToken(token);
          setCurrentUser(user);
          setActiveRole(user.role);
          loadBootstrap();
          navigate('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8fafc] text-slate-900">
      <Sidebar
        menus={bootstrap.menus}
        activeRoute={activeRoute}
        onNavigate={navigate}
        settings={settings}
        currentUser={currentUser}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onLogout={handleLogout}
        desktopOpen={desktopOpen}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Dashboard Wrapper: smoothly pushes left/right synchronized with sidebar without any blur */}
      <div
        className={`min-h-screen min-w-0 overflow-x-clip flex flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          desktopOpen ? 'lg:ml-[260px]' : 'lg:ml-0'
        }`}
      >
        {/* Fixed Sticky Topbar (No backdrop-blur to keep UI crystal clear during slide transitions) */}
        <header className="no-print sticky top-0 z-30 h-16 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-3 sm:px-6 lg:px-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
              aria-label="Toggle menu"
            >
              <MenuIcon className="w-4 h-4 shrink-0" />
            </button>
            {/* Desktop Push-Slide Toggle */}
            <button
              type="button"
              onClick={() => setDesktopOpen((v) => !v)}
              className="hidden lg:inline-flex p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
              aria-label="Toggle sidebar"
              title={desktopOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {desktopOpen ? <PanelLeftClose className="w-4 h-4 shrink-0" /> : <PanelLeftOpen className="w-4 h-4 shrink-0" />}
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 min-w-0 truncate">
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className="font-brand font-black tracking-tight text-base sm:text-lg whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                title="Go to Home Dashboard"
              >
                {isYouthItPos ? (
                  <>
                    <span className="text-[#065AA4]">YOUTH</span>{' '}
                    <span className="text-[#f97316]">IT</span>{' '}
                    <span className="text-[#4f46e5]">POS</span>
                  </>
                ) : (
                  <span className="text-slate-900">{shopName}</span>
                )}
              </button>
              <span className="hidden sm:inline text-slate-300 shrink-0">/</span>
              <span className="hidden sm:inline font-semibold text-slate-700 truncate">
                {ROUTE_TITLES[activeRoute] ?? activeRoute}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('backup')}
              title="Backup & Laravel Blade"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="hidden xl:inline">Laravel &amp; Backup</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('pos')}
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-[10px] text-xs font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_18px_rgba(79,70,229,0.4)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Open POS</span>
              <span className="sm:hidden">POS</span>
            </button>

            {/* Far-Right User Avatar & Name with Hover + Click Dropdown */}
            <div ref={userMenuRef} className="relative group pl-1 sm:pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/70 hover:border-indigo-200 transition-all cursor-pointer shrink-0"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs shrink-0 ring-2 ring-white overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #065AA4, #4f46e5)' }}
                >
                  {currentUser?.profile_image ? (
                    <img
                      src={currentUser.profile_image}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="w-5 h-5 shrink-0" />
                  )}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-800 max-w-[92px] sm:max-w-[160px] truncate">
                  {currentUser?.name || 'RAJ AHMED'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    userMenuOpen ? 'rotate-180 text-indigo-600' : 'group-hover:rotate-180 group-hover:text-indigo-600'
                  }`}
                />
              </button>

              <div
                className={`absolute right-0 top-full pt-2 w-60 z-50 transition-all duration-150 ${
                  userMenuOpen
                    ? 'opacity-100 visible translate-y-0'
                    : 'opacity-0 invisible -translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0'
                }`}
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.14)] overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #065AA4, #4f46e5)' }}
                    >
                      {currentUser?.profile_image ? (
                        <img
                          src={currentUser.profile_image}
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserCircle2 className="w-6 h-6 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-900 truncate">
                        {currentUser?.name || 'RAJ AHMED'}
                      </div>
                      <div className="text-[11px] font-semibold text-indigo-600 capitalize">
                        Role: {currentUser?.role || activeRole}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {currentUser?.email || 'rajahmed249@gmail.com'}
                      </div>
                    </div>
                  </div>

                  <div className="p-1.5 text-xs font-medium text-slate-700 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUsersTab('account');
                        setUserMenuOpen(false);
                        navigate('users');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Profile &amp; Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsersTab('directory');
                        setUserMenuOpen(false);
                        navigate('users');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>User &amp; Role Management</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Shop Settings</span>
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 min-w-0 ${compact ? 'p-3 sm:p-4' : 'p-3 sm:p-6 lg:p-7'} max-w-[1440px] w-full mx-auto`}>
          {activeRoute === 'dashboard' && (
            <DashboardView data={bootstrap} onNavigate={navigate} onOpenInvoice={openInvoice} />
          )}
          {activeRoute === 'pos' && (
            <PosTerminalView
              bootstrap={bootstrap}
              onSaleComplete={(sale, items) => {
                setInvoiceModal({ sale, items });
                loadBootstrap();
              }}
            />
          )}
          {activeRoute === 'sales' && (
            <SalesView
              currency={currency}
              accounts={bootstrap.bankAccounts}
              onOpenInvoice={openInvoice}
              onNewSale={() => navigate('pos')}
              onRefreshBootstrap={loadBootstrap}
            />
          )}
          {(activeRoute === 'products' ||
            activeRoute === 'catalog' ||
            activeRoute === 'units' ||
            activeRoute === 'categories' ||
            activeRoute === 'brands') && (
            <ProductsView
              bootstrap={bootstrap}
              initialTab={activeRoute}
              onRefreshBootstrap={loadBootstrap}
            />
          )}
          {activeRoute === 'purchases' && (
            <PurchasesView currency={currency} onRefreshBootstrap={loadBootstrap} />
          )}
          {(activeRoute === 'customers' || activeRoute === 'suppliers') && (
            <PartiesView mode={activeRoute} currency={currency} />
          )}
          {(activeRoute === 'estimates' ||
            activeRoute === 'accounts' ||
            activeRoute === 'expenses' ||
            activeRoute === 'returns' ||
            activeRoute === 'damages') && (
            <FinanceView section={activeRoute} bootstrap={bootstrap} onRefreshBootstrap={loadBootstrap} />
          )}
          {(activeRoute === 'owners' ||
            activeRoute === 'cashbook' ||
            activeRoute === 'stock' ||
            activeRoute === 'payments' ||
            activeRoute === 'employees') && (
            <OperationsView section={activeRoute} bootstrap={bootstrap} onRefreshBootstrap={loadBootstrap} />
          )}
          {activeRoute === 'reports' && <ReportsView currency={currency} />}
          {activeRoute === 'menus' && (
            <MenuManagerView menus={bootstrap.menus} onRefreshBootstrap={loadBootstrap} />
          )}
          {activeRoute === 'settings' && (
            <SettingsView
              settings={settings}
              onRefreshBootstrap={loadBootstrap}
              onOpenMenuManager={() => navigate('menus')}
            />
          )}
          {activeRoute === 'users' && (
            <UsersView
              currentUser={currentUser}
              initialTab={usersTab}
              onCurrentUserUpdated={(u) => {
                setCurrentUser(u);
                setActiveRole(u.role);
                loadBootstrap();
              }}
              onOpenLoginPage={() => {
                setShowLogin(true);
                window.history.pushState({}, '', '/login');
              }}
            />
          )}
          {activeRoute === 'backup' && <BackupRestoreView onRefreshBootstrap={loadBootstrap} />}
          {activeRoute === 'laravel' && <LaravelCodeView />}
        </main>
      </div>

      {invoiceModal && (
        <InvoiceModal
          sale={invoiceModal.sale}
          items={invoiceModal.items}
          settings={settings}
          autoPrint={invoiceModal.autoPrint}
          onClose={() => setInvoiceModal(null)}
        />
      )}

      <CenterPopupAlert />
    </div>
  );
}
