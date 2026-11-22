<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    public const CREATED_AT = null;

    protected $fillable = ['key_name', 'value'];

    public static function allKeyed(): array
    {
        return Cache::remember('app_settings_map', 300, function (): array {
            return static::query()->pluck('value', 'key_name')->toArray();
        });
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key_name' => $key],
            ['value' => $value ?? '']
        );
        Cache::forget('app_settings_map');
    }
}
