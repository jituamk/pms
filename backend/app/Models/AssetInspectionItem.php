<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetInspectionItem extends Model
{
    protected $fillable = [
        'inspection_id', 'room_asset_id', 'room_id', 'asset_category_id',
        'asset_name_snapshot', 'move_in_condition', 'exit_condition',
        'is_damaged', 'damage_charge', 'photo_path', 'inspector_note',
    ];

    protected function casts(): array
    {
        return [
            'is_damaged'    => 'boolean',
            'damage_charge' => 'decimal:2',
        ];
    }

    public function inspection(): BelongsTo { return $this->belongsTo(AssetInspection::class, 'inspection_id'); }
    public function asset(): BelongsTo      { return $this->belongsTo(RoomAsset::class, 'room_asset_id'); }
    public function room(): BelongsTo       { return $this->belongsTo(Room::class); }
    public function category(): BelongsTo   { return $this->belongsTo(AssetCategory::class, 'asset_category_id'); }
}
