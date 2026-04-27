<?php

namespace App\Http\Controllers\Api;

use App\Models\Flat;
use App\Models\UtilityMeter;
use App\Models\UtilityRate;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class UtilityMeterController extends Controller
{
    public function index(Request $request)
    {
        $user    = $request->user();
        $ownerId = $user->ownerScope();

        $q = UtilityMeter::with(['flat:id,flat_number,building_id', 'flat.building:id,name,owner_id', 'rate:id,utility_type,label,rate_per_unit'])
            ->whereHas('flat.building', fn($b) => $b->where('owner_id', $ownerId));

        if ($bid = $request->query('building_id')) $q->whereHas('flat', fn($f) => $f->where('building_id', $bid));
        if ($fid = $request->query('flat_id'))     $q->where('flat_id', $fid);
        if ($rid = $request->query('utility_rate_id')) $q->where('utility_rate_id', $rid);

        return response()->json($q->orderBy('flat_id')->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'flat_id'         => ['required', 'exists:flats,id'],
            'utility_rate_id' => ['required', 'exists:utility_rates,id'],
            'meter_number'    => ['nullable', 'string', 'max:60'],
            'opening_reading' => ['nullable', 'numeric', 'min:0'],
            'active'          => ['nullable', 'boolean'],
        ]);

        $flat = Flat::with('building')->findOrFail($data['flat_id']);
        $rate = UtilityRate::findOrFail($data['utility_rate_id']);

        abort_unless($flat->building->owner_id === $user->ownerScope(), 403);
        abort_unless($rate->building_id === $flat->building_id, 422, 'Rate and flat must be in the same building.');

        $meter = UtilityMeter::create($data);
        AuditService::log('utility_meter_create', $meter, $data);

        return response()->json($meter->load(['flat:id,flat_number', 'rate:id,utility_type,label']), 201);
    }

    public function update(Request $request, UtilityMeter $utilityMeter)
    {
        $this->authorize($request, $utilityMeter);
        $data = $request->validate([
            'meter_number'    => ['nullable', 'string', 'max:60'],
            'opening_reading' => ['nullable', 'numeric', 'min:0'],
            'active'          => ['nullable', 'boolean'],
        ]);
        $utilityMeter->update($data);
        AuditService::log('utility_meter_update', $utilityMeter, $data);
        return response()->json($utilityMeter->fresh());
    }

    public function destroy(Request $request, UtilityMeter $utilityMeter)
    {
        $this->authorize($request, $utilityMeter);
        $utilityMeter->update(['active' => false]);
        AuditService::log('utility_meter_deactivate', $utilityMeter, []);
        return response()->json(['ok' => true]);
    }

    protected function authorize(Request $request, UtilityMeter $meter): void
    {
        abort_unless($meter->flat->building->owner_id === $request->user()->ownerScope(), 403);
    }
}
