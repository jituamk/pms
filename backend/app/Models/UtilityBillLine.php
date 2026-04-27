<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityBillLine extends Model
{
    public const LINE_TYPES = ['rent', 'electricity', 'water', 'gas', 'service_charge', 'other', 'late_fee', 'adjustment'];

    protected $fillable = [
        'invoice_id', 'utility_rate_id', 'utility_reading_id',
        'line_type', 'label', 'quantity', 'rate', 'amount', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'rate'     => 'decimal:4',
            'amount'   => 'decimal:2',
            'meta'     => 'array',
        ];
    }

    public function invoice(): BelongsTo { return $this->belongsTo(RentInvoice::class, 'invoice_id'); }
    public function rate(): BelongsTo    { return $this->belongsTo(UtilityRate::class, 'utility_rate_id'); }
    public function reading(): BelongsTo { return $this->belongsTo(UtilityReading::class, 'utility_reading_id'); }
}
