import { useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronRight,
  Circle,
  Code2,
  CreditCard,
  DatabaseBackup,
  FileText,
  FolderTree,
  Globe,
  Landmark,
  LayoutDashboard,
  ListTree,
  LogOut,
  Package,
  Phone,
  PlusCircle,
  Receipt,
  RotateCcw,
  Ruler,
  ShoppingCart,
  Sliders,
  Store,
  Tag,
  Truck,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { DynamicMenu, UserAccount } from '../types/pos.ts';

interface SidebarProps {
  menus: DynamicMenu[];
  activeRoute: string;
  onNavigate: (routeKey: string) => void;
  settings: Record<string, string>;
  currentUser: UserAccount | null;
  activeRole: string;
  onRoleChange: (role: string) => void;
  onLogout: () => void;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const ICON_MAP: Record<string, typeof Circle> = {
  'layout-dashboard': LayoutDashboard,
  'user-check': UserCheck,
  landmark: Landmark,
  'book-open': BookOpen,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  'rotate-ccw': RotateCcw,
  'file-text': FileText,
  truck: Truck,
  boxes: Boxes,
  'alert-triangle': AlertTriangle,
  ruler: Ruler,
  package: Package,
  'folder-tree': FolderTree,
  tag: Tag,
  wallet: Wallet,
  'credit-card': CreditCard,
  users: Users,
  'building-2': Building2,
  'badge-dollar-sign': BadgeDollarSign,
  'bar-chart-3': BarChart3,
  sliders: Sliders,
  'user-cog': UserCog,
  'database-backup': DatabaseBackup,
  'list-tree': ListTree,
  'code-2': Code2,
  store: Store,
  'plus-circle': PlusCircle,
};

const GROUP_ICONS: Record<string, typeof Circle> = {
  'Product Management': Package,
  'Sales & Purchase': Receipt,
  'Product Information': Tag,
  'Expenses & Payment': Wallet,
  Peoples: Users,
  Reports: BarChart3,
  'Settings & Customize': Sliders,
};

export function Sidebar({
  menus,
  activeRoute,
  onNavigate,
  settings,
  currentUser,
  activeRole,
  onRoleChange,
  onLogout,
  desktopOpen,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  // All dropdown sections start CLOSED by default; open only when user clicks heading/arrow
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [logoFailed, setLogoFailed] = useState(false);

  const visibleMenus = menus
    .filter(
      (m) =>
        m.is_active &&
        (activeRole === 'super_admin' || m.roles.length === 0 || m.roles.includes(activeRole))
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const mainItems = visibleMenus.filter(
    (m) => !m.group_label || m.group_label === 'Main' || m.group_label === 'Overview'
  );

  const dropdownGroups: Array<{ label: string; items: DynamicMenu[] }> = [];
  for (const menu of visibleMenus) {
    const label = menu.group_label || 'Main';
    if (label === 'Main' || label === 'Overview') continue;
    let grp = dropdownGroups.find((g) => g.label === label);
    if (!grp) {
      grp = { label, items: [] };
      dropdownGroups.push(grp);
    }
    grp.items.push(menu);
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const shopTitle = (settings.shop_name || 'YOUTH IT POS').trim();
  const rawLogo = settings.shop_logo || '/assets/images/logo.jpg';
  const logoSrc = rawLogo.startsWith('http') || rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;
  const shopPhone = settings.shop_phone || '01674297522';
  const isLight = settings.sidebar_theme === 'light';

  const isYouthItPos = shopTitle.toUpperCase().includes('YOUTH IT');

  return (
    <>
      {/* Non-blurred mobile backdrop only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        style={{
          background: isLight
            ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
            : 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
        className={`no-print tech-sidebar-scroll fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col shrink-0 overflow-y-auto overflow-x-hidden border-r transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isLight
            ? 'border-slate-200 shadow-[4px_0_24px_rgba(15,23,42,0.08)]'
            : 'border-white/10 shadow-[4px_0_30px_rgba(0,0,0,0.3)]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}
      >
        {/* Fixed Sticky Sidebar Header with Colorful Clickable Home Brand */}
        <div
          className={`sticky top-0 z-20 flex items-center justify-between px-4 py-4 border-b ${
            isLight ? 'border-slate-200 bg-white' : 'border-white/10'
          }`}
          style={isLight ? undefined : { background: '#14172b' }}
        >
          <button
            type="button"
            onClick={() => {
              onNavigate('dashboard');
              onCloseMobile();
            }}
            className="flex items-center gap-3 text-left min-w-0 group cursor-pointer"
            title="Go to Dashboard Home"
          >
            <div
              className={`w-10 h-10 rounded-[10px] bg-white border-2 p-0.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform ${
                isLight ? 'border-indigo-500' : 'border-[#ffd166]'
              }`}
            >
              {!logoFailed ? (
                <img
                  src={logoSrc}
                  alt={shopTitle}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs font-black text-indigo-700">{shopTitle.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-brand text-[18px] font-black tracking-tight leading-tight truncate">
                {isYouthItPos ? (
                  <>
                    <span className={isLight ? 'text-[#065AA4]' : 'text-[#60a5fa]'}>YOUTH</span>{' '}
                    <span className={isLight ? 'text-[#ea580c]' : 'text-[#fbbf24]'}>IT</span>{' '}
                    <span className={isLight ? 'text-[#059669]' : 'text-[#34d399]'}>POS</span>
                  </>
                ) : (
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>{shopTitle}</span>
                )}
              </h3>
              <p
                className={`text-[10px] tracking-wide truncate flex items-center gap-1 mt-0.5 ${
                  isLight ? 'text-slate-500' : 'text-white/65'
                }`}
              >
                <Phone className={`w-2.5 h-2.5 shrink-0 ${isLight ? 'text-indigo-500' : 'text-[#ffd166]'}`} />
                <span>{shopPhone}</span>
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className={`lg:hidden p-1.5 rounded-lg shrink-0 cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 pt-3 pb-5 space-y-1">
          {/* Standalone Direct Links */}
          <ul className={`space-y-0.5 pb-2 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            {mainItems.map((menu) => {
              const Icon = ICON_MAP[menu.icon] ?? Circle;
              const active = activeRoute === menu.route_key;
              return (
                <li key={menu.id}>
                  {(menu.route_key === 'pos' || menu.route_key === 'products') && (
                    <div aria-hidden="true" className="my-2 px-2">
                      <div className={`border-t border-dashed ${isLight ? 'border-slate-300' : 'border-white/25'}`} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(menu.route_key);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[13px] transition-all cursor-pointer ${
                      active
                        ? isLight
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'bg-[#ffd166] text-[#1a1a2e] font-semibold shadow-[0_4px_15px_rgba(255,215,0,0.3)]'
                        : isLight
                          ? 'text-slate-700 font-medium hover:bg-indigo-50 hover:text-indigo-700'
                          : 'text-white/85 font-medium hover:bg-[#ffd166]/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        active
                          ? isLight
                            ? 'text-white'
                            : 'text-[#1a1a2e]'
                          : isLight
                            ? 'text-indigo-600'
                            : 'text-[#ffd166]'
                      }`}
                    />
                    <span className="truncate text-left">{menu.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Collapsible Dropdown Sections */}
          <div className="space-y-1 pt-1">
            {dropdownGroups.map((grp) => {
              const GroupIcon = GROUP_ICONS[grp.label] ?? FolderTree;
              const hasActiveChild = grp.items.some((m) => m.route_key === activeRoute);
              const isOpen = openGroups[grp.label] ?? hasActiveChild;

              return (
                <div key={grp.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.label)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all cursor-pointer ${
                      hasActiveChild
                        ? isLight
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-white/10 text-white'
                        : isLight
                          ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          : 'text-white/85 hover:bg-[#ffd166]/10 hover:text-white'
                    }`}
                  >
                    <GroupIcon className={`w-[18px] h-[18px] shrink-0 ${isLight ? 'text-indigo-600' : 'text-[#ffd166]'}`} />
                    <span className="truncate flex-1 text-left">{grp.label}</span>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isOpen
                          ? isLight
                            ? 'rotate-90 text-indigo-600'
                            : 'rotate-90 text-[#ffd166]'
                          : isLight
                            ? 'text-slate-400'
                            : 'text-white/50'
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <ul className={`mt-1 rounded-xl py-1 space-y-0.5 ${isLight ? 'bg-slate-100/80' : 'bg-black/25'}`}>
                      {grp.items.map((menu) => {
                        const Icon = ICON_MAP[menu.icon] ?? Circle;
                        const active = activeRoute === menu.route_key;
                        return (
                          <li key={menu.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onNavigate(menu.route_key);
                                onCloseMobile();
                              }}
                              className={`relative w-full text-left pl-9 pr-3.5 py-2 text-[12px] transition-all cursor-pointer flex items-center gap-2.5 rounded-lg ${
                                active
                                  ? isLight
                                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                    : 'bg-[#ffd166] text-[#1a1a2e] font-semibold shadow-[0_3px_12px_rgba(255,215,0,0.28)]'
                                  : isLight
                                    ? 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                                    : 'text-white/75 hover:bg-[#ffd166]/10 hover:text-white'
                              }`}
                            >
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  active
                                    ? isLight
                                      ? 'text-white'
                                      : 'text-[#1a1a2e]'
                                    : isLight
                                      ? 'text-indigo-500'
                                      : 'text-[#ffd166]/75'
                                }`}
                              />
                              <span className="truncate">{menu.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom Active User, Role, Logout & View Website */}
        <div className={`px-3 pb-5 pt-3 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                onNavigate('users');
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200/70' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500/80 text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden border border-white/20">
                {currentUser.profile_image ? (
                  <img src={currentUser.profile_image} alt={currentUser.name} referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                ) : (
                  <span>{currentUser.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-semibold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentUser.name}</div>
                <div className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>{currentUser.email}</div>
              </div>
            </button>
          )}

          {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 px-1 ${isLight ? 'text-indigo-600' : 'text-[#ffd166]/70'}`}>
                Active Role
              </label>
              <select
                value={activeRole}
                onChange={(e) => onRoleChange(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'
                    : 'bg-black/30 border-white/10 text-white/90 focus:border-[#ffd166]'
                }`}
              >
                {currentUser?.role === 'super_admin' && (
                  <option value="super_admin" className={isLight ? 'bg-white' : 'bg-[#1a1a2e]'}>Super Admin (Full Access)</option>
                )}
                <option value="admin" className={isLight ? 'bg-white' : 'bg-[#1a1a2e]'}>Admin (Full Access)</option>
                <option value="manager" className={isLight ? 'bg-white' : 'bg-[#1a1a2e]'}>Manager</option>
                <option value="staff" className={isLight ? 'bg-white' : 'bg-[#1a1a2e]'}>Staff</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onLogout();
            }}
            title="Logout"
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border text-[13px] font-medium transition-all cursor-pointer ${
              isLight
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-red-400/20 text-red-200 hover:bg-red-500/15 hover:text-white'
            }`}
          >
            <LogOut className={`w-[18px] h-[18px] shrink-0 ${isLight ? 'text-red-500' : 'text-red-400'}`} />
            <span className="truncate">Logout</span>
          </button>

          <a
            href="https://youthit.com.bd/"
            target="_blank"
            rel="noreferrer"
            title="View Website"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border text-[13px] font-medium transition-all ${
              isLight
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-emerald-400'
                : 'border-white/10 text-white/75 hover:bg-white/5 hover:text-white hover:border-[#34d399]'
            }`}
          >
            <Globe className={`w-[18px] h-[18px] shrink-0 ${isLight ? 'text-emerald-600' : 'text-[#34d399]'}`} />
            <span className="truncate">View Website</span>
          </a>
        </div>
      </aside>
    </>
  );
}
