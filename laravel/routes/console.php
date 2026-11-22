<?php

use Illuminate\Support\Facades\Schedule;

// Artisan commands in app/Console/Commands are auto-discovered in Laravel 13.
Schedule::command('cache:prune-stale-tags')->hourly();
