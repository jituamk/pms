<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Flat extends Model
{
    use SoftDeletes;

    public const STATUS_VACANT     = 'vacant';
    public const STATUS_OCCUPIED   = 'occupied';
    public const STATUS_RESERVED   = 'reserved';
    public const STATUS_RENOVATION = 'under_renovation';

    protected $fillable = [
        'building_id', 'floor_id', 'flat_number', 'bedrooms', 'bathrooms',
        'has_balcony', 'has_kitchen', 'size_sqft', 'base_rent', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'has_balcony' => 'boolean',
            'has_kitchen' => 'boolean',
            'base_rent'   => 'decimal:2',
            'size_sqft'   => 'decimal:2',
        ];
    }

    public function building(): BelongsTo { return $this->belongsTo(Building::class); }
    public function floor(): BelongsTo    { return $this->belongsTo(Floor::class); }
    public function rooms(): HasMany      { return $this->hasMany(Room::class); }
    public function leases(): HasMany     { return $this->hasMany(Lease::class); }
    public function assets(): HasMany     { return $this->hasMany(RoomAsset::class); }
    public function meters(): HasMany     { return $this->hasMany(UtilityMeter::class); }

    public function activeLease()
    {
        return $this->hasOne(Lease::class)->where('status', 'active');
    }
}
