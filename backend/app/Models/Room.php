<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = ['flat_id', 'name', 'type', 'size_sqft'];

    public function flat(): BelongsTo  { return $this->belongsTo(Flat::class); }
    public function assets(): HasMany  { return $this->hasMany(RoomAsset::class); }
}
