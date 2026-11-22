<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Damage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'product_id',
        'quantity',
        'reason',
        'loss_amount',
        'damage_date',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'loss_amount' => 'decimal:2',
            'damage_date' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
