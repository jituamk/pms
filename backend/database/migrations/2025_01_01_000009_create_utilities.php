<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Per-building config for each utility type. One row per building+type.
        Schema::create('utility_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->enum('utility_type', ['electricity', 'water', 'gas', 'service_charge', 'other']);
            $table->string('label')->nullable();           // e.g. "WASA", "Lift maintenance"

            // Allocation method (mostly meaningful for electricity, but available to all types)
            //   per_meter:  multiply (current - previous) reading by rate_per_unit
            //   shared:     sum total_amount_each_month / occupied_flats
            //   fixed_flat: charge a flat fee per flat each month
            $table->enum('allocation', ['per_meter', 'shared', 'fixed_flat'])->default('fixed_flat');

            $table->decimal('rate_per_unit', 10, 4)->default(0);   // BDT per unit (kWh, gallon, etc.)
            $table->decimal('flat_fee', 12, 2)->default(0);        // when allocation = fixed_flat
            $table->decimal('shared_total', 12, 2)->default(0);    // when allocation = shared (current month bill)
            $table->boolean('active')->default(true);
            $table->boolean('apply_late_fee')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['building_id', 'utility_type', 'label']);
        });

        // One physical or virtual meter per flat per utility (only for per_meter allocation).
        Schema::create('utility_meters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('utility_rate_id')->constrained('utility_rates')->cascadeOnDelete();
            $table->string('meter_number')->nullable();
            $table->decimal('opening_reading', 12, 2)->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['flat_id', 'utility_rate_id']);
        });

        // Monthly readings (for per_meter allocation). One per meter per month.
        Schema::create('utility_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utility_meter_id')->constrained()->cascadeOnDelete();
            $table->date('reading_month');                 // first day of month
            $table->decimal('previous_reading', 12, 2);
            $table->decimal('current_reading', 12, 2);
            $table->decimal('units_consumed', 12, 2);      // current - previous
            $table->date('reading_date');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('photo_path')->nullable();      // meter photo proof
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['utility_meter_id', 'reading_month']);
        });

        // Unified monthly bill = rent + every utility line + late fee, per lease.
        // We keep rent_invoices as-is (stores totals); this stores granular lines.
        Schema::create('utility_bill_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('rent_invoices')->cascadeOnDelete();
            $table->foreignId('utility_rate_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('utility_reading_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('line_type', ['rent', 'electricity', 'water', 'gas', 'service_charge', 'other', 'late_fee', 'adjustment']);
            $table->string('label');                       // e.g. "Electricity (April 2026)"
            $table->decimal('quantity', 12, 4)->nullable();
            $table->decimal('rate', 10, 4)->nullable();
            $table->decimal('amount', 12, 2);
            $table->json('meta')->nullable();              // reading details, allocation details
            $table->timestamps();

            $table->index(['invoice_id', 'line_type']);
        });

        // Inbound SMS staging for bKash/Nagad/Rocket auto-verification.
        Schema::create('payment_sms_inbox', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();   // owner of building, scopes the SMS
            $table->enum('provider', ['bkash', 'nagad', 'rocket', 'unknown']);
            $table->string('sender')->nullable();          // e.g. "16216", phone, etc.
            $table->text('raw_body');
            $table->string('transaction_id')->nullable();  // parsed
            $table->decimal('amount', 12, 2)->nullable();
            $table->string('counterparty_phone', 20)->nullable();
            $table->dateTime('received_at');
            $table->enum('status', ['unparsed', 'unmatched', 'matched', 'ignored'])->default('unparsed');
            $table->foreignId('matched_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->text('parse_error')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'status']);
            $table->index('transaction_id');
        });

        // Add utility allocation default + month start day to buildings (used by generator)
        Schema::table('buildings', function (Blueprint $table) {
            $table->unsignedTinyInteger('billing_due_day')->default(5)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('buildings', function (Blueprint $table) {
            $table->dropColumn('billing_due_day');
        });
        Schema::dropIfExists('payment_sms_inbox');
        Schema::dropIfExists('utility_bill_lines');
        Schema::dropIfExists('utility_readings');
        Schema::dropIfExists('utility_meters');
        Schema::dropIfExists('utility_rates');
    }
};
