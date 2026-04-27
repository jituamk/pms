<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'owner_id', 'user_id', 'full_name', 'phone', 'email',
        'nid_number', 'nid_image_path', 'photo_path',
        'occupation', 'emergency_contact_name', 'emergency_contact_phone',
        'permanent_address', 'family_members_count', 'notes',
    ];

    public function owner(): BelongsTo  { return $this->belongsTo(User::class, 'owner_id'); }
    public function user(): BelongsTo   { return $this->belongsTo(User::class, 'user_id'); }
    public function leases(): HasMany   { return $this->hasMany(Lease::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }

    public function activeLease()
    {
        return $this->hasOne(Lease::class)->where('status', 'active');
    }
}
