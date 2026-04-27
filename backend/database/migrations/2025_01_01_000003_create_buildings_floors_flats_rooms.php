<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('address');
            $table->string('city')->default('Dhaka');
            $table->string('area')->nullable();
            $table->unsignedSmallInteger('total_floors')->default(1);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('image_path')->nullable();
            $table->enum('status', ['active', 'under_renovation', 'inactive'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_id', 'status']);
        });

        Schema::create('floors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->string('name'); // e.g. "Ground", "1st", "2nd"
            $table->unsignedSmallInteger('level')->default(0);
            $table->timestamps();

            $table->unique(['building_id', 'level']);
        });

        Schema::create('flats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->foreignId('floor_id')->constrained()->cascadeOnDelete();
            $table->string('flat_number'); // e.g. "1A", "2B"
            $table->unsignedTinyInteger('bedrooms')->default(1);
            $table->unsignedTinyInteger('bathrooms')->default(1);
            $table->boolean('has_balcony')->default(false);
            $table->boolean('has_kitchen')->default(true);
            $table->decimal('size_sqft', 8, 2)->nullable();
            $table->decimal('base_rent', 12, 2)->default(0);
            $table->enum('status', ['vacant', 'occupied', 'reserved', 'under_renovation'])->default('vacant');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['building_id', 'flat_number']);
            $table->index('status');
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->string('name'); // e.g. "Master Bedroom", "Living Room", "Kitchen"
            $table->enum('type', [
                'bedroom', 'living', 'dining', 'kitchen', 'bathroom', 'balcony', 'storage', 'other',
            ]);
            $table->decimal('size_sqft', 8, 2)->nullable();
            $table->timestamps();

            $table->index(['flat_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('flats');
        Schema::dropIfExists('floors');
        Schema::dropIfExists('buildings');
    }
};
