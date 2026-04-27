<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Models\Flat;
use App\Models\Floor;
use App\Models\Room;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class FlatController extends Controller
{
    public function index(Request $request)
    {
        $ownerId = $request->user()->ownerScope();
        $q = Flat::whereHas('building', fn($b) => $b->where('owner_id', $ownerId))
            ->with(['building:id,name', 'floor:id,name,level', 'activeLease.tenant:id,full_name,phone']);

        if ($bid = $request->query('building_id')) {
            $q->where('building_id', $bid);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return response()->json($q->orderBy('flat_number')->paginate(50));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'building_id' => ['required', 'exists:buildings,id'],
            'floor_id'    => ['required', 'exists:floors,id'],
            'flat_number' => ['required', 'string', 'max:30'],
            'bedrooms'    => ['required', 'integer', 'min:0', 'max:20'],
            'bathrooms'   => ['required', 'integer', 'min:0', 'max:20'],
            'has_balcony' => ['boolean'],
            'has_kitchen' => ['boolean'],
            'size_sqft'   => ['nullable', 'numeric', 'min:0'],
            'base_rent'   => ['required', 'numeric', 'min:0'],
            'status'      => ['nullable', 'in:vacant,occupied,reserved,under_renovation'],
            'notes'       => ['nullable', 'string', 'max:2000'],
            'rooms'       => ['nullable', 'array'],
            'rooms.*.name'      => ['required_with:rooms', 'string', 'max:80'],
            'rooms.*.type'      => ['required_with:rooms', 'in:bedroom,living,dining,kitchen,bathroom,balcony,storage,other'],
            'rooms.*.size_sqft' => ['nullable', 'numeric', 'min:0'],
        ]);

        $building = Building::findOrFail($data['building_id']);
        abort_unless($building->owner_id === $request->user()->ownerScope(), 403);

        $rooms = $data['rooms'] ?? [];
        unset($data['rooms']);

        $flat = DB::transaction(function () use ($data, $rooms) {
            $flat = Flat::create($data);
            foreach ($rooms as $r) {
                $r['flat_id'] = $flat->id;
                Room::create($r);
            }
            return $flat;
        });

        AuditService::log('flat_create', $flat, $data);
        return response()->json($flat->load('rooms'), 201);
    }

    public function show(Request $request, Flat $flat)
    {
        $this->authorizeOwner($request, $flat);
        return response()->json($flat->load(['building:id,name,address', 'floor', 'rooms', 'activeLease.tenant']));
    }

    public function update(Request $request, Flat $flat)
    {
        $this->authorizeOwner($request, $flat);
        $data = $request->validate([
            'flat_number' => ['sometimes', 'string', 'max:30'],
            'floor_id'    => ['sometimes', 'exists:floors,id'],
            'bedrooms'    => ['sometimes', 'integer', 'min:0', 'max:20'],
            'bathrooms'   => ['sometimes', 'integer', 'min:0', 'max:20'],
            'has_balcony' => ['boolean'],
            'has_kitchen' => ['boolean'],
            'size_sqft'   => ['nullable', 'numeric', 'min:0'],
            'base_rent'   => ['sometimes', 'numeric', 'min:0'],
            'status'      => ['nullable', 'in:vacant,occupied,reserved,under_renovation'],
            'notes'       => ['nullable', 'string', 'max:2000'],
        ]);
        $flat->update($data);
        AuditService::log('flat_update', $flat, $data);
        return response()->json($flat);
    }

    public function destroy(Request $request, Flat $flat)
    {
        $this->authorizeOwner($request, $flat);
        $flat->delete();
        AuditService::log('flat_delete', $flat);
        return response()->json(['message' => 'Deleted']);
    }

    /* Floors helper */
    public function storeFloor(Request $request)
    {
        $data = $request->validate([
            'building_id' => ['required', 'exists:buildings,id'],
            'name'        => ['required', 'string', 'max:60'],
            'level'       => ['required', 'integer', 'min:0', 'max:200'],
        ]);
        $building = Building::findOrFail($data['building_id']);
        abort_unless($building->owner_id === $request->user()->ownerScope(), 403);
        $floor = Floor::create($data);
        AuditService::log('floor_create', $floor, $data);
        return response()->json($floor, 201);
    }

    protected function authorizeOwner(Request $request, Flat $flat): void
    {
        abort_unless($flat->building->owner_id === $request->user()->ownerScope(), 403);
    }
}
