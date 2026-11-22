<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['name', 'description', 'status'];

    protected function casts(): array
    {
        return ['status' => 'boolean'];
    }
}
