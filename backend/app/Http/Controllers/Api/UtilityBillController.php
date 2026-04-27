<?php

namespace App\Http\Controllers\Api;

use App\Models\Lease;
use App\Models\RentInvoice;
use App\Services\UtilityBillingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Unified bill = RentInvoice + utility_bill_lines.
 * Tenants can list/show their own; owner-staff list/show by lease/building.
 */
class UtilityBillController extends Controller
{
    public function __construct(protected UtilityBillingService $billing) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $q = RentInvoice::with([
            'lease:id,owner_id,flat_id,tenant_id,monthly_rent',
            'lease.flat:id,flat_number,building_id',
            'lease.flat.building:id,name',
            'tenant:id,full_name,phone',
        ])->withCount('lines');

        if ($user->isTenant()) {
            $q->where('tenant_id', $user->tenantProfile?->id);
        } else {
            $q->whereHas('lease', fn($l) => $l->where('owner_id', $user->ownerScope()));
        }

        if ($status = $request->query('status'))   $q->where('status', $status);
        if ($lid = $request->query('lease_id'))    $q->where('lease_id', $lid);
        if ($bid = $request->query('building_id')) $q->whereHas('lease.flat', fn($f) => $f->where('building_id', $bid));
        if ($month = $request->query('month'))     $q->whereDate('billing_month', Carbon::parse($month)->startOfMonth());

        return response()->json($q->orderByDesc('billing_month')->paginate(30));
    }

    public function show(Request $request, RentInvoice $bill)
    {
        $this->authorize($request, $bill);
        return response()->json($bill->load([
            'lease:id,owner_id,flat_id,tenant_id,monthly_rent',
            'lease.flat:id,flat_number,building_id',
            'lease.flat.building:id,name,billing_due_day',
            'tenant:id,full_name,phone,user_id',
            'lines' => fn($q) => $q->orderBy('id'),
            'lines.rate:id,utility_type,label',
            'lines.reading:id,previous_reading,current_reading,units_consumed,photo_path',
            'payments:id,invoice_id,amount,payment_date,method,verification_status,transaction_id',
        ]));
    }

    /** Manually generate or refresh a single lease's bill for a month. */
    public function generateForLease(Request $request, Lease $lease)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['owner', 'delegate', 'accountant', 'super_admin']), 403);
        abort_unless($lease->owner_id === $user->ownerScope(), 403);

        $month = Carbon::parse($request->input('month', now()->startOfMonth()))->startOfMonth();
        $invoice = $this->billing->generateForLease($lease, $month);
        return response()->json($invoice->load('lines'), 201);
    }

    /** Manually trigger generation for all active leases of the owner for a month. */
    public function generateForOwner(Request $request)
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['owner', 'delegate', 'accountant', 'super_admin']), 403);

        $month = Carbon::parse($request->input('month', now()->startOfMonth()))->startOfMonth();
        $result = $this->billing->generateForOwner($user->ownerScope(), $month);
        return response()->json($result + ['month' => $month->toDateString()]);
    }

    protected function authorize(Request $request, RentInvoice $bill): void
    {
        $user = $request->user();
        if ($user->isTenant()) {
            abort_unless($bill->tenant_id === $user->tenantProfile?->id, 403);
        } else {
            abort_unless($bill->lease->owner_id === $user->ownerScope(), 403);
        }
    }
}
