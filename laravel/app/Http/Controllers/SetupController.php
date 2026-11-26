<?php

namespace App\Http\Controllers;

use App\Models\Menu;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\MenuSeeder;
use Database\Seeders\SettingsSeeder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

class SetupController extends Controller
{
    public static function isSetupComplete(): bool
    {
        try {
            DB::connection()->getPdo();
            if (!Schema::hasTable('users')) {
                return false;
            }
            return User::query()
                ->where('is_active', true)
                ->where('password', 'like', '$%')
                ->exists();
        } catch (\Throwable) {
            return false;
        }
    }

    public function show(Request $request): View|RedirectResponse
    {
        if (self::isSetupComplete()) {
            return redirect()->route('login');
        }

        $defaults = [
            'db_host' => env('DB_HOST', '127.0.0.1'),
            'db_port' => env('DB_PORT', '3306'),
            'db_database' => env('DB_DATABASE', 'youthits_pos'),
            'db_username' => env('DB_USERNAME', 'root'),
            'app_url' => rtrim($request->getSchemeAndHttpHost().$request->getBaseUrl(), '/'),
            'has_sql_dump' => file_exists(database_path('sql/youthits_pos.sql')),
            'env_writable' => is_writable(base_path('.env')) || (!file_exists(base_path('.env')) && is_writable(base_path())),
            'storage_writable' => is_writable(storage_path('framework')),
            'pdo_mysql_loaded' => extension_loaded('pdo_mysql'),
        ];

        return view('setup.index', $defaults);
    }

    public function install(Request $request): RedirectResponse
    {
        if (self::isSetupComplete()) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'db_host' => ['required', 'string', 'max:120'],
            'db_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'db_database' => ['required', 'string', 'max:120'],
            'db_username' => ['required', 'string', 'max:120'],
            'db_password' => ['nullable', 'string', 'max:200'],
            'admin_email' => ['required', 'email', 'max:150'],
            'admin_password' => ['required', 'string', 'min:6', 'max:100'],
            'import_sql' => ['nullable', 'boolean'],
        ]);

        $host = trim($data['db_host']);
        $port = (string) ((int) $data['db_port']);
        $database = trim($data['db_database']);
        $username = trim($data['db_username']);
        $password = (string) ($data['db_password'] ?? '');

        // 1. Test raw MySQL PDO connection cleanly before touching .env
        try {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);
            new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_TIMEOUT => 5,
            ]);
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db_host' => 'MySQL connection failed: '.$e->getMessage()])
                ->withInput($request->except('db_password', 'admin_password'));
        }

        // 2. Write clean .env settings (ensure valid APP_KEY + file session driver)
        $appUrl = rtrim($request->getSchemeAndHttpHost().$request->getBaseUrl(), '/');
        try {
            $this->writeEnvValues([
                'APP_URL' => $appUrl,
                'DB_CONNECTION' => 'mysql',
                'DB_HOST' => $host,
                'DB_PORT' => $port,
                'DB_DATABASE' => $database,
                'DB_USERNAME' => $username,
                'DB_PASSWORD' => $password,
                'SESSION_DRIVER' => 'file',
                'CACHE_STORE' => 'file',
            ]);
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db_host' => 'Could not save .env file: '.$e->getMessage()])
                ->withInput($request->except('db_password', 'admin_password'));
        }

        // 3. Reconfigure runtime MySQL connection
        Config::set('database.default', 'mysql');
        Config::set('database.connections.mysql.host', $host);
        Config::set('database.connections.mysql.port', $port);
        Config::set('database.connections.mysql.database', $database);
        Config::set('database.connections.mysql.username', $username);
        Config::set('database.connections.mysql.password', $password);
        DB::purge('mysql');
        DB::reconnect('mysql');

        try {
            if (!Schema::hasTable('users') || !Schema::hasTable('products') || !Schema::hasTable('settings')) {
                Artisan::call('migrate', ['--force' => true]);
            }

            $shouldImport = $request->boolean('import_sql', true);
            $sqlPath = database_path('sql/youthits_pos.sql');
            if ($shouldImport && file_exists($sqlPath)) {
                $hasProducts = Schema::hasTable('products') && DB::table('products')->count() > 0;
                $hasUsers = Schema::hasTable('users') && DB::table('users')->count() > 0;
                if (!$hasProducts || !$hasUsers) {
                    Artisan::call('pos:import');
                }
            }

            if (Schema::hasTable('settings') && Setting::query()->count() === 0) {
                Artisan::call('db:seed', ['--class' => SettingsSeeder::class, '--force' => true]);
            }
            if (Schema::hasTable('menus') && Menu::query()->count() === 0) {
                Artisan::call('db:seed', ['--class' => MenuSeeder::class, '--force' => true]);
            }

            $email = strtolower(trim($data['admin_email']));
            $hashedPassword = Hash::make($data['admin_password']);
            $existing = User::query()->whereRaw('LOWER(email) = ?', [$email])->first()
                ?? User::query()->where('role', 'super_admin')->first();

            if ($existing) {
                $existing->forceFill([
                    'email' => $email,
                    'password' => $hashedPassword,
                    'is_active' => true,
                ])->save();
            } else {
                User::query()->create([
                    'name' => 'RAJ AHMED',
                    'email' => $email,
                    'password' => $hashedPassword,
                    'role' => 'super_admin',
                    'is_active' => true,
                ]);
            }

            Cache::flush();
        } catch (\Throwable $e) {
            return back()
                ->withErrors(['db_host' => 'Database setup step failed: '.$e->getMessage()])
                ->withInput($request->except('db_password', 'admin_password'));
        }

        return redirect()
            ->route('login')
            ->with('status', 'Youth IT POS installed and database ready! Sign in with your admin email and password.');
    }

    private function writeEnvValues(array $updates): void
    {
        $envPath = base_path('.env');
        $examplePath = base_path('.env.example');
        $content = file_exists($envPath)
            ? (string) file_get_contents($envPath)
            : (file_exists($examplePath) ? (string) file_get_contents($examplePath) : '');

        if (preg_match('/^APP_KEY=\s*$/m', $content) || !preg_match('/^APP_KEY=/m', $content)) {
            $updates['APP_KEY'] = 'base64:'.base64_encode(random_bytes(32));
        }

        foreach ($updates as $key => $rawValue) {
            $clean = str_replace(["\r", "\n"], '', (string) $rawValue);
            $needsQuotes = $clean !== '' && (strpbrk($clean, " \t#\"'\$") !== false);
            $formatted = $needsQuotes ? '"'.str_replace('"', '\\"', $clean).'"' : $clean;
            $line = "{$key}={$formatted}";

            if (preg_match('/^'.preg_quote($key, '/').'=/m', $content)) {
                $content = (string) preg_replace('/^'.preg_quote($key, '/').'=.*$/m', str_replace('$', '\\$', $line), $content, 1);
            } else {
                $content = rtrim($content)."\n{$line}\n";
            }
        }

        file_put_contents($envPath, $content);
    }
}
