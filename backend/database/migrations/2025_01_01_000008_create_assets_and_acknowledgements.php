<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Master list of asset categories (seeded). Owners CANNOT add new categories
        // — keeps reporting consistent. Items inside a category are free-form.
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();           // e.g. furniture, electronics
            $table->string('label');                   // human label
            $table->string('icon')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Per-room asset inventory. Owner/Delegate manages.
        Schema::create('room_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();             // denormalized for tenant queries
            $table->foreignId('asset_category_id')->constrained('asset_categories');
            $table->string('name');                                                      // e.g. "Almirah", "Split AC 1.5T"
            $table->string('brand')->nullable();
            $table->string('model_no')->nullable();
            $table->string('serial_no')->nullable();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->enum('condition', ['new', 'good', 'fair', 'poor'])->default('good'); // owner-declared
            $table->decimal('purchase_price', 12, 2)->nullable();
            $table->date('purchased_on')->nullable();
            $table->string('photo_path')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['flat_id', 'asset_category_id']);
            $table->index(['room_id', 'active']);
        });

        // Acknowledgement bundle generated when a lease activates.
        // One bundle per lease — locks asset list snapshot at that moment.
        Schema::create('asset_acknowledgements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['pending', 'partial', 'acknowledged', 'disputed'])->default('pending');
            $table->timestamp('issued_at')->useCurrent();
            $table->timestamp('acknowledged_at')->nullable();
            $table->text('tenant_notes')->nullable();
            $table->timestamps();

            $table->unique('lease_id');
            $table->index(['tenant_id', 'status']);
        });

        // Each asset's line in the acknowledgement bundle.
        // Tenant ticks present + writes condition note (per locked decision: checkbox + condition note only).
        Schema::create('asset_acknowledgement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('acknowledgement_id')->constrained('asset_acknowledgements')->cascadeOnDelete();
            $table->foreignId('room_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();             // snapshot
            $table->foreignId('asset_category_id')->constrained('asset_categories');    // snapshot
            $table->string('asset_name_snapshot');                                       // immutable name at issue time
            $table->unsignedSmallInteger('quantity_snapshot')->default(1);
            $table->enum('owner_condition_snapshot', ['new', 'good', 'fair', 'poor']);
            $table->boolean('is_present')->nullable();                                   // null = not yet ticked
            $table->enum('tenant_condition', ['new', 'good', 'fair', 'poor', 'damaged', 'missing'])->nullable();
            $table->text('tenant_note')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();

            $table->unique(['acknowledgement_id', 'room_asset_id']);
            $table->index('room_asset_id');
        });

        // Exit inspection at lease termination — owner or delegate fills.
        Schema::create('asset_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inspector_id')->constrained('users');                    // owner or delegate
            $table->enum('status', ['draft', 'finalized'])->default('draft');
            $table->decimal('total_damage_charge', 14, 2)->default(0);
            $table->decimal('deposit_amount', 14, 2)->default(0);
            $table->decimal('deposit_refund', 14, 2)->default(0);
            $table->text('summary_notes')->nullable();
            $table->timestamp('inspected_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->unique('lease_id');
        });

        // Per-asset inspection result + damage charge.
        Schema::create('asset_inspection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('asset_inspections')->cascadeOnDelete();
            $table->foreignId('room_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_category_id')->constrained('asset_categories');
            $table->string('asset_name_snapshot');
            $table->enum('move_in_condition', ['new', 'good', 'fair', 'poor'])->nullable();
            $table->enum('exit_condition', ['good', 'fair', 'poor', 'damaged', 'missing']);
            $table->boolean('is_damaged')->default(false);
            $table->decimal('damage_charge', 12, 2)->default(0);
            $table->string('photo_path')->nullable();
            $table->text('inspector_note')->nullable();
            $table->timestamps();

            $table->unique(['inspection_id', 'room_asset_id']);
        });

        // Deposit ledger — line per damage deduction.
        Schema::create('deposit_deductions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inspection_item_id')->nullable()->constrained('asset_inspection_items')->nullOnDelete();
            $table->enum('reason', ['asset_damage', 'asset_missing', 'cleaning', 'unpaid_rent', 'utilities', 'other']);
            $table->decimal('amount', 12, 2);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index('lease_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposit_deductions');
        Schema::dropIfExists('asset_inspection_items');
        Schema::dropIfExists('asset_inspections');
        Schema::dropIfExists('asset_acknowledgement_items');
        Schema::dropIfExists('asset_acknowledgements');
        Schema::dropIfExists('room_assets');
        Schema::dropIfExists('asset_categories');
    }
};
