<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class RentInvoice extends Model
{
    protected $fillable = [
        'lease_id', 'tenant_id', 'invoice_number', 'billing_month', 'due_date',
        'rent_amount', 'utility_amount', 'service_amount', 'late_fee', 'adjustments',
        'total_amount', 'paid_amount', 'balance_amount', 'status', 'breakdown',
    ];

    protected function casts(): array
    {
        return [
            'billing_month'  => 'date',
            'due_date'       => 'date',
            'rent_amount'    => 'decimal:2',
            'utility_amount' => 'decimal:2',
            'service_amount' => 'decimal:2',
            'late_fee'       => 'decimal:2',
            'adjustments'    => 'decimal:2',
            'total_amount'   => 'decimal:2',
            'paid_amount'    => 'decimal:2',
            'balance_amount' => 'decimal:2',
            'breakdown'      => 'array',
        ];
    }

    public function lease(): BelongsTo    { return $this->belongsTo(Lease::class); }
    public function tenant(): BelongsTo   { return $this->belongsTo(Tenant::class); }
    public function payments(): HasMany   { return $this->hasMany(Payment::class, 'invoice_id'); }
    public function lines(): HasMany      { return $this->hasMany(UtilityBillLine::class, 'invoice_id'); }

    public function recalcBalance(): void
    {
        $paid    = (float) $this->payments()->whereIn('verification_status', ['verified', 'auto_verified'])->sum('amount');
        $balance = max(0, (float) $this->total_amount - $paid);
        $status  = match (true) {
            $balance <= 0.001                                                       => 'paid',
            $paid > 0 && $balance > 0                                               => 'partial',
            $this->due_date && now()->startOfDay()->gt($this->due_date) && $balance > 0 => 'overdue',
            default                                                                 => 'unpaid',
        };
        $this->update(['paid_amount' => $paid, 'balance_amount' => $balance, 'status' => $status]);
    }
}
