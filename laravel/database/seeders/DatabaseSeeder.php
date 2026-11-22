<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SettingsSeeder::class,
            MenuSeeder::class,
        ]);

        if (file_exists(database_path('sql/youthits_pos.sql'))) {
            Artisan::call('pos:import');
        }
    }
}
