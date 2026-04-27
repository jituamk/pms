<?php

namespace App\Http\Controllers\Api;

use App\Models\Flat;
use App\Models\Lease;
use App\Models\RentPolicy;
use App\Models\Tenant;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class LeaseController extends Controller
{
    public function index(Request $request)
    {
        $ownerId = $request->user()->ownerScope();
        $q = Lease::where('owner_id', $ownerId)
            ->with(['tenant:id,full_name,phone', 'flat:id,flat_number,building_id', 'flat.building:id,name', 'rentPolicy:id,name']);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($tid = $request->query('tenant_id')) $q->where('tenant_id', $tid);
        return response()->json($q->latest()->paginate(50));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'tenant_id'       => ['required', 'exists:tenants,id'],
            'flat_id'         => ['required', 'exists:flats,id'],
            'rent_policy_id'  => ['required', 'exists:rent_policies,id'],
            'start_date'      => ['required', 'date'],
            'end_date'        => ['nullable', 'date', 'after:start_date'],
            'monthly_rent'    => ['required', 'numeric', 'min:0'],
            'security_deposit'=> ['nullable', 'numeric', 'min:0'],
            'advance_rent'    => ['nullable', 'numeric', 'min:0'],
            'notes'           => ['nullable', 'string', 'max:2000'],
            'signed_lease_pdf' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:8192'],
        ]);

        $owner = $request->user()->ownerScope();
        $tenant  = Tenant::where('id', $data['tenant_id'])->where('owner_id', $owner)->firstOrFail();
        $flat    = Flat::with('building')->findOrFail($data['flat_id']);
        abort_unless($flat->building->owner_id === $owner, 403);
        $policy  = RentPolicy::where('id', $data['rent_policy_id'])->where('owner_id', $owner)->firstOrFail();

        if ($flat->status === Flat::STATUS_OCCUPIED) {
            return response()->json(['message' => 'Flat is already occupied'], 422);
        }

        $data['owner_id'] = $owner;
        $data['status']   = Lease::STATUS_ACTIVE;

        if ($request->hasFile('signed_lease_pdf')) {
            $data['signed_lease_pdf_path'] = $request->file('signed_lease_pdf')->store('leases', 'local');
        }

        $lease = DB::transaction(function () use ($data, $flat) {
            $lease = Lease::create($data);
            $flat->update(['status' => Flat::STATUS_OCCUPIED]);
            return $lease;
        });

        AuditService::log('lease_create', $lease, $data);
        return response()->json($lease->load(['tenant', 'flat.building', 'rentPolicy']), 201);
    }

    public function show(Request $request, Lease $lease)
    {
        $this->authorizeOwner($request, $lease);
        return response()->json($lease->load(['tenant', 'flat.building', 'rentPolicy', 'invoices' => fn($q) => $q->latest()->limit(12), 'payments' => fn($q) => $q->latest()->limit(20)]));
    }

    public function update(Request $request, Lease $lease)
    {
        $this->authorizeOwner($request, $lease);
        $data = $request->validate([
            'rent_policy_id'  => ['sometimes', 'exists:rent_policies,id'],
            'monthly_rent'    => ['sometimes', 'numeric', 'min:0'],
            'security_deposit'=> ['nullable', 'numeric', 'min:0'],
            'advance_rent'    => ['nullable', 'numeric', 'min:0'],
            'end_date'        => ['nullable', 'date'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);
        $lease->update($data);
        AuditService::log('lease_update', $lease, $data);
        return response()->json($lease);
    }

    public function terminate(Request $request, Lease $lease)
    {
        $this->authorizeOwner($request, $lease);
        $data = $request->validate([
            'actual_end_date' => ['required', 'date'],
            'reason'          => ['nullable', 'string', 'max:1000'],
        ]);
        DB::transaction(function () use ($lease, $data) {
            $lease->update([
                'status'          => Lease::STATUS_VACATED,
                'actual_end_date' => $data['actual_end_date'],
                'notice_reason'   => $data['reason'] ?? null,
            ]);
            $lease->flat->update(['status' => Flat::STATUS_VACANT]);
        });
        AuditService::log('lease_terminate', $lease, $data);
        return response()->json($lease->fresh());
    }

    protected function authorizeOwner(Request $request, Lease $lease): void
    {
        abort_unless($lease->owner_id === $request->user()->ownerScope(), 403);
    }
}
