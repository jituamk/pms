<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lease extends Model
{
    use SoftDeletes;

    public const STATUS_ACTIVE         = 'active';
    public const STATUS_NOTICE_PERIOD  = 'notice_period';
    public const STATUS_VACATED        = 'vacated';
    public const STATUS_TERMINATED     = 'terminated';

    protected $fillable = [
        'owner_id', 'tenant_id', 'flat_id', 'rent_policy_id',
        'start_date', 'end_date', 'actual_end_date',
        'monthly_rent', 'security_deposit', 'advance_rent',
        'status', 'notice_date', 'vacating_date', 'notice_reason', 'notice_initiated_by',
        'signed_lease_pdf_path', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'start_date'       => 'date',
            'end_date'         => 'date',
            'actual_end_date'  => 'date',
            'notice_date'      => 'date',
            'vacating_date'    => 'date',
            'monthly_rent'     => 'decimal:2',
            'security_deposit' => 'decimal:2',
            'advance_rent'     => 'decimal:2',
        ];
    }

    public function owner(): BelongsTo       { return $this->belongsTo(User::class, 'owner_id'); }
    public function tenant(): BelongsTo      { return $this->belongsTo(Tenant::class); }
    public function flat(): BelongsTo        { return $this->belongsTo(Flat::class); }
    public function rentPolicy(): BelongsTo  { return $this->belongsTo(RentPolicy::class); }
    public function invoices(): HasMany      { return $this->hasMany(RentInvoice::class); }
    public function payments(): HasMany      { return $this->hasMany(Payment::class); }
    public function acknowledgement(): HasOne { return $this->hasOne(AssetAcknowledgement::class); }
    public function inspection(): HasOne     { return $this->hasOne(AssetInspection::class); }
    public function depositDeductions(): HasMany { return $this->hasMany(DepositDeduction::class); }
}
