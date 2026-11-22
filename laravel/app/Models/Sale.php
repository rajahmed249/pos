<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'invoice_no',
        'customer_id',
        'customer_name',
        'date',
        'discount',
        'receivable',
        'paid',
        'due',
        'purchase_cost',
        'profit',
        'status',
        'sale_date',
        'subtotal',
        'account_id',
        'account_name',
        'payment_status',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'sale_date' => 'datetime',
            'discount' => 'decimal:2',
            'receivable' => 'decimal:2',
            'paid' => 'decimal:2',
            'due' => 'decimal:2',
            'purchase_cost' => 'decimal:2',
            'profit' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'account_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
