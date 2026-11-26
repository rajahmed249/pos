<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$baseDir = dirname(__DIR__);

// Ensure required writable directories exist on fresh hosting/local extraction
foreach ([
    $baseDir.'/bootstrap/cache',
    $baseDir.'/storage/app/private',
    $baseDir.'/storage/app/public',
    $baseDir.'/storage/framework/cache/data',
    $baseDir.'/storage/framework/sessions',
    $baseDir.'/storage/framework/views',
    $baseDir.'/storage/logs',
] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
}

// Auto-bootstrap .env & APP_KEY on first visit so MissingAppKeyException never causes 500
$envFile = $baseDir.'/.env';
$envExample = $baseDir.'/.env.example';
if (!file_exists($envFile) && file_exists($envExample)) {
    @copy($envExample, $envFile);
}
if (file_exists($envFile) && is_writable($envFile)) {
    $envRaw = @file_get_contents($envFile);
    if (is_string($envRaw) && preg_match('/^APP_KEY=\s*$/m', $envRaw)) {
        try {
            $generatedKey = 'base64:'.base64_encode(random_bytes(32));
            $envRaw = preg_replace('/^APP_KEY=\s*$/m', 'APP_KEY='.$generatedKey, $envRaw, 1);
            @file_put_contents($envFile, $envRaw);
        } catch (\Throwable) {
            // ignore if random_bytes fails
        }
    }
}

if (file_exists($maintenance = $baseDir.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

$autoloader = $baseDir.'/vendor/autoload.php';
if (!file_exists($autoloader)) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Youth IT POS — Setup Required</title>'
        .'<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}'
        .'.card{max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 12px 32px rgba(15,23,42,.08)}'
        .'h1{margin:0 0 8px;font-size:20px}p{margin:0 0 14px;color:#475569;font-size:14px;line-height:1.6}'
        .'pre{background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:10px;font-size:13px;overflow:auto}</style></head>'
        .'<body><div class="card"><h1>Youth IT POS — Laravel Setup (1 Step Remaining)</h1>'
        .'<p>The PHP <code>vendor/</code> folder is not installed yet. Run the command below inside the Laravel project folder, then refresh this page:</p>'
        .'<pre>composer install --no-dev --optimize-autoloader</pre>'
        .'<p>Once complete, refreshing this page will automatically open the browser database installer (<code>/setup</code>).</p>'
        .'</div></body></html>';
    exit;
}

require $autoloader;

$app = require_once $baseDir.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
