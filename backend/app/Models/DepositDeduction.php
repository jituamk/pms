<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepositDeduction extends Model
{
    public const REASON_ASSET_DAMAGE  = 'asset_damage';
    public const REASON_ASSET_MISSING = 'asset_missing';
    public const REASON_CLEANING      = 'cleaning';
    public const REASON_UNPAID_RENT   = 'unpaid_rent';
    public const REASON_UTILITIES     = 'utilities';
    public const REASON_OTHER         = 'other';

    protected $fillable = ['lease_id', 'inspection_item_id', 'reason', 'amount', 'description'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function lease(): BelongsTo          { return $this->belongsTo(Lease::class); }
    public function inspectionItem(): BelongsTo { return $this->belongsTo(AssetInspectionItem::class, 'inspection_item_id'); }
}
