<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('owner_transactions')) {
            Schema::create('owner_transactions', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('owner_id')->constrained('owners')->cascadeOnDelete();
                $table->enum('type', ['invest', 'withdraw'])->default('invest');
                $table->decimal('amount', 15, 2)->default(0);
                $table->text('note')->nullable();
                $table->date('transaction_date');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_transactions');
    }
};
