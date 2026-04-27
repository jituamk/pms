<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    public const STATUS_PENDING        = 'pending';
    public const STATUS_AUTO_VERIFIED  = 'auto_verified';
    public const STATUS_MANUAL_REVIEW  = 'manual_review';
    public const STATUS_PENDING_INFO   = 'pending_info';
    public const STATUS_VERIFIED       = 'verified';
    public const STATUS_REJECTED       = 'rejected';

    protected $fillable = [
        'invoice_id', 'lease_id', 'tenant_id', 'recorded_by', 'payment_number',
        'amount', 'payment_date', 'method', 'transaction_id', 'sender_phone',
        'account_number', 'cheque_number', 'cheque_date',
        'verification_status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'payment_date' => 'date',
            'cheque_date'  => 'date',
        ];
    }

    public function invoice(): BelongsTo       { return $this->belongsTo(RentInvoice::class, 'invoice_id'); }
    public function lease(): BelongsTo         { return $this->belongsTo(Lease::class); }
    public function tenant(): BelongsTo        { return $this->belongsTo(Tenant::class); }
    public function recordedBy(): BelongsTo    { return $this->belongsTo(User::class, 'recorded_by'); }
    public function proofs(): HasMany          { return $this->hasMany(PaymentProof::class); }
    public function verifications(): HasMany   { return $this->hasMany(PaymentVerification::class); }
}
