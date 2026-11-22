<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable()->index();
            $table->text('address')->nullable();
            $table->string('city', 50)->nullable();
            $table->string('state', 50)->nullable();
            $table->string('zip_code', 20)->nullable();
            $table->decimal('opening_balance', 12, 2)->default(0.00);
            $table->boolean('status')->default(true);
            $table->decimal('points', 10, 2)->default(0.00);
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable()->index();
            $table->text('address')->nullable();
            $table->string('city', 50)->nullable();
            $table->string('state', 50)->nullable();
            $table->string('zip_code', 20)->nullable();
            $table->decimal('opening_balance', 12, 2)->default(0.00);
            $table->boolean('status')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id', 50)->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->text('address')->nullable();
            $table->string('designation', 100)->nullable();
            $table->string('department', 100)->nullable();
            $table->date('joining_date')->nullable();
            $table->decimal('salary', 12, 2)->default(0.00);
            $table->boolean('status')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('owners', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->decimal('share_percent', 5, 2)->default(0.00);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owners');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('customers');
    }
};
