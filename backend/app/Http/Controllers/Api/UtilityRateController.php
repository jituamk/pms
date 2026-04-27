<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Models\UtilityRate;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class UtilityRateController extends Controller
{
    public function index(Request $request)
    {
        $user    = $request->user();
        $ownerId = $user->ownerScope();

        $q = UtilityRate::with('building:id,name,owner_id')
            ->whereHas('building', fn($b) => $b->where('owner_id', $ownerId));

        if ($bid = $request->query('building_id')) $q->where('building_id', $bid);
        if (($active = $request->query('active')) !== null) $q->where('active', filter_var($active, FILTER_VALIDATE_BOOLEAN));

        return response()->json($q->orderBy('building_id')->orderBy('utility_type')->get());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'building_id'    => ['required', 'exists:buildings,id'],
            'utility_type'   => ['required', 'in:electricity,water,gas,service_charge,other'],
            'label'          => ['nullable', 'string', 'max:120'],
            'allocation'     => ['required', 'in:per_meter,shared,fixed_flat'],
            'rate_per_unit'  => ['nullable', 'numeric', 'min:0'],
            'flat_fee'       => ['nullable', 'numeric', 'min:0'],
            'shared_total'   => ['nullable', 'numeric', 'min:0'],
            'active'         => ['nullable', 'boolean'],
            'apply_late_fee' => ['nullable', 'boolean'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);

        $building = Building::findOrFail($data['building_id']);
        abort_unless($building->owner_id === $user->ownerScope(), 403);

        $rate = UtilityRate::create($data);
        AuditService::log('utility_rate_create', $rate, $data);

        return response()->json($rate->load('building:id,name'), 201);
    }

    public function show(Request $request, UtilityRate $utilityRate)
    {
        $this->authorize($request, $utilityRate);
        return response()->json($utilityRate->load(['building:id,name', 'meters.flat:id,flat_number']));
    }

    public function update(Request $request, UtilityRate $utilityRate)
    {
        $this->authorize($request, $utilityRate);
        $data = $request->validate([
            'label'          => ['nullable', 'string', 'max:120'],
            'allocation'     => ['nullable', 'in:per_meter,shared,fixed_flat'],
            'rate_per_unit'  => ['nullable', 'numeric', 'min:0'],
            'flat_fee'       => ['nullable', 'numeric', 'min:0'],
            'shared_total'   => ['nullable', 'numeric', 'min:0'],
            'active'         => ['nullable', 'boolean'],
            'apply_late_fee' => ['nullable', 'boolean'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);
        $utilityRate->update($data);
        AuditService::log('utility_rate_update', $utilityRate, $data);
        return response()->json($utilityRate->fresh());
    }

    public function destroy(Request $request, UtilityRate $utilityRate)
    {
        $this->authorize($request, $utilityRate);
        $utilityRate->update(['active' => false]);
        AuditService::log('utility_rate_deactivate', $utilityRate, []);
        return response()->json(['ok' => true]);
    }

    protected function authorize(Request $request, UtilityRate $rate): void
    {
        abort_unless($rate->building->owner_id === $request->user()->ownerScope(), 403);
    }
}
