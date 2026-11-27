<?php

namespace App\Providers;

use App\Models\Menu;
use App\Models\Setting;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Paginator::defaultView('pagination.custom');
        Paginator::defaultSimpleView('pagination.custom');
        View::addExtension('blade', 'blade');

        View::composer('*', function ($view): void {
            if (app()->runningInConsole()) {
                return;
            }

            $settings = [];
            $sidebarMenus = collect();

            try {
                if (Schema::hasTable('settings')) {
                    $settings = Setting::allKeyed();
                }

                if (Schema::hasTable('menus')) {
                    $role = Auth::user()?->role ?? 'staff';
                    $allMenus = Cache::remember('app_sidebar_menus_v2', 300, function () {
                        $needsMenuSync = Menu::query()
                            ->where(function ($q) {
                                $q->whereIn('route_name', ['products.index', 'products'])
                                    ->where('group_label', '!=', 'Product Management');
                            })
                            ->orWhere(function ($q) {
                                $q->whereIn('route_name', ['products.create', 'add-product'])
                                    ->where('group_label', '!=', 'Product Management');
                            })
                            ->orWhere(function ($q) {
                                $q->whereIn('route_name', ['purchases.index', 'purchases'])
                                    ->where('group_label', '!=', 'Main');
                            })
                            ->exists();

                        if ($needsMenuSync) {
                            DB::table('menus')
                                ->whereIn('route_name', ['purchases.index', 'purchases'])
                                ->update([
                                    'title' => 'Purchase',
                                    'group_label' => 'Main',
                                    'sort_order' => 7,
                                ]);
                            DB::table('menus')
                                ->whereIn('route_name', ['products.index', 'products'])
                                ->update([
                                    'title' => 'Product Manage',
                                    'group_label' => 'Product Management',
                                    'sort_order' => 8,
                                ]);
                            DB::table('menus')
                                ->whereIn('route_name', ['products.create', 'add-product'])
                                ->update([
                                    'title' => 'Add Product',
                                    'group_label' => 'Product Management',
                                    'sort_order' => 9,
                                ]);
                        }

                        return Menu::query()
                            ->whereNull('parent_id')
                            ->where('is_active', true)
                            ->with(['children' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
                            ->orderBy('sort_order')
                            ->get();
                    });

                    $sidebarMenus = $allMenus
                        ->toBase()
                        ->filter(fn (Menu $menu) => $menu->isVisibleTo($role))
                        ->map(function (Menu $menu) use ($role) {
                            $menu->setRelation(
                                'children',
                                $menu->children->toBase()->filter(fn (Menu $child) => $child->isVisibleTo($role))->values()
                            );
                            return $menu;
                        })
                        ->values();
                }
            } catch (\Throwable) {
                $settings = [];
                $sidebarMenus = collect();
            }

            $view->with('appSettings', array_merge([
                'shop_name' => 'YOUTH IT POS',
                'shop_address' => 'Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216',
                'shop_phone' => '01674297522',
                'shop_email' => 'info@youthit.com.bd',
                'shop_website' => 'www.youthit.com.bd',
                'shop_logo' => 'assets/images/logo.jpg',
                'shop_favicon' => 'assets/images/favicon.png',
                'shop_qr' => 'assets/images/shop_qr.png',
                'currency' => '৳',
                'tax_rate' => '0',
                'invoice_footer' => 'No warranty will valid upon burn or physical damage cases.',
                'sidebar_theme' => 'slate',
                'primary_color' => 'emerald',
                'layout_mode' => 'comfortable',
            ], $settings));

            $view->with('sidebarMenus', $sidebarMenus);
        });
    }
}
