<?php

namespace App\Http\Controllers;

use App\Models\Menu;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class MenuController extends Controller
{
    public function index(): View
    {
        $menus = Menu::query()->orderBy('sort_order')->orderBy('id')->get();

        return view('menus.index', compact('menus'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'group_label' => ['nullable', 'string', 'max:80'],
            'route_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:60'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['in:admin,manager,staff'],
            'is_active' => ['boolean'],
        ]);

        $data['sort_order'] = $data['sort_order'] ?? ((Menu::query()->max('sort_order') ?? 0) + 1);
        $data['is_active'] = $request->boolean('is_active', true);

        Menu::query()->create($data);

        return back()->with('success', 'Dynamic menu item added.');
    }

    public function update(Request $request, Menu $menu): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'group_label' => ['nullable', 'string', 'max:80'],
            'route_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:60'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'roles' => ['nullable', 'array'],
            'is_active' => ['boolean'],
        ]);

        $data['is_active'] = $request->boolean('is_active');
        $menu->update($data);

        return back()->with('success', 'Menu item updated.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $orders = $request->validate([
            'orders' => ['required', 'array'],
            'orders.*' => ['integer', 'min:0'],
        ])['orders'];

        foreach ($orders as $id => $position) {
            Menu::query()->where('id', $id)->update(['sort_order' => $position]);
        }

        return back()->with('success', 'Menu ordering saved.');
    }

    public function destroy(Menu $menu): RedirectResponse
    {
        $menu->delete();

        return back()->with('success', 'Menu item deleted.');
    }
}
