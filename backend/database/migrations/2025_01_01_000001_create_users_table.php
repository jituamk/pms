<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 20)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('phone_verified_at')->nullable();
            $table->string('password');

            // Roles per BRD section 11
            $table->enum('role', [
                'super_admin', 'owner', 'delegate', 'caretaker', 'accountant', 'tenant',
            ])->index();

            // Owner relationship (everyone except owners and super_admins are created by an owner)
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();

            // Delegate scope (BRD 8.2.3): full / partial / task_specific
            $table->enum('delegate_scope', ['full', 'partial', 'task_specific'])->nullable();
            $table->json('delegate_permissions')->nullable();

            // National ID (BRD: owner signup requires NID upload)
            $table->string('nid_number', 30)->nullable();
            $table->string('nid_image_path')->nullable();

            $table->string('avatar_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();

            // FCM token for push notifications
            $table->string('fcm_token')->nullable();

            // Notification prefs (BRD 8.27)
            $table->json('notification_prefs')->nullable();

            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['role', 'owner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
