<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetInspection extends Model
{
    public const STATUS_DRAFT     = 'draft';
    public const STATUS_FINALIZED = 'finalized';

    protected $fillable = [
        'lease_id', 'flat_id', 'inspector_id', 'status',
        'total_damage_charge', 'deposit_amount', 'deposit_refund',
        'summary_notes', 'inspected_at', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'total_damage_charge' => 'decimal:2',
            'deposit_amount'      => 'decimal:2',
            'deposit_refund'      => 'decimal:2',
            'inspected_at'        => 'datetime',
            'finalized_at'        => 'datetime',
        ];
    }

    public function lease(): BelongsTo     { return $this->belongsTo(Lease::class); }
    public function flat(): BelongsTo      { return $this->belongsTo(Flat::class); }
    public function inspector(): BelongsTo { return $this->belongsTo(User::class, 'inspector_id'); }
    public function items(): HasMany       { return $this->hasMany(AssetInspectionItem::class, 'inspection_id'); }
    public function deductions(): HasMany  { return $this->hasMany(DepositDeduction::class, 'lease_id', 'lease_id'); }

    public function recalcTotals(): void
    {
        $charge = (float) $this->items()->sum('damage_charge');
        $this->total_damage_charge = $charge;
        $this->deposit_refund      = max(0, ((float) $this->deposit_amount) - $charge);
        $this->save();
    }
}
