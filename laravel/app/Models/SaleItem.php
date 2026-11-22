<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'product_id',
        'sale_id',
        'product_name',
        'category_name',
        'quantity',
        'price',
        'total',
        'purchase_cost',
        'serial_no',
        'warranty',
        'buying_price',
        'warranty_id',
        'warranty_name',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'total' => 'decimal:2',
            'purchase_cost' => 'decimal:2',
            'buying_price' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
