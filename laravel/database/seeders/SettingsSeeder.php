<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
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
        ];

        foreach ($defaults as $key => $value) {
            Setting::query()->firstOrCreate(
                ['key_name' => $key],
                ['value' => $value]
            );
        }
    }
}
