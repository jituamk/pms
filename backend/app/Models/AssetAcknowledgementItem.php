<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAcknowledgementItem extends Model
{
    protected $fillable = [
        'acknowledgement_id', 'room_asset_id', 'room_id', 'asset_category_id',
        'asset_name_snapshot', 'quantity_snapshot', 'owner_condition_snapshot',
        'is_present', 'tenant_condition', 'tenant_note', 'acknowledged_at',
    ];

    protected function casts(): array
    {
        return [
            'is_present'      => 'boolean',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function acknowledgement(): BelongsTo { return $this->belongsTo(AssetAcknowledgement::class, 'acknowledgement_id'); }
    public function asset(): BelongsTo           { return $this->belongsTo(RoomAsset::class, 'room_asset_id'); }
    public function room(): BelongsTo            { return $this->belongsTo(Room::class); }
    public function category(): BelongsTo        { return $this->belongsTo(AssetCategory::class, 'asset_category_id'); }
}
