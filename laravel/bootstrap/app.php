<?php

use App\Http\Middleware\EnforceIdleTimeout;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\RedirectIfSetupRequired;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        // Full CSRF protection enabled on all web forms (use @csrf in Blade)
        $middleware->web(append: [
            RedirectIfSetupRequired::class,
            EnforceIdleTimeout::class,
        ]);
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $e, Request $request) {
            $host = strtolower((string) $request->getHost());
            $isLocalLoopback = in_array($host, ['127.0.0.1', 'localhost', '::1'], true)
                || in_array((string) $request->ip(), ['127.0.0.1', '::1'], true);

            // Never expose internal exception details to public traffic or when APP_DEBUG handles it
            if (!$isLocalLoopback || config('app.debug')) {
                return null;
            }

            if ($e instanceof \Illuminate\Validation\ValidationException
                || $e instanceof \Illuminate\Auth\AuthenticationException
                || $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                return null;
            }

            $msg = htmlspecialchars($e->getMessage() ?: get_class($e), ENT_QUOTES, 'UTF-8');
            $cls = htmlspecialchars(class_basename($e), ENT_QUOTES, 'UTF-8');
            $loc = htmlspecialchars(basename($e->getFile()).':'.$e->getLine(), ENT_QUOTES, 'UTF-8');
            $setupUrl = htmlspecialchars(url('/setup'), ENT_QUOTES, 'UTF-8');
            $homeUrl = htmlspecialchars(url('/'), ENT_QUOTES, 'UTF-8');

            return response(
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                .'<title>Local Diagnostic — Youth IT POS</title>'
                .'<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}'
                .'.card{max-width:600px;width:100%;background:#fff;border:1px solid #fecaca;border-radius:16px;padding:24px;box-shadow:0 16px 36px rgba(15,23,42,.08)}'
                .'h1{margin:0 0 8px;font-size:18px;color:#b91c1c}p{margin:0 0 12px;font-size:13.5px;color:#475569;line-height:1.55}'
                .'.box{background:#0f172a;color:#f8fafc;padding:12px 14px;border-radius:10px;font-family:ui-monospace,monospace;font-size:12.5px;word-break:break-word;margin-bottom:14px}'
                .'.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{display:inline-block;padding:9px 14px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600}'
                .'.btn-p{background:#4f46e5;color:#fff}.btn-s{background:#e2e8f0;color:#1e293b}</style></head>'
                .'<body><div class="card"><h1>Local Runtime Notice ('.$cls.')</h1>'
                .'<p>Detected an error while running locally (see <code>storage/logs/laravel.log</code> for details):</p>'
                .'<div class="box">'.$msg.'<br><span style="color:#94a3b8">at '.$loc.'</span></div>'
                .'<div class="actions"><a class="btn btn-p" href="'.$setupUrl.'">Open Setup / Repair DB</a>'
                .'<a class="btn btn-s" href="'.$homeUrl.'">Retry Dashboard</a></div></div></body></html>',
                500
            );
        });
    })->create();
