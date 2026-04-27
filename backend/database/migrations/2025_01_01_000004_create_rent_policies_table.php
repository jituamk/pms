<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rent_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_default')->default(false);

            $table->unsignedTinyInteger('due_day')->default(5); // day of month
            $table->unsignedSmallInteger('grace_period_days')->default(3);

            // BRD 18.2: 3 late-fee methods
            $table->enum('late_fee_method', ['percentage', 'flat', 'tiered'])->default('percentage');
            $table->decimal('late_fee_percentage', 5, 2)->nullable(); // e.g. 1.00 = 1%/day
            $table->decimal('late_fee_flat_amount', 10, 2)->nullable();
            $table->json('late_fee_tiers')->nullable(); // [{days_min, days_max, fee}]

            // Notice & vacating policy
            $table->unsignedTinyInteger('notice_period_months')->default(1);
            $table->unsignedTinyInteger('minimum_stay_months')->default(6);
            $table->unsignedTinyInteger('advance_rent_months')->default(2);
            $table->boolean('security_deposit_required')->default(true);

            // Main door schedule (BRD 20.5)
            $table->time('main_door_unlock_time')->nullable();
            $table->time('main_door_lock_time')->nullable();
            $table->text('late_access_policy')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_policies');
    }
};
