<?php

namespace App\Services;

use App\Models\Building;
use App\Models\Flat;
use App\Models\Lease;
use App\Models\RentInvoice;
use App\Models\UtilityBillLine;
use App\Models\UtilityMeter;
use App\Models\UtilityRate;
use App\Models\UtilityReading;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Generates a unified monthly invoice (rent + utilities + late fee) per active lease.
 * Supports three electricity allocation methods picked per building per utility type.
 */
class UtilityBillingService
{
    public function __construct(protected NotificationService $notifications) {}

    /**
     * Generate (or refresh) all unified bills for a billing month for one owner.
     * billingMonth must be a Carbon date — the first day of the month.
     */
    public function generateForOwner(int $ownerId, Carbon $billingMonth): array
    {
        $billingMonth = $billingMonth->copy()->startOfMonth();
        $count = 0;
        $skipped = 0;

        $leases = Lease::where('owner_id', $ownerId)
            ->where('status', Lease::STATUS_ACTIVE)
            ->with(['flat.building', 'rentPolicy'])
            ->get();

        foreach ($leases as $lease) {
            try {
                $this->generateForLease($lease, $billingMonth);
                $count++;
            } catch (\Throwable $e) {
                $skipped++;
                \Log::warning('Bill generation skipped', ['lease_id' => $lease->id, 'error' => $e->getMessage()]);
            }
        }

        return ['generated' => $count, 'skipped' => $skipped];
    }

    /**
     * Build/refresh the invoice for a single lease + month.
     * Idempotent: re-running for the same month rebuilds lines and totals.
     */
    public function generateForLease(Lease $lease, Carbon $billingMonth): RentInvoice
    {
        $billingMonth = $billingMonth->copy()->startOfMonth();
        $building     = $lease->flat?->building;
        if (!$building) throw new \RuntimeException('Lease has no building.');

        $policy   = $lease->rentPolicy;
        $dueDay   = (int) ($building->billing_due_day ?? $policy?->due_day ?? 5);
        $dueDate  = $billingMonth->copy()->addDays(max(0, $dueDay - 1));

        return DB::transaction(function () use ($lease, $building, $policy, $billingMonth, $dueDate) {

            $invoice = RentInvoice::firstOrCreate(
                ['lease_id' => $lease->id, 'billing_month' => $billingMonth->toDateString()],
                [
                    'tenant_id'      => $lease->tenant_id,
                    'invoice_number' => $this->makeInvoiceNumber($lease, $billingMonth),
                    'due_date'       => $dueDate->toDateString(),
                    'rent_amount'    => 0,
                    'utility_amount' => 0,
                    'service_amount' => 0,
                    'late_fee'       => 0,
                    'adjustments'    => 0,
                    'total_amount'   => 0,
                    'paid_amount'    => 0,
                    'balance_amount' => 0,
                    'status'         => 'unpaid',
                ]
            );

            // Wipe machine-generated lines (keep manual adjustments untouched)
            UtilityBillLine::where('invoice_id', $invoice->id)
                ->whereIn('line_type', ['rent', 'electricity', 'water', 'gas', 'service_charge', 'other', 'late_fee'])
                ->delete();

            // 1. Rent line
            $rent = (float) $lease->monthly_rent;
            $this->addLine($invoice->id, 'rent', 'Monthly rent', $rent);

            // 2. Utility lines
            $utilityTotal = 0.0;
            $serviceTotal = 0.0;
            foreach ($building->utilityRates()->where('active', true)->get() as $rate) {
                $charge = $this->computeUtilityCharge($rate, $lease, $billingMonth);
                if ($charge['amount'] <= 0) continue;

                $this->addLine(
                    $invoice->id,
                    $rate->utility_type,
                    $charge['label'],
                    $charge['amount'],
                    $rate->id,
                    $charge['reading_id'] ?? null,
                    $charge['quantity'] ?? null,
                    $charge['rate']     ?? null,
                    $charge['meta']     ?? null,
                );

                if ($rate->utility_type === 'service_charge') {
                    $serviceTotal += $charge['amount'];
                } else {
                    $utilityTotal += $charge['amount'];
                }
            }

            // 3. Late fee — based on prior unpaid invoices, computed on rent only
            $lateFee = 0.0;
            if ($policy && (float) $policy->late_fee_percentage + (float) $policy->late_fee_flat_amount > 0) {
                $unpaidPrev = RentInvoice::where('lease_id', $lease->id)
                    ->where('billing_month', '<', $billingMonth->toDateString())
                    ->whereIn('status', ['unpaid', 'partial', 'overdue'])
                    ->get();

                foreach ($unpaidPrev as $prev) {
                    $daysLate = max(0, now()->startOfDay()->diffInDays($prev->due_date, false) * -1);
                    if ($daysLate <= ($policy->grace_period_days ?? 0)) continue;
                    $lateFee += $policy->calculateLateFee((float) $prev->balance_amount, $daysLate);
                }
            }
            if ($lateFee > 0) {
                $this->addLine($invoice->id, 'late_fee', 'Late fee on overdue invoices', $lateFee);
            }

            // 4. Update invoice header totals
            $adjustments = (float) UtilityBillLine::where('invoice_id', $invoice->id)
                ->where('line_type', 'adjustment')->sum('amount');

            $total = $rent + $utilityTotal + $serviceTotal + $lateFee + $adjustments;
            $paid  = (float) $invoice->payments()->whereIn('verification_status', ['verified', 'auto_verified'])->sum('amount');

            $invoice->update([
                'rent_amount'    => $rent,
                'utility_amount' => $utilityTotal,
                'service_amount' => $serviceTotal,
                'late_fee'       => $lateFee,
                'adjustments'    => $adjustments,
                'total_amount'   => $total,
                'paid_amount'    => $paid,
                'balance_amount' => max(0, $total - $paid),
                'status'         => $paid <= 0 ? 'unpaid' : ($paid >= $total ? 'paid' : 'partial'),
                'breakdown'      => [
                    'rent' => $rent, 'utilities' => $utilityTotal,
                    'service' => $serviceTotal, 'late_fee' => $lateFee, 'adjustments' => $adjustments,
                ],
            ]);

            // Notify tenant of new bill (only on first generation)
            if ($invoice->wasRecentlyCreated && $lease->tenant?->user_id) {
                $user = \App\Models\User::find($lease->tenant->user_id);
                if ($user) {
                    $this->notifications->notify(
                        $user,
                        'New invoice — ৳' . number_format($total, 2),
                        $billingMonth->format('F Y') . ' bill is ready. Due ' . $dueDate->format('d M').'.',
                        ['type' => 'invoice', 'invoice_id' => $invoice->id, 'amount' => $total],
                        ['in_app', 'push']
                    );
                }
            }

            return $invoice->fresh('lines');
        });
    }

    /**
     * Compute one utility line charge for a given lease + billing month.
     * Returns ['amount' => float, 'label' => string, 'meta' => array, …optional fields].
     */
    protected function computeUtilityCharge(UtilityRate $rate, Lease $lease, Carbon $month): array
    {
        $baseLabel = ($rate->label ?: ucfirst(str_replace('_', ' ', $rate->utility_type)))
            . ' (' . $month->format('F Y') . ')';

        if ($rate->allocation === 'fixed_flat') {
            return [
                'amount' => (float) $rate->flat_fee,
                'label'  => $baseLabel,
                'meta'   => ['allocation' => 'fixed_flat'],
            ];
        }

        if ($rate->allocation === 'shared') {
            $occupied = Flat::where('building_id', $rate->building_id)
                ->where('status', Flat::STATUS_OCCUPIED)
                ->count();
            if ($occupied <= 0) return ['amount' => 0, 'label' => $baseLabel, 'meta' => ['allocation' => 'shared', 'reason' => 'no_occupied']];
            $share = round((float) $rate->shared_total / $occupied, 2);
            return [
                'amount' => $share,
                'label'  => $baseLabel . " (shared / {$occupied})",
                'meta'   => ['allocation' => 'shared', 'shared_total' => $rate->shared_total, 'occupied_flats' => $occupied],
            ];
        }

        // per_meter
        $meter = UtilityMeter::where('flat_id', $lease->flat_id)
            ->where('utility_rate_id', $rate->id)
            ->where('active', true)
            ->first();
        if (!$meter) {
            return ['amount' => 0, 'label' => $baseLabel . ' (no meter)', 'meta' => ['allocation' => 'per_meter', 'error' => 'no_meter']];
        }

        $reading = UtilityReading::where('utility_meter_id', $meter->id)
            ->whereDate('reading_month', $month->toDateString())
            ->first();
        if (!$reading) {
            return ['amount' => 0, 'label' => $baseLabel . ' (reading pending)', 'meta' => ['allocation' => 'per_meter', 'error' => 'no_reading']];
        }

        $amount = round((float) $reading->units_consumed * (float) $rate->rate_per_unit, 2);
        return [
            'amount'     => $amount,
            'label'      => $baseLabel . " — {$reading->units_consumed} units × ৳{$rate->rate_per_unit}",
            'reading_id' => $reading->id,
            'quantity'   => $reading->units_consumed,
            'rate'       => $rate->rate_per_unit,
            'meta'       => [
                'allocation'       => 'per_meter',
                'previous_reading' => $reading->previous_reading,
                'current_reading'  => $reading->current_reading,
                'meter_number'     => $meter->meter_number,
            ],
        ];
    }

    protected function addLine(
        int $invoiceId, string $type, string $label, float $amount,
        ?int $rateId = null, ?int $readingId = null,
        ?float $qty = null, ?float $rate = null, ?array $meta = null
    ): void {
        UtilityBillLine::create([
            'invoice_id'         => $invoiceId,
            'utility_rate_id'    => $rateId,
            'utility_reading_id' => $readingId,
            'line_type'          => $type,
            'label'              => $label,
            'quantity'           => $qty,
            'rate'               => $rate,
            'amount'             => $amount,
            'meta'               => $meta,
        ]);
    }

    protected function makeInvoiceNumber(Lease $lease, Carbon $month): string
    {
        return sprintf('INV-%06d-%s', $lease->id, $month->format('Ym'));
    }
}
