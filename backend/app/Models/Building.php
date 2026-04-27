<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Building extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'owner_id', 'name', 'address', 'city', 'area', 'total_floors',
        'latitude', 'longitude', 'image_path', 'status', 'notes', 'billing_due_day',
    ];

    public function owner(): BelongsTo  { return $this->belongsTo(User::class, 'owner_id'); }
    public function floors(): HasMany   { return $this->hasMany(Floor::class); }
    public function flats(): HasMany    { return $this->hasMany(Flat::class); }
    public function utilityRates(): HasMany { return $this->hasMany(UtilityRate::class); }
}
