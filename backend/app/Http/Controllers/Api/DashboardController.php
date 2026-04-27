<?php

namespace App\Http\Controllers\Api;

use App\Models\Building;
use App\Models\Flat;
use App\Models\Lease;
use App\Models\Payment;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        return match ($user->role) {
            'owner', 'delegate', 'accountant' => $this->ownerDashboard($user),
            'tenant'                           => $this->tenantDashboard($user),
            'caretaker'                        => $this->caretakerDashboard($user),
            'super_admin'                      => $this->superAdminDashboard(),
            default                            => response()->json([]),
        };
    }

    protected function ownerDashboard($user)
    {
        $ownerId = $user->ownerScope();

        $totalBuildings = Building::where('owner_id', $ownerId)->count();
        $totalFlats     = Flat::whereHas('building', fn($b) => $b->where('owner_id', $ownerId))->count();
        $occupied       = Flat::whereHas('building', fn($b) => $b->where('owner_id', $ownerId))->where('status', 'occupied')->count();
        $vacant         = Flat::whereHas('building', fn($b) => $b->where('owner_id', $ownerId))->where('status', 'vacant')->count();
        $tenants        = Tenant::where('owner_id', $ownerId)->count();
        $activeLeases   = Lease::where('owner_id', $ownerId)->where('status', 'active')->count();

        $monthStart = now()->startOfMonth();
        $collectedThisMonth = Payment::whereHas('lease', fn($l) => $l->where('owner_id', $ownerId))
            ->where('verification_status', 'verified')
            ->where('payment_date', '>=', $monthStart)
            ->sum('amount');

        $pendingVerification = Payment::whereHas('lease', fn($l) => $l->where('owner_id', $ownerId))
            ->whereIn('verification_status', ['pending', 'manual_review', 'pending_info'])
            ->count();

        $occupancyRate = $totalFlats > 0 ? round(($occupied / $totalFlats) * 100, 1) : 0.0;

        return response()->json([
            'kpis' => [
                'total_buildings'        => $totalBuildings,
                'total_flats'            => $totalFlats,
                'occupied_flats'         => $occupied,
                'vacant_flats'           => $vacant,
                'occupancy_rate'         => $occupancyRate,
                'total_tenants'          => $tenants,
                'active_leases'          => $activeLeases,
                'collected_this_month'   => $collectedThisMonth,
                'pending_verification'   => $pendingVerification,
            ],
            'recent_payments' => Payment::whereHas('lease', fn($l) => $l->where('owner_id', $ownerId))
                ->with(['tenant:id,full_name', 'lease.flat:id,flat_number'])
                ->latest('payment_date')->limit(10)->get(),
        ]);
    }

    protected function tenantDashboard($user)
    {
        $tenant = $user->tenantProfile;
        if (!$tenant) return response()->json(['message' => 'Tenant profile not found'], 404);

        $lease = $tenant->activeLease()->with('flat.building', 'rentPolicy')->first();
        $payments = Payment::where('tenant_id', $tenant->id)->latest('payment_date')->limit(10)->get();

        return response()->json([
            'tenant'   => $tenant,
            'lease'    => $lease,
            'payments' => $payments,
        ]);
    }

    protected function caretakerDashboard($user)
    {
        $ownerId = $user->owner_id;
        return response()->json([
            'pending_jobs' => 0,
            'buildings'    => Building::where('owner_id', $ownerId)->select('id', 'name', 'address')->get(),
        ]);
    }

    protected function superAdminDashboard()
    {
        return response()->json([
            'total_owners'  => \App\Models\User::where('role', 'owner')->count(),
            'total_users'   => \App\Models\User::count(),
            'total_buildings' => Building::count(),
            'total_flats'   => Flat::count(),
        ]);
    }
}
