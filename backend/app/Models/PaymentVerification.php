<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PaymentVerification extends Model
{
    protected $fillable = [
        'payment_id', 'verified_by', 'result',
        'sms_match_sender', 'sms_match_amount', 'sms_match_txn_id', 'sms_match_date',
        'match_details', 'reason', 'notes', 'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'sms_match_sender' => 'boolean',
            'sms_match_amount' => 'boolean',
            'sms_match_txn_id' => 'boolean',
            'sms_match_date'   => 'boolean',
            'match_details'    => 'array',
            'verified_at'      => 'datetime',
        ];
    }

    public function payment(): BelongsTo    { return $this->belongsTo(Payment::class); }
    public function verifiedBy(): BelongsTo { return $this->belongsTo(User::class, 'verified_by'); }
}
