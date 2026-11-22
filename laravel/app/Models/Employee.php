<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'employee_id',
        'name',
        'email',
        'phone',
        'address',
        'designation',
        'department',
        'joining_date',
        'salary',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'joining_date' => 'date',
            'salary' => 'decimal:2',
            'status' => 'boolean',
        ];
    }
}
