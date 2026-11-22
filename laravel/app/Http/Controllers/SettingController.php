<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingController extends Controller
{
    public function index(): View
    {
        $settings = Setting::allKeyed();

        return view('settings.index', compact('settings'));
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'shop_name' => ['required', 'string', 'max:150'],
            'shop_address' => ['nullable', 'string', 'max:255'],
            'shop_phone' => ['nullable', 'string', 'max:100'],
            'shop_email' => ['nullable', 'email', 'max:150'],
            'shop_website' => ['nullable', 'string', 'max:255'],
            'shop_logo' => ['nullable', 'string', 'max:255'],
            'shop_favicon' => ['nullable', 'string', 'max:255'],
            'shop_qr' => ['nullable', 'string', 'max:255'],
            'currency' => ['required', 'string', 'max:10'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'invoice_footer' => ['nullable', 'string', 'max:500'],
            'sidebar_theme' => ['required', 'in:slate,light'],
            'primary_color' => ['required', 'in:emerald,indigo,blue,slate'],
            'layout_mode' => ['required', 'in:comfortable,compact'],
        ]);

        foreach ($data as $key => $value) {
            Setting::setValue($key, (string) ($value ?? ''));
        }

        return back()->with('success', 'Shop and layout settings updated.');
    }
}
