<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'name',
        'sku',
        'category_id',
        'brand_id',
        'warranty_id',
        'unit_id',
        'purchase_price',
        'selling_price',
        'warranty_months',
        'quantity',
        'stock_quantity',
        'alert_quantity',
        'description',
        'barcode',
        'image',
        'status',
        'warranty',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'quantity' => 'integer',
            'stock_quantity' => 'integer',
            'alert_quantity' => 'integer',
            'warranty_months' => 'integer',
            'status' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function warrantyRecord(): BelongsTo
    {
        return $this->belongsTo(Warranty::class, 'warranty_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
