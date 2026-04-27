<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RoomAsset extends Model
{
    use SoftDeletes;

    public const CONDITIONS = ['new', 'good', 'fair', 'poor'];

    protected $fillable = [
        'room_id', 'flat_id', 'asset_category_id',
        'name', 'brand', 'model_no', 'serial_no', 'quantity',
        'condition', 'purchase_price', 'purchased_on',
        'photo_path', 'notes', 'active',
    ];

    protected function casts(): array
    {
        return [
            'quantity'       => 'integer',
            'purchase_price' => 'decimal:2',
            'purchased_on'   => 'date',
            'active'         => 'boolean',
        ];
    }

    public function room(): BelongsTo     { return $this->belongsTo(Room::class); }
    public function flat(): BelongsTo     { return $this->belongsTo(Flat::class); }
    public function category(): BelongsTo { return $this->belongsTo(AssetCategory::class, 'asset_category_id'); }
}
