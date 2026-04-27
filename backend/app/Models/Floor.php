<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Floor extends Model
{
    protected $fillable = ['building_id', 'name', 'level'];

    public function building(): BelongsTo { return $this->belongsTo(Building::class); }
    public function flats(): HasMany      { return $this->hasMany(Flat::class); }
}
