<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_no', 50)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->date('date')->index();
            $table->decimal('discount', 12, 2)->default(0.00);
            $table->decimal('receivable', 12, 2);
            $table->decimal('paid', 12, 2)->default(0.00);
            $table->decimal('due', 12, 2)->default(0.00);
            $table->decimal('purchase_cost', 12, 2)->default(0.00);
            $table->decimal('profit', 12, 2)->default(0.00);
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('completed');
            $table->dateTime('sale_date')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0.00);
            $table->foreignId('account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
            $table->string('account_name', 100)->nullable();
            $table->string('payment_status', 20)->default('paid');
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('product_name');
            $table->string('category_name', 100)->nullable();
            $table->integer('quantity');
            $table->decimal('price', 12, 2);
            $table->decimal('total', 12, 2);
            $table->decimal('purchase_cost', 12, 2)->default(0.00);
            $table->string('serial_no', 100)->nullable();
            $table->string('warranty', 100)->nullable();
            $table->decimal('buying_price', 12, 2)->default(0.00);
            $table->foreignId('warranty_id')->nullable()->constrained('warranties')->nullOnDelete();
            $table->string('warranty_name', 100)->nullable();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->dateTime('payment_date');
            $table->string('payment_method', 50)->default('cash');
            $table->string('reference_no', 100)->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('estimates', function (Blueprint $table) {
            $table->id();
            $table->string('estimate_no', 50)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone', 20)->nullable();
            $table->string('customer_email')->nullable();
            $table->text('customer_address')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0.00);
            $table->decimal('discount', 12, 2)->default(0.00);
            $table->enum('discount_type', ['fixed', 'percentage'])->default('fixed');
            $table->decimal('tax', 12, 2)->default(0.00);
            $table->decimal('tax_rate', 5, 2)->default(0.00);
            $table->decimal('total', 12, 2)->default(0.00);
            $table->enum('status', ['pending', 'approved', 'rejected', 'expired'])->default('pending');
            $table->date('valid_until')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('estimate_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estimate_id')->constrained('estimates')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('product_name')->nullable();
            $table->integer('quantity');
            $table->decimal('price', 12, 2);
            $table->decimal('total', 12, 2);
        });

        Schema::create('returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('invoice_no', 50)->nullable();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->integer('quantity');
            $table->decimal('price', 12, 2);
            $table->decimal('total_amount', 12, 2);
            $table->text('reason')->nullable();
            $table->date('return_date');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
        });

        Schema::create('damages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity');
            $table->text('reason')->nullable();
            $table->decimal('loss_amount', 12, 2);
            $table->date('damage_date');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('damages');
        Schema::dropIfExists('returns');
        Schema::dropIfExists('estimate_items');
        Schema::dropIfExists('estimates');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
