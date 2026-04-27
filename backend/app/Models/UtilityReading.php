<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityReading extends Model
{
    protected $fillable = [
        'utility_meter_id', 'reading_month', 'previous_reading', 'current_reading',
        'units_consumed', 'reading_date', 'recorded_by', 'photo_path', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'reading_month'    => 'date',
            'reading_date'     => 'date',
            'previous_reading' => 'decimal:2',
            'current_reading'  => 'decimal:2',
            'units_consumed'   => 'decimal:2',
        ];
    }

    public function meter(): BelongsTo    { return $this->belongsTo(UtilityMeter::class, 'utility_meter_id'); }
    public function recorder(): BelongsTo { return $this->belongsTo(User::class, 'recorded_by'); }
}
