<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UtilityRate extends Model
{
    public const TYPES = ['electricity', 'water', 'gas', 'service_charge', 'other'];
    public const ALLOCATIONS = ['per_meter', 'shared', 'fixed_flat'];

    protected $fillable = [
        'building_id', 'utility_type', 'label', 'allocation',
        'rate_per_unit', 'flat_fee', 'shared_total',
        'active', 'apply_late_fee', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'rate_per_unit'  => 'decimal:4',
            'flat_fee'       => 'decimal:2',
            'shared_total'   => 'decimal:2',
            'active'         => 'boolean',
            'apply_late_fee' => 'boolean',
        ];
    }

    public function building(): BelongsTo { return $this->belongsTo(Building::class); }
    public function meters(): HasMany     { return $this->hasMany(UtilityMeter::class); }
}
