<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Owner extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'share_percent',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'share_percent' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
