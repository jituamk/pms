<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssetAcknowledgement;
use App\Models\AssetAcknowledgementItem;
use App\Models\Lease;
use App\Services\AssetAcknowledgementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcknowledgementController extends Controller
{
    public function __construct(protected AssetAcknowledgementService $service) {}

    /**
     * Tenant: list my pending + past acknowledgements.
     * Owner/Delegate: list bundles for flats they own.
     */
    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = AssetAcknowledgement::with(['lease.flat.building', 'tenant', 'items.category']);

        if ($user->role === 'tenant') {
            $query->whereHas('tenant', fn($q) => $q->where('user_id', $user->id));
        } elseif (in_array($user->role, ['owner', 'delegate', 'accountant'])) {
            $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
            $query->whereHas('lease.flat.building', fn($q) => $q->where('owner_id', $ownerId));
        } elseif ($user->role !== 'super_admin') {
            abort(403);
        }

        return response()->json($query->latest()->get());
    }

    public function show(Request $request, AssetAcknowledgement $acknowledgement): JsonResponse
    {
        $this->authorizeView($request, $acknowledgement);
        return response()->json(
            $acknowledgement->load(['items.category', 'items.room', 'lease.flat.building', 'tenant'])
        );
    }

    /**
     * Tenant updates one item (checkbox + condition note).
     */
    public function updateItem(Request $request, AssetAcknowledgementItem $item): JsonResponse
    {
        $ack = AssetAcknowledgement::findOrFail($item->acknowledgement_id);
        $this->authorizeTenant($request, $ack);

        if ($ack->status === AssetAcknowledgement::STATUS_ACKNOWLEDGED) {
            abort(409, 'Already finalized.');
        }

        $data = $request->validate([
            'is_present'       => ['required', 'boolean'],
            'tenant_condition' => ['nullable', 'in:new,good,fair,poor,damaged,missing'],
            'tenant_note'      => ['nullable', 'string', 'max:500'],
        ]);

        // If tenant marks not present, default condition to "missing"
        if (!$data['is_present']) {
            $data['tenant_condition'] = $data['tenant_condition'] ?? 'missing';
        }

        $item->update([
            ...$data,
            'acknowledged_at' => now(),
        ]);

        $ack->refresh();
        $ack->load('items');
        $ack->recalcStatus();

        return response()->json([
            'item' => $item->fresh(),
            'acknowledgement_status' => $ack->status,
        ]);
    }

    /**
     * Tenant submits the bundle (commits acknowledgement).
     */
    public function submit(Request $request, AssetAcknowledgement $acknowledgement): JsonResponse
    {
        $this->authorizeTenant($request, $acknowledgement);

        $data = $request->validate([
            'tenant_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $unticked = $acknowledgement->items()->whereNull('is_present')->count();
        if ($unticked > 0) {
            abort(422, "You still have {$unticked} item(s) unreviewed.");
        }

        $acknowledgement->update([
            'tenant_notes'    => $data['tenant_notes'] ?? null,
            'acknowledged_at' => now(),
        ]);

        $acknowledgement->load('items');
        $acknowledgement->recalcStatus();

        return response()->json($acknowledgement->fresh());
    }

    /**
     * Owner can manually trigger generation if it didn't auto-create.
     */
    public function generate(Request $request, Lease $lease): JsonResponse
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['owner', 'delegate', 'super_admin']), 403);
        if ($user->role !== 'super_admin') {
            $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
            abort_unless($lease->owner_id === $ownerId, 403);
        }

        $ack = $this->service->generateForLease($lease);
        return response()->json($ack->load('items.category'), 201);
    }

    /* ---------- helpers ---------- */

    protected function authorizeTenant(Request $request, AssetAcknowledgement $ack): void
    {
        $user = $request->user();
        abort_unless($user->role === 'tenant', 403, 'Only the tenant can acknowledge.');
        $ack->loadMissing('tenant');
        abort_unless($ack->tenant->user_id === $user->id, 403);
    }

    protected function authorizeView(Request $request, AssetAcknowledgement $ack): void
    {
        $user = $request->user();
        if ($user->role === 'super_admin') return;

        if ($user->role === 'tenant') {
            $ack->loadMissing('tenant');
            abort_unless($ack->tenant->user_id === $user->id, 403);
            return;
        }

        if (in_array($user->role, ['owner', 'delegate', 'accountant'])) {
            $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
            $ack->loadMissing('lease.flat.building');
            abort_unless($ack->lease->flat->building->owner_id === $ownerId, 403);
            return;
        }

        abort(403);
    }
}
