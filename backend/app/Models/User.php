<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const ROLE_SUPER_ADMIN = 'super_admin';
    public const ROLE_OWNER       = 'owner';
    public const ROLE_DELEGATE    = 'delegate';
    public const ROLE_CARETAKER   = 'caretaker';
    public const ROLE_ACCOUNTANT  = 'accountant';
    public const ROLE_TENANT      = 'tenant';

    protected $fillable = [
        'name', 'email', 'phone', 'password', 'role', 'owner_id',
        'delegate_scope', 'delegate_permissions',
        'nid_number', 'nid_image_path', 'avatar_path',
        'is_active', 'last_login_at', 'fcm_token', 'notification_prefs',
        'phone_verified_at', 'email_verified_at',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'    => 'datetime',
            'phone_verified_at'    => 'datetime',
            'last_login_at'        => 'datetime',
            'password'             => 'hashed',
            'delegate_permissions' => 'array',
            'notification_prefs'   => 'array',
            'is_active'            => 'boolean',
        ];
    }

    public function isOwner(): bool       { return $this->role === self::ROLE_OWNER; }
    public function isSuperAdmin(): bool  { return $this->role === self::ROLE_SUPER_ADMIN; }
    public function isDelegate(): bool    { return $this->role === self::ROLE_DELEGATE; }
    public function isCaretaker(): bool   { return $this->role === self::ROLE_CARETAKER; }
    public function isAccountant(): bool  { return $this->role === self::ROLE_ACCOUNTANT; }
    public function isTenant(): bool      { return $this->role === self::ROLE_TENANT; }

    public function ownerScope(): ?int
    {
        return $this->isOwner() ? $this->id : $this->owner_id;
    }

    public function buildings(): HasMany
    {
        return $this->hasMany(Building::class, 'owner_id');
    }

    public function rentPolicies(): HasMany
    {
        return $this->hasMany(RentPolicy::class, 'owner_id');
    }

    public function tenantsManaged(): HasMany
    {
        return $this->hasMany(Tenant::class, 'owner_id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(self::class, 'owner_id');
    }

    public function tenantProfile()
    {
        return $this->hasOne(Tenant::class, 'user_id');
    }
}
