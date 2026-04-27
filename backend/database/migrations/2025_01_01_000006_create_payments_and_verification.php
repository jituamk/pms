<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rent_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->date('billing_month');     // first day of the month it covers
            $table->date('due_date');
            $table->decimal('rent_amount', 12, 2);
            $table->decimal('utility_amount', 12, 2)->default(0);
            $table->decimal('service_amount', 12, 2)->default(0);
            $table->decimal('late_fee', 12, 2)->default(0);
            $table->decimal('adjustments', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('balance_amount', 12, 2);
            $table->enum('status', ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'])->default('unpaid');
            $table->json('breakdown')->nullable(); // detailed line items
            $table->timestamps();

            $table->unique(['lease_id', 'billing_month']);
            $table->index('status');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->nullable()->constrained('rent_invoices')->nullOnDelete();
            $table->foreignId('lease_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('payment_number')->unique();
            $table->decimal('amount', 12, 2);
            $table->date('payment_date');
            $table->enum('method', ['cash', 'bank_transfer', 'bkash', 'rocket', 'nagad', 'cheque', 'other']);
            $table->string('transaction_id')->nullable();
            $table->string('sender_phone', 20)->nullable();   // for MFS
            $table->string('account_number')->nullable();      // for bank
            $table->string('cheque_number')->nullable();
            $table->date('cheque_date')->nullable();

            $table->enum('verification_status', [
                'pending', 'auto_verified', 'manual_review', 'pending_info', 'verified', 'rejected',
            ])->default('pending');

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['lease_id', 'payment_date']);
            $table->index('verification_status');
        });

        Schema::create('payment_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->string('file_path');
            $table->string('original_name')->nullable();
            $table->string('mime_type', 50)->nullable();
            $table->unsignedInteger('size_bytes')->nullable();
            $table->string('image_hash', 64)->nullable()->index();  // dup detection (BRD 19.5.3)
            $table->timestamps();
        });

        Schema::create('payment_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('result', [
                'auto_verified', 'manual_review', 'pending_info', 'verified', 'rejected',
            ]);
            $table->boolean('sms_match_sender')->nullable();
            $table->boolean('sms_match_amount')->nullable();
            $table->boolean('sms_match_txn_id')->nullable();
            $table->boolean('sms_match_date')->nullable();
            $table->json('match_details')->nullable();
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('fraud_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->enum('type', [
                'duplicate_proof', 'fake_txn_id', 'amount_mismatch',
                'date_mismatch', 'sender_mismatch', 'other',
            ]);
            $table->text('description');
            $table->enum('status', ['open', 'investigating', 'resolved', 'dismissed'])->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fraud_incidents');
        Schema::dropIfExists('payment_verifications');
        Schema::dropIfExists('payment_proofs');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('rent_invoices');
    }
};
