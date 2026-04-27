<?php

namespace App\Http\Controllers\Api;

use App\Models\Tenant;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TenantController extends Controller
{
    public function index(Request $request)
    {
        $ownerId = $request->user()->ownerScope();
        $q = Tenant::where('owner_id', $ownerId)->with(['activeLease.flat:id,flat_number,building_id']);
        if ($search = $request->query('q')) {
            $q->where(function ($w) use ($search) {
                $w->where('full_name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('nid_number', 'like', "%{$search}%");
            });
        }
        return response()->json($q->orderBy('full_name')->paginate(50));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name'              => ['required', 'string', 'max:120'],
            'phone'                  => ['required', 'string', 'max:20'],
            'email'                  => ['nullable', 'email'],
            'nid_number'             => ['nullable', 'string', 'max:30'],
            'occupation'             => ['nullable', 'string', 'max:120'],
            'emergency_contact_name' => ['nullable', 'string', 'max:120'],
            'emergency_contact_phone'=> ['nullable', 'string', 'max:20'],
            'permanent_address'      => ['nullable', 'string', 'max:255'],
            'family_members_count'   => ['nullable', 'integer', 'min:1', 'max:30'],
            'notes'                  => ['nullable', 'string', 'max:2000'],
            'nid_image'              => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'],
            'photo'                  => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:4096'],
        ]);
        $data['owner_id'] = $request->user()->ownerScope();

        if ($request->hasFile('nid_image')) {
            $data['nid_image_path'] = $request->file('nid_image')->store('tenant_nid', 'local');
        }
        if ($request->hasFile('photo')) {
            $data['photo_path'] = $request->file('photo')->store('tenant_photos', 'public');
        }

        $tenant = Tenant::create($data);
        AuditService::log('tenant_create', $tenant, $data);
        return response()->json($tenant, 201);
    }

    public function show(Request $request, Tenant $tenant)
    {
        $this->authorizeOwner($request, $tenant);
        return response()->json($tenant->load(['leases.flat.building', 'payments' => fn($q) => $q->latest()->limit(20)]));
    }

    public function update(Request $request, Tenant $tenant)
    {
        $this->authorizeOwner($request, $tenant);
        $data = $request->validate([
            'full_name'              => ['sometimes', 'string', 'max:120'],
            'phone'                  => ['sometimes', 'string', 'max:20'],
            'email'                  => ['nullable', 'email'],
            'nid_number'             => ['nullable', 'string', 'max:30'],
            'occupation'             => ['nullable', 'string', 'max:120'],
            'emergency_contact_name' => ['nullable', 'string', 'max:120'],
            'emergency_contact_phone'=> ['nullable', 'string', 'max:20'],
            'permanent_address'      => ['nullable', 'string', 'max:255'],
            'family_members_count'   => ['nullable', 'integer', 'min:1', 'max:30'],
            'notes'                  => ['nullable', 'string', 'max:2000'],
        ]);
        $tenant->update($data);
        AuditService::log('tenant_update', $tenant, $data);
        return response()->json($tenant);
    }

    public function destroy(Request $request, Tenant $tenant)
    {
        $this->authorizeOwner($request, $tenant);
        $tenant->delete();
        AuditService::log('tenant_delete', $tenant);
        return response()->json(['message' => 'Deleted']);
    }

    protected function authorizeOwner(Request $request, Tenant $tenant): void
    {
        abort_unless($tenant->owner_id === $request->user()->ownerScope(), 403);
    }
}
