<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class Menu extends Model
{
    protected $fillable = [
        'parent_id',
        'title',
        'group_label',
        'route_name',
        'url',
        'icon',
        'sort_order',
        'roles',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('app_sidebar_menus'));
        static::deleted(fn () => Cache::forget('app_sidebar_menus'));
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Menu::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Menu::class, 'parent_id')->orderBy('sort_order');
    }

    public function resolvedUrl(): string
    {
        if ($this->route_name && app('router')->has($this->route_name)) {
            return route($this->route_name);
        }

        return url($this->url ?: '/');
    }

    public function isVisibleTo(?string $role): bool
    {
        if (!$this->is_active) {
            return false;
        }
        if ($role === 'super_admin') {
            return true;
        }
        $allowed = $this->roles ?? [];
        if (empty($allowed)) {
            return true;
        }

        return $role !== null && in_array($role, $allowed, true);
    }
}
