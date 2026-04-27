<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssetCategory;
use App\Models\Flat;
use App\Models\Room;
use App\Models\RoomAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Owner / Delegate manage the per-room asset inventory.
 * Read access is wider (accountant for valuation; tenants see only their flat).
 */
class AssetController extends Controller
{
    public function categories(): JsonResponse
    {
        return response()->json(
            AssetCategory::where('active', true)->orderBy('sort_order')->get()
        );
    }

    public function indexByRoom(Request $request, Room $room): JsonResponse
    {
        $this->authorizeFlat($request, $room->flat_id);

        return response()->json(
            $room->assets()->with('category')->orderBy('asset_category_id')->orderBy('name')->get()
        );
    }

    public function indexByFlat(Request $request, Flat $flat): JsonResponse
    {
        $this->authorizeFlat($request, $flat->id);

        return response()->json(
            $flat->assets()->with(['category', 'room'])->orderBy('room_id')->orderBy('asset_category_id')->get()
        );
    }

    public function store(Request $request, Room $room): JsonResponse
    {
        $this->ensureOwnerOrDelegate($request);
        $this->authorizeFlat($request, $room->flat_id);

        $data = $request->validate([
            'asset_category_id' => ['required', 'exists:asset_categories,id'],
            'name'              => ['required', 'string', 'max:120'],
            'brand'             => ['nullable', 'string', 'max:80'],
            'model_no'          => ['nullable', 'string', 'max:80'],
            'serial_no'         => ['nullable', 'string', 'max:120'],
            'quantity'          => ['integer', 'min:1', 'max:999'],
            'condition'         => ['in:new,good,fair,poor'],
            'purchase_price'    => ['nullable', 'numeric', 'min:0'],
            'purchased_on'      => ['nullable', 'date'],
            'photo_path'        => ['nullable', 'string'],
            'notes'             => ['nullable', 'string'],
        ]);

        $asset = RoomAsset::create([
            ...$data,
            'room_id' => $room->id,
            'flat_id' => $room->flat_id,
        ]);

        return response()->json($asset->load('category'), 201);
    }

    public function update(Request $request, RoomAsset $asset): JsonResponse
    {
        $this->ensureOwnerOrDelegate($request);
        $this->authorizeFlat($request, $asset->flat_id);

        $data = $request->validate([
            'asset_category_id' => ['sometimes', 'exists:asset_categories,id'],
            'name'              => ['sometimes', 'string', 'max:120'],
            'brand'             => ['nullable', 'string', 'max:80'],
            'model_no'          => ['nullable', 'string', 'max:80'],
            'serial_no'         => ['nullable', 'string', 'max:120'],
            'quantity'          => ['integer', 'min:1', 'max:999'],
            'condition'         => ['in:new,good,fair,poor'],
            'purchase_price'    => ['nullable', 'numeric', 'min:0'],
            'purchased_on'      => ['nullable', 'date'],
            'photo_path'        => ['nullable', 'string'],
            'notes'             => ['nullable', 'string'],
            'active'            => ['boolean'],
        ]);

        $asset->update($data);
        return response()->json($asset->fresh('category'));
    }

    public function destroy(Request $request, RoomAsset $asset): JsonResponse
    {
        $this->ensureOwnerOrDelegate($request);
        $this->authorizeFlat($request, $asset->flat_id);

        $asset->delete();
        return response()->json(['ok' => true]);
    }

    /* ---------- helpers ---------- */

    protected function ensureOwnerOrDelegate(Request $request): void
    {
        $role = $request->user()->role;
        abort_unless(in_array($role, ['owner', 'delegate', 'super_admin']), 403, 'Only owner or delegate can manage assets.');
    }

    protected function authorizeFlat(Request $request, int $flatId): void
    {
        $user = $request->user();
        if ($user->role === 'super_admin') return;

        $flat = Flat::with('building')->find($flatId);
        abort_if(!$flat, 404);

        if (in_array($user->role, ['owner', 'delegate', 'accountant', 'caretaker'])) {
            $ownerId = $user->role === 'owner' ? $user->id : $user->owner_id;
            abort_unless($flat->building->owner_id === $ownerId, 403);
            return;
        }

        if ($user->role === 'tenant') {
            // Tenant can only read assets of their currently leased flat.
            $hasActiveLease = \App\Models\Lease::where('flat_id', $flatId)
                ->whereHas('tenant', fn($q) => $q->where('user_id', $user->id))
                ->where('status', 'active')->exists();
            abort_unless($hasActiveLease, 403);
            return;
        }

        abort(403);
    }
}
