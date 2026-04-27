<?php

namespace App\Http\Controllers\Api;

use App\Models\RentPolicy;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class RentPolicyController extends Controller
{
    public function index(Request $request)
    {
        $ownerId = $request->user()->ownerScope();
        return response()->json(RentPolicy::where('owner_id', $ownerId)->orderByDesc('is_default')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $data['owner_id'] = $request->user()->ownerScope();
        $policy = RentPolicy::create($data);
        AuditService::log('policy_create', $policy, $data);
        return response()->json($policy, 201);
    }

    public function update(Request $request, RentPolicy $policy)
    {
        abort_unless($policy->owner_id === $request->user()->ownerScope(), 403);
        $data = $this->validateData($request, partial: true);
        $policy->update($data);
        AuditService::log('policy_update', $policy, $data);
        return response()->json($policy);
    }

    public function destroy(Request $request, RentPolicy $policy)
    {
        abort_unless($policy->owner_id === $request->user()->ownerScope(), 403);
        if ($policy->leases()->exists()) {
            return response()->json(['message' => 'Cannot delete: policy is in use by leases'], 422);
        }
        $policy->delete();
        AuditService::log('policy_delete', $policy);
        return response()->json(['message' => 'Deleted']);
    }

    protected function validateData(Request $request, bool $partial = false): array
    {
        $rules = [
            'name'                      => [$partial ? 'sometimes' : 'required', 'string', 'max:120'],
            'is_default'                => ['boolean'],
            'due_day'                   => [$partial ? 'sometimes' : 'required', 'integer', 'min:1', 'max:28'],
            'grace_period_days'         => ['nullable', 'integer', 'min:0', 'max:30'],
            'late_fee_method'           => [$partial ? 'sometimes' : 'required', 'in:percentage,flat,tiered'],
            'late_fee_percentage'       => ['nullable', 'numeric', 'min:0', 'max:100'],
            'late_fee_flat_amount'      => ['nullable', 'numeric', 'min:0'],
            'late_fee_tiers'            => ['nullable', 'array'],
            'notice_period_months'      => ['nullable', 'integer', 'min:0', 'max:12'],
            'minimum_stay_months'       => ['nullable', 'integer', 'min:0', 'max:60'],
            'advance_rent_months'       => ['nullable', 'integer', 'min:0', 'max:24'],
            'security_deposit_required' => ['boolean'],
            'main_door_unlock_time'     => ['nullable', 'date_format:H:i'],
            'main_door_lock_time'       => ['nullable', 'date_format:H:i'],
            'late_access_policy'        => ['nullable', 'string', 'max:1000'],
            'notes'                     => ['nullable', 'string', 'max:2000'],
        ];
        return $request->validate($rules);
    }
}
