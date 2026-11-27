<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Owner extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'share_percent',
        'invested',
        'withdrawn',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'decimal:2',
            'invested' => 'decimal:2',
            'withdrawn' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(OwnerTransaction::class)->orderByDesc('transaction_date')->orderByDesc('id');
    }

    public function getBalanceAttribute(): float
    {
        return round((float) ($this->invested ?? 0) - (float) ($this->withdrawn ?? 0), 2);
    }
}
