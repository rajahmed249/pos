<?php

namespace App\Http\Controllers;

use App\Models\Menu;
use App\Models\Setting;
use App\Models\User;
use App\Support\LegacyScrypt;
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
    public static function hasConfiguredLoginUser(): bool
    {
        $users = User::query()
            ->where('is_active', true)
            ->get(['id', 'password']);

        foreach ($users as $user) {
            $hash = (string) ($user->password ?? '');
            if (str_starts_with($hash, '$') || LegacyScrypt::isLegacyHash($hash)) {
                return true;
            }
        }

        return false;
    }

    public static function isSetupComplete(): bool
    {
        try {
            DB::connection()->getPdo();
            if (!Schema::hasTable('users') || !Schema::hasTable('sales') || !Schema::hasTable('bank_accounts')) {
                return false;
            }
            return self::hasConfiguredLoginUser();
        } catch (\Throwable) {
            return false;
        }
    }

    public static function ensureMissingTables(): void
    {
        $required = ['users', 'settings', 'menus', 'categories', 'products', 'customers', 'suppliers', 'owners', 'owner_transactions', 'bank_accounts', 'expenses', 'sales', 'purchases'];
        $missing = false;
        foreach ($required as $table) {
            if (!Schema::hasTable($table)) {
                $missing = true;
                break;
            }
        }
        if (!$missing) {
            return;
        }

        $migrationFiles = glob(database_path('migrations/*.php')) ?: [];
        sort($migrationFiles);
        foreach ($migrationFiles as $file) {
            try {
                $migration = require $file;
                if (is_object($migration) && method_exists($migration, 'up')) {
                    $migration->up();
                }
            } catch (\Throwable) {
                // Skip tables that already exist in partial/pre-imported databases
            }
        }
    }

    public function show(Request $request): View|RedirectResponse
    {
        if (self::isSetupComplete()) {
            return redirect()->route('login');
        }

        $defaults = [
            'db_connection' => env('DB_CONNECTION', 'mysql'),
            'db_host' => env('DB_HOST', '127.0.0.1'),
            'db_port' => env('DB_PORT', '3306'),
            'db_database' => env('DB_DATABASE', 'youthits_pos'),
            'db_username' => env('DB_USERNAME', 'root'),
            'app_url' => rtrim($request->getSchemeAndHttpHost().$request->getBaseUrl(), '/'),
            'has_data_bundle' => file_exists(database_path('pos-store.json')) || file_exists(database_path('sql/youthits_pos.sql')),
            'env_writable' => is_writable(base_path('.env')) || (!file_exists(base_path('.env')) && is_writable(base_path())),
            'storage_writable' => is_writable(storage_path('framework')),
            'pdo_mysql_loaded' => extension_loaded('pdo_mysql'),
            'pdo_sqlite_loaded' => extension_loaded('pdo_sqlite'),
        ];

        return view('setup.index', $defaults);
    }

    public function install(Request $request): RedirectResponse
    {
        if (self::isSetupComplete()) {
            return redirect()->route('login');
        }

        $data = $request->validate([
            'db_connection' => ['required', 'in:mysql,sqlite'],
            'db_host' => ['nullable', 'string', 'max:120'],
            'db_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'db_database' => ['nullable', 'string', 'max:120'],
            'db_username' => ['nullable', 'string', 'max:120'],
            'db_password' => ['nullable', 'string', 'max:200'],
            'admin_email' => ['required', 'email', 'max:150'],
            'admin_password' => ['required', 'string', 'min:6', 'max:100'],
            'import_sql' => ['nullable', 'boolean'],
        ]);

        $driver = $data['db_connection'];
        $appUrl = rtrim($request->getSchemeAndHttpHost().$request->getBaseUrl(), '/');

        if ($driver === 'sqlite') {
            if (!extension_loaded('pdo_sqlite')) {
                return back()
                    ->withErrors(['db_connection' => 'PHP pdo_sqlite extension is not enabled. Choose MySQL or enable pdo_sqlite in php.ini.'])
                    ->withInput($request->except('db_password', 'admin_password'));
            }

            $sqliteFile = database_path('database.sqlite');
            if (!file_exists($sqliteFile)) {
                @touch($sqliteFile);
            }

            try {
                $this->writeEnvValues([
                    'APP_URL' => $appUrl,
                    'DB_CONNECTION' => 'sqlite',
                    'DB_DATABASE' => $sqliteFile,
                    'SESSION_DRIVER' => 'file',
                    'CACHE_STORE' => 'file',
                ]);
            } catch (\Throwable $e) {
                return back()
                    ->withErrors(['db_connection' => 'Could not save .env file: '.$e->getMessage()])
                    ->withInput($request->except('db_password', 'admin_password'));
            }

            Config::set('database.default', 'sqlite');
            Config::set('database.connections.sqlite.database', $sqliteFile);
            DB::purge('sqlite');
            DB::reconnect('sqlite');
        } else {
            $host = trim((string) ($data['db_host'] ?? '127.0.0.1'));
            $port = (string) ((int) ($data['db_port'] ?? 3306));
            $database = trim((string) ($data['db_database'] ?? 'youthits_pos'));
            $username = trim((string) ($data['db_username'] ?? 'root'));
            $password = (string) ($data['db_password'] ?? '');

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

            Config::set('database.default', 'mysql');
            Config::set('database.connections.mysql.host', $host);
            Config::set('database.connections.mysql.port', $port);
            Config::set('database.connections.mysql.database', $database);
            Config::set('database.connections.mysql.username', $username);
            Config::set('database.connections.mysql.password', $password);
            DB::purge('mysql');
            DB::reconnect('mysql');
        }

        try {
            if (!Schema::hasTable('migrations') && !Schema::hasTable('users')) {
                Artisan::call('migrate', ['--force' => true]);
            } else {
                try {
                    Artisan::call('migrate', ['--force' => true]);
                } catch (\Throwable) {
                    self::ensureMissingTables();
                }
                self::ensureMissingTables();
            }

            $shouldImport = $request->boolean('import_sql', true);
            $hasDataFiles = file_exists(database_path('pos-store.json')) || file_exists(database_path('sql/youthits_pos.sql'));
            if ($shouldImport && $hasDataFiles) {
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
            $needsQuotes = $clean !== '' && (strpbrk($clean, " \t#\"'\$\\") !== false);
            $escaped = str_replace(['\\', '"'], ['\\\\', '\\"'], $clean);
            $formatted = $needsQuotes ? '"'.$escaped.'"' : $clean;
            $line = "{$key}={$formatted}";
            $pregLine = str_replace(['\\', '$'], ['\\\\', '\\$'], $line);

            if (preg_match('/^'.preg_quote($key, '/').'=/m', $content)) {
                $content = (string) preg_replace('/^'.preg_quote($key, '/').'=.*$/m', $pregLine, $content, 1);
            } else {
                $content = rtrim($content)."\n{$line}\n";
            }
        }

        file_put_contents($envPath, $content);
    }
}
