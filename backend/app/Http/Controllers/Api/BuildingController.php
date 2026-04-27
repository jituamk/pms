<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class BuildingController extends Controller
{
    public function index(Request $request)
    {
        $ownerId = $request->user()->ownerScope();
        $items = Building::where('owner_id', $ownerId)
            ->withCount(['flats', 'floors'])
            ->orderBy('name')
            ->paginate(50);
        return response()->json($items);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => ['required', 'string', 'max:120'],
            'address'      => ['required', 'string', 'max:255'],
            'city'         => ['nullable', 'string', 'max:80'],
            'area'         => ['nullable', 'string', 'max:120'],
            'total_floors' => ['nullable', 'integer', 'min:1', 'max:200'],
            'latitude'     => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'    => ['nullable', 'numeric', 'between:-180,180'],
            'status'       => ['nullable', 'in:active,under_renovation,inactive'],
            'notes'        => ['nullable', 'string', 'max:2000'],
        ]);
        $data['owner_id'] = $request->user()->ownerScope();
        $building = Building::create($data);
        AuditService::log('building_create', $building, $data);
        return response()->json($building, 201);
    }

    public function show(Request $request, Building $building)
    {
        $this->authorizeOwner($request, $building);
        $building->load(['floors', 'flats.activeLease.tenant']);
        return response()->json($building);
    }

    public function update(Request $request, Building $building)
    {
        $this->authorizeOwner($request, $building);
        $data = $request->validate([
            'name'         => ['sometimes', 'string', 'max:120'],
            'address'      => ['sometimes', 'string', 'max:255'],
            'city'         => ['nullable', 'string', 'max:80'],
            'area'         => ['nullable', 'string', 'max:120'],
            'total_floors' => ['nullable', 'integer', 'min:1', 'max:200'],
            'latitude'     => ['nullable', 'numeric'],
            'longitude'    => ['nullable', 'numeric'],
            'status'       => ['nullable', 'in:active,under_renovation,inactive'],
            'notes'        => ['nullable', 'string', 'max:2000'],
        ]);
        $building->update($data);
        AuditService::log('building_update', $building, $data);
        return response()->json($building);
    }

    public function destroy(Request $request, Building $building)
    {
        $this->authorizeOwner($request, $building);
        $building->delete();
        AuditService::log('building_delete', $building);
        return response()->json(['message' => 'Deleted']);
    }

    protected function authorizeOwner(Request $request, Building $building): void
    {
        abort_unless($building->owner_id === $request->user()->ownerScope(), 403);
    }
}
