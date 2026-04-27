<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UtilityMeter extends Model
{
    protected $fillable = ['flat_id', 'utility_rate_id', 'meter_number', 'opening_reading', 'active'];

    protected function casts(): array
    {
        return [
            'opening_reading' => 'decimal:2',
            'active'          => 'boolean',
        ];
    }

    public function flat(): BelongsTo     { return $this->belongsTo(Flat::class); }
    public function rate(): BelongsTo     { return $this->belongsTo(UtilityRate::class, 'utility_rate_id'); }
    public function readings(): HasMany   { return $this->hasMany(UtilityReading::class); }

    public function latestReading(): ?UtilityReading
    {
        return $this->readings()->orderByDesc('reading_month')->first();
    }
}
