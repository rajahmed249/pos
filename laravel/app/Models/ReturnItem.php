<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnItem extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'returns';

    protected $fillable = [
        'sale_id',
        'invoice_no',
        'customer_id',
        'product_id',
        'quantity',
        'price',
        'total_amount',
        'reason',
        'return_date',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'return_date' => 'date',
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

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
