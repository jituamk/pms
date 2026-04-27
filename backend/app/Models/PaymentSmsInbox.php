<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentSmsInbox extends Model
{
    protected $table = 'payment_sms_inbox';

    public const STATUSES = ['unparsed', 'unmatched', 'matched', 'ignored'];
    public const PROVIDERS = ['bkash', 'nagad', 'rocket', 'unknown'];

    protected $fillable = [
        'owner_id', 'provider', 'sender', 'raw_body',
        'transaction_id', 'amount', 'counterparty_phone',
        'received_at', 'status', 'matched_payment_id', 'parse_error',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'received_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo   { return $this->belongsTo(User::class, 'owner_id'); }
    public function payment(): BelongsTo { return $this->belongsTo(Payment::class, 'matched_payment_id'); }
}
