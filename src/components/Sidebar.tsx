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
  'Sales & Purchase': Receipt,
  'Product Information': Package,
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

  const visibleMenus = menus
    .filter((m) => m.is_active && (m.roles.length === 0 || m.roles.includes(activeRole)))
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
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
        className={`no-print tech-sidebar-scroll fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col shrink-0 overflow-y-auto overflow-x-hidden border-r border-white/10 shadow-[4px_0_30px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${desktopOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}
      >
        {/* Fixed Sticky Sidebar Header with Colorful Clickable Home Brand */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 border-b border-white/10"
          style={{ background: '#14172b' }}
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
            <div className="w-10 h-10 rounded-[10px] bg-white border-2 border-[#ffd166] p-0.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
              <img src={logoSrc} alt={shopTitle} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h3 className="font-brand text-[18px] font-black tracking-tight leading-tight truncate">
                {isYouthItPos ? (
                  <>
                    <span className="text-[#60a5fa]">YOUTH</span>{' '}
                    <span className="text-[#fbbf24]">IT</span>{' '}
                    <span className="text-[#34d399]">POS</span>
                  </>
                ) : (
                  <span className="text-white">{shopTitle}</span>
                )}
              </h3>
              <p className="text-[10px] text-white/65 tracking-wide truncate flex items-center gap-1 mt-0.5">
                <Phone className="w-2.5 h-2.5 text-[#ffd166] shrink-0" />
                <span>{shopPhone}</span>
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 pt-3 pb-5 space-y-1">
          {/* Standalone Direct Links (Dashboard, Owners, Bank Accounts, Cash Book, then dashed divider, then POS, Sales) */}
          <ul className="space-y-0.5 pb-2 border-b border-white/10">
            {mainItems.map((menu) => {
              const Icon = ICON_MAP[menu.icon] ?? Circle;
              const active = activeRoute === menu.route_key;
              return (
                <li key={menu.id}>
                  {menu.route_key === 'pos' && (
                    <div aria-hidden="true" className="my-2 px-2">
                      <div className="border-t border-dashed border-white/25" />
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
                        ? 'bg-[#ffd166] text-[#1a1a2e] font-semibold shadow-[0_4px_15px_rgba(255,215,0,0.3)]'
                        : 'text-white/85 font-medium hover:bg-[#ffd166]/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 ${
                        active ? 'text-[#1a1a2e]' : 'text-[#ffd166]'
                      }`}
                    />
                    <span className="truncate text-left">{menu.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Collapsible Dropdown Sections (Closed by Default) */}
          <div className="space-y-1 pt-1">
            {dropdownGroups.map((grp) => {
              const GroupIcon = GROUP_ICONS[grp.label] ?? FolderTree;
              const isOpen = Boolean(openGroups[grp.label]);
              const hasActiveChild = grp.items.some((m) => m.route_key === activeRoute);

              return (
                <div key={grp.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.label)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all cursor-pointer ${
                      hasActiveChild
                        ? 'bg-white/10 text-white'
                        : 'text-white/85 hover:bg-[#ffd166]/10 hover:text-white'
                    }`}
                  >
                    <GroupIcon className="w-[18px] h-[18px] shrink-0 text-[#ffd166]" />
                    <span className="truncate flex-1 text-left">{grp.label}</span>
                    <ChevronRight
                      className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-90 text-[#ffd166]' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <ul className="mt-1 rounded-xl bg-black/25 py-1 space-y-0.5">
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
                                  ? 'bg-[#ffd166] text-[#1a1a2e] font-semibold shadow-[0_3px_12px_rgba(255,215,0,0.28)]'
                                  : 'text-white/75 hover:bg-[#ffd166]/10 hover:text-white'
                              }`}
                            >
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  active ? 'text-[#1a1a2e]' : 'text-[#ffd166]/75'
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
        <div className="px-3 pb-5 pt-3 border-t border-white/10 space-y-2">
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                onNavigate('users');
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500/80 text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden border border-white/20">
                {currentUser.profile_image ? (
                  <img src={currentUser.profile_image} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
                <div className="text-[11px] text-white/60 truncate mt-0.5">{currentUser.email}</div>
              </div>
            </button>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#ffd166]/70 mb-1 px-1">
              Active Role
            </label>
            <select
              value={activeRole}
              onChange={(e) => onRoleChange(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-[#ffd166]"
            >
              <option value="admin" className="bg-[#1a1a2e]">Admin (Full Access)</option>
              <option value="manager" className="bg-[#1a1a2e]">Manager</option>
              <option value="staff" className="bg-[#1a1a2e]">Staff</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onLogout();
            }}
            title="Logout"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-red-400/20 text-[13px] font-medium text-red-200 hover:bg-red-500/15 hover:text-white transition-all cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0 text-red-400" />
            <span className="truncate">Logout</span>
          </button>

          <a
            href="https://youthit.com.bd/"
            target="_blank"
            rel="noreferrer"
            title="View Website"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] border border-white/10 text-[13px] font-medium text-white/75 hover:bg-white/5 hover:text-white hover:border-[#34d399] transition-all"
          >
            <Globe className="w-[18px] h-[18px] shrink-0 text-[#34d399]" />
            <span className="truncate">View Website</span>
          </a>
        </div>
      </aside>
    </>
  );
}
