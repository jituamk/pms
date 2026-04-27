<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class RentPolicy extends Model
{
    public const METHOD_PERCENTAGE = 'percentage';
    public const METHOD_FLAT       = 'flat';
    public const METHOD_TIERED     = 'tiered';

    protected $fillable = [
        'owner_id', 'name', 'is_default',
        'due_day', 'grace_period_days',
        'late_fee_method', 'late_fee_percentage', 'late_fee_flat_amount', 'late_fee_tiers',
        'notice_period_months', 'minimum_stay_months', 'advance_rent_months', 'security_deposit_required',
        'main_door_unlock_time', 'main_door_lock_time', 'late_access_policy', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_default'                => 'boolean',
            'security_deposit_required' => 'boolean',
            'late_fee_tiers'            => 'array',
            'late_fee_percentage'       => 'decimal:2',
            'late_fee_flat_amount'      => 'decimal:2',
        ];
    }

    public function owner(): BelongsTo  { return $this->belongsTo(User::class, 'owner_id'); }
    public function leases(): HasMany   { return $this->hasMany(Lease::class); }

    /**
     * Calculate late fee per BRD 18.2 — three methods.
     */
    public function calculateLateFee(float $rentAmount, int $daysLate): float
    {
        if ($daysLate <= 0) return 0.0;

        switch ($this->late_fee_method) {
            case self::METHOD_PERCENTAGE:
                $rate = (float) ($this->late_fee_percentage ?? 0) / 100;
                return round($rentAmount * $rate * $daysLate, 2);

            case self::METHOD_FLAT:
                return (float) ($this->late_fee_flat_amount ?? 0);

            case self::METHOD_TIERED:
                $tiers = $this->late_fee_tiers ?? [];
                foreach ($tiers as $tier) {
                    $min = $tier['days_min'] ?? 0;
                    $max = $tier['days_max'] ?? PHP_INT_MAX;
                    if ($daysLate >= $min && $daysLate <= $max) {
                        return (float) ($tier['fee'] ?? 0);
                    }
                }
                return 0.0;
        }

        return 0.0;
    }
}
