<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetAcknowledgement extends Model
{
    public const STATUS_PENDING       = 'pending';
    public const STATUS_PARTIAL       = 'partial';
    public const STATUS_ACKNOWLEDGED  = 'acknowledged';
    public const STATUS_DISPUTED      = 'disputed';

    protected $fillable = [
        'lease_id', 'tenant_id', 'flat_id',
        'status', 'issued_at', 'acknowledged_at', 'tenant_notes',
    ];

    protected function casts(): array
    {
        return [
            'issued_at'       => 'datetime',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function lease(): BelongsTo  { return $this->belongsTo(Lease::class); }
    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function flat(): BelongsTo   { return $this->belongsTo(Flat::class); }
    public function items(): HasMany    { return $this->hasMany(AssetAcknowledgementItem::class, 'acknowledgement_id'); }

    /**
     * Compute and store the latest status based on tracked items.
     * partial = some ticked, acknowledged = all ticked, disputed = any missing/damaged.
     */
    public function recalcStatus(): void
    {
        $items = $this->items;
        $total = $items->count();
        $done  = $items->whereNotNull('is_present')->count();

        $hasIssue = $items->whereIn('tenant_condition', ['damaged', 'missing'])->count() > 0;

        if ($done === 0)               $this->status = self::STATUS_PENDING;
        elseif ($done < $total)        $this->status = self::STATUS_PARTIAL;
        else {
            $this->status          = $hasIssue ? self::STATUS_DISPUTED : self::STATUS_ACKNOWLEDGED;
            $this->acknowledged_at = $this->acknowledged_at ?? now();
        }
        $this->save();
    }
}
