<?php

namespace App\Http\Middleware;

use App\Http\Controllers\SetupController;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfSetupRequired
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('setup', 'setup/*', 'up')) {
            return $next($request);
        }

        try {
            DB::connection()->getPdo();
            $hasUsersTable = Schema::hasTable('users');
            if (!$hasUsersTable || !SetupController::hasConfiguredLoginUser()) {
                return redirect()->route('setup.index');
            }
            if (!Schema::hasTable('sales') || !Schema::hasTable('bank_accounts') || !Schema::hasTable('settings') || !Schema::hasTable('menus')) {
                SetupController::ensureMissingTables();
            }
        } catch (\Throwable) {
            if (!SetupController::isSetupComplete()) {
                return redirect()->route('setup.index');
            }
        }

        return $next($request);
    }
}
