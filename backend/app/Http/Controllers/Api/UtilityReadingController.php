<?php

namespace App\Http\Controllers\Api;

use App\Models\UtilityMeter;
use App\Models\UtilityReading;
use App\Services\AuditService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class UtilityReadingController extends Controller
{
    public function index(Request $request)
    {
        $user    = $request->user();
        $ownerId = $user->ownerScope();

        $q = UtilityReading::with([
            'meter:id,flat_id,utility_rate_id,meter_number',
            'meter.flat:id,flat_number,building_id',
            'meter.flat.building:id,name,owner_id',
            'meter.rate:id,utility_type,label,rate_per_unit',
            'recorder:id,name',
        ])->whereHas('meter.flat.building', fn($b) => $b->where('owner_id', $ownerId));

        if ($bid = $request->query('building_id'))   $q->whereHas('meter.flat', fn($f) => $f->where('building_id', $bid));
        if ($fid = $request->query('flat_id'))       $q->whereHas('meter', fn($m) => $m->where('flat_id', $fid));
        if ($mid = $request->query('meter_id'))      $q->where('utility_meter_id', $mid);
        if ($month = $request->query('month'))       $q->whereDate('reading_month', Carbon::parse($month)->startOfMonth());

        return response()->json($q->orderByDesc('reading_month')->paginate(50));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'utility_meter_id' => ['required', 'exists:utility_meters,id'],
            'reading_month'    => ['required', 'date'],
            'current_reading'  => ['required', 'numeric', 'min:0'],
            'reading_date'     => ['nullable', 'date'],
            'notes'            => ['nullable', 'string', 'max:1000'],
            'photo'            => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:6144'],
        ]);

        $meter = UtilityMeter::with('flat.building')->findOrFail($data['utility_meter_id']);

        // Authorize: owner-staff for this building, OR caretaker assigned to this owner.
        $ownerId = $meter->flat->building->owner_id;
        if (in_array($user->role, ['owner', 'delegate', 'accountant', 'super_admin'])) {
            abort_unless($user->ownerScope() === $ownerId, 403);
        } elseif ($user->role === 'caretaker') {
            abort_unless($user->owner_id === $ownerId, 403);
        } else {
            abort(403);
        }

        $month = Carbon::parse($data['reading_month'])->startOfMonth();

        // Previous reading = last reading for this meter before $month, fallback to opening_reading.
        $prevRow = $meter->readings()->where('reading_month', '<', $month->toDateString())
            ->orderByDesc('reading_month')->first();
        $previous = $prevRow ? (float) $prevRow->current_reading : (float) $meter->opening_reading;

        $current = (float) $data['current_reading'];
        abort_if($current < $previous, 422, 'Current reading cannot be less than previous reading (' . $previous . ').');

        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('utility_readings', 'local');
        }

        $reading = UtilityReading::updateOrCreate(
            ['utility_meter_id' => $meter->id, 'reading_month' => $month->toDateString()],
            [
                'previous_reading' => $previous,
                'current_reading'  => $current,
                'units_consumed'   => round($current - $previous, 2),
                'reading_date'     => $data['reading_date'] ?? now()->toDateString(),
                'recorded_by'      => $user->id,
                'photo_path'       => $photoPath ?? null,
                'notes'            => $data['notes'] ?? null,
            ]
        );

        AuditService::log('utility_reading_record', $reading, [
            'meter_id' => $meter->id, 'units' => $reading->units_consumed,
        ]);

        return response()->json($reading->load(['meter.flat:id,flat_number', 'meter.rate:id,utility_type,label']), 201);
    }

    public function show(Request $request, UtilityReading $utilityReading)
    {
        $this->authorize($request, $utilityReading);
        return response()->json($utilityReading->load([
            'meter.flat:id,flat_number,building_id',
            'meter.flat.building:id,name',
            'meter.rate:id,utility_type,label,rate_per_unit',
            'recorder:id,name',
        ]));
    }

    public function destroy(Request $request, UtilityReading $utilityReading)
    {
        $this->authorize($request, $utilityReading);
        // Only owner-staff (not caretakers) can delete a reading.
        abort_unless(in_array($request->user()->role, ['owner', 'delegate', 'super_admin']), 403);
        AuditService::log('utility_reading_delete', $utilityReading, []);
        $utilityReading->delete();
        return response()->json(['ok' => true]);
    }

    protected function authorize(Request $request, UtilityReading $r): void
    {
        $user    = $request->user();
        $ownerId = $r->meter->flat->building->owner_id;
        if (in_array($user->role, ['owner', 'delegate', 'accountant', 'super_admin'])) {
            abort_unless($user->ownerScope() === $ownerId, 403);
        } elseif ($user->role === 'caretaker') {
            abort_unless($user->owner_id === $ownerId, 403);
        } else {
            abort(403);
        }
    }
}
