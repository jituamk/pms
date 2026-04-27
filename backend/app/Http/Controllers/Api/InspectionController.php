<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssetInspection;
use App\Models\AssetInspectionItem;
use App\Models\DepositDeduction;
use App\Models\Lease;
use App\Models\RoomAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Move-out inspection. Owner or delegate fills, finalizes, and the system
 * auto-records deposit_deductions.
 */
class InspectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = AssetInspection::with(['lease.flat.building', 'lease.tenant', 'inspector']);

        if ($user->role !== 'super_admin') {
            $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
            $query->whereHas('lease.flat.building', fn($q) => $q->where('owner_id', $ownerId));
        }

        return response()->json($query->latest()->get());
    }

    public function show(Request $request, AssetInspection $inspection): JsonResponse
    {
        $this->authorizeOwner($request, $inspection);
        return response()->json(
            $inspection->load(['items.category', 'items.room', 'lease.flat.building', 'lease.tenant', 'inspector'])
        );
    }

    /**
     * Open or fetch an in-progress inspection for a lease (idempotent).
     */
    public function start(Request $request, Lease $lease): JsonResponse
    {
        $this->ensureOwnerOrDelegate($request);
        $this->authorizeLease($request, $lease);

        if (!in_array($lease->status, [Lease::STATUS_NOTICE_PERIOD, Lease::STATUS_VACATED, Lease::STATUS_TERMINATED])) {
            abort(422, 'Lease must be in notice/vacated/terminated state.');
        }

        $inspection = AssetInspection::firstOrCreate(
            ['lease_id' => $lease->id],
            [
                'flat_id'        => $lease->flat_id,
                'inspector_id'   => $request->user()->id,
                'status'         => AssetInspection::STATUS_DRAFT,
                'deposit_amount' => $lease->security_deposit ?? 0,
                'inspected_at'   => now(),
            ]
        );

        // Pre-populate items from snapshot if missing
        if ($inspection->items()->count() === 0) {
            $assets = RoomAsset::where('flat_id', $lease->flat_id)
                ->whereNull('deleted_at')
                ->get();

            // Reference move-in conditions from the acknowledgement bundle if it exists
            $moveIn = $lease->acknowledgement?->items()->get()->keyBy('room_asset_id') ?? collect();

            foreach ($assets as $asset) {
                AssetInspectionItem::create([
                    'inspection_id'        => $inspection->id,
                    'room_asset_id'        => $asset->id,
                    'room_id'              => $asset->room_id,
                    'asset_category_id'    => $asset->asset_category_id,
                    'asset_name_snapshot'  => $asset->name,
                    'move_in_condition'    => $moveIn[$asset->id]->owner_condition_snapshot ?? $asset->condition,
                    'exit_condition'       => 'good',
                    'is_damaged'           => false,
                    'damage_charge'        => 0,
                ]);
            }
        }

        return response()->json($inspection->load(['items.category', 'items.room']), 201);
    }

    public function updateItem(Request $request, AssetInspectionItem $item): JsonResponse
    {
        $inspection = AssetInspection::findOrFail($item->inspection_id);
        $this->authorizeOwner($request, $inspection);

        if ($inspection->status === AssetInspection::STATUS_FINALIZED) {
            abort(409, 'Inspection already finalized.');
        }

        $data = $request->validate([
            'exit_condition'  => ['required', 'in:good,fair,poor,damaged,missing'],
            'is_damaged'      => ['boolean'],
            'damage_charge'   => ['numeric', 'min:0'],
            'photo_path'      => ['nullable', 'string'],
            'inspector_note'  => ['nullable', 'string', 'max:1000'],
        ]);

        // Auto-flag damage when condition is damaged/missing/poor
        if (in_array($data['exit_condition'], ['damaged', 'missing', 'poor'])) {
            $data['is_damaged'] = $data['is_damaged'] ?? true;
        }

        $item->update($data);
        $inspection->recalcTotals();

        return response()->json([
            'item'                => $item->fresh(),
            'total_damage_charge' => $inspection->total_damage_charge,
            'deposit_refund'      => $inspection->deposit_refund,
        ]);
    }

    public function finalize(Request $request, AssetInspection $inspection): JsonResponse
    {
        $this->authorizeOwner($request, $inspection);

        if ($inspection->status === AssetInspection::STATUS_FINALIZED) {
            abort(409, 'Already finalized.');
        }

        $data = $request->validate([
            'summary_notes'        => ['nullable', 'string', 'max:2000'],
            'extra_deductions'     => ['array'],
            'extra_deductions.*.reason'      => ['required', 'in:cleaning,unpaid_rent,utilities,other'],
            'extra_deductions.*.amount'      => ['required', 'numeric', 'min:0'],
            'extra_deductions.*.description' => ['nullable', 'string', 'max:300'],
        ]);

        DB::transaction(function () use ($inspection, $data) {
            // Wipe prior deductions for this lease before re-writing (only damage rows)
            DepositDeduction::where('lease_id', $inspection->lease_id)->delete();

            $extraTotal = 0.0;
            foreach ($inspection->items as $item) {
                if ($item->is_damaged && (float) $item->damage_charge > 0) {
                    DepositDeduction::create([
                        'lease_id'           => $inspection->lease_id,
                        'inspection_item_id' => $item->id,
                        'reason'             => $item->exit_condition === 'missing'
                            ? DepositDeduction::REASON_ASSET_MISSING
                            : DepositDeduction::REASON_ASSET_DAMAGE,
                        'amount'             => $item->damage_charge,
                        'description'        => $item->asset_name_snapshot . ' — ' . ($item->inspector_note ?? ''),
                    ]);
                }
            }

            foreach ($data['extra_deductions'] ?? [] as $extra) {
                DepositDeduction::create([
                    'lease_id'    => $inspection->lease_id,
                    'reason'      => $extra['reason'],
                    'amount'      => $extra['amount'],
                    'description' => $extra['description'] ?? null,
                ]);
                $extraTotal += (float) $extra['amount'];
            }

            $totalCharge = (float) $inspection->items()->sum('damage_charge') + $extraTotal;

            $inspection->update([
                'status'              => AssetInspection::STATUS_FINALIZED,
                'summary_notes'       => $data['summary_notes'] ?? null,
                'total_damage_charge' => $totalCharge,
                'deposit_refund'      => max(0, ((float) $inspection->deposit_amount) - $totalCharge),
                'finalized_at'        => now(),
            ]);
        });

        return response()->json($inspection->fresh()->load(['items', 'deductions']));
    }

    /* ---------- helpers ---------- */

    protected function ensureOwnerOrDelegate(Request $request): void
    {
        $role = $request->user()->role;
        abort_unless(in_array($role, ['owner', 'delegate', 'super_admin']), 403);
    }

    protected function authorizeLease(Request $request, Lease $lease): void
    {
        $user = $request->user();
        if ($user->role === 'super_admin') return;
        $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
        abort_unless($lease->owner_id === $ownerId, 403);
    }

    protected function authorizeOwner(Request $request, AssetInspection $inspection): void
    {
        $this->ensureOwnerOrDelegate($request);
        $inspection->loadMissing('lease');
        $this->authorizeLease($request, $inspection->lease);
    }
}
