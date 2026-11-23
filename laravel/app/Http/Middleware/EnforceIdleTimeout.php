<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnforceIdleTimeout
{
    private const IDLE_TIMEOUT_SECONDS = 3600; // 1 continuous hour

    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check()) {
            $lastActivity = (int) $request->session()->get('last_activity_ts', 0);
            if ($lastActivity > 0 && (time() - $lastActivity) >= self::IDLE_TIMEOUT_SECONDS) {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()
                    ->route('login')
                    ->with('status', 'Automatically logged out after 1 hour of inactivity. Please sign in again.');
            }
            $request->session()->put('last_activity_ts', time());
        }

        return $next($request);
    }
}
