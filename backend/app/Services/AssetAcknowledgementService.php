<?php

namespace App\Services;

use App\Models\AssetAcknowledgement;
use App\Models\AssetAcknowledgementItem;
use App\Models\Lease;
use App\Models\RoomAsset;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssetAcknowledgementService
{
    public function __construct(protected NotificationService $notifications) {}

    /**
     * Snapshot all active assets in a flat's rooms and create a pending
     * acknowledgement bundle for the lease's tenant. Idempotent — returns
     * the existing bundle if one already exists for this lease.
     */
    public function generateForLease(Lease $lease): AssetAcknowledgement
    {
        $existing = AssetAcknowledgement::where('lease_id', $lease->id)->first();
        if ($existing) return $existing;

        return DB::transaction(function () use ($lease) {
            $ack = AssetAcknowledgement::create([
                'lease_id'   => $lease->id,
                'tenant_id'  => $lease->tenant_id,
                'flat_id'    => $lease->flat_id,
                'status'     => AssetAcknowledgement::STATUS_PENDING,
                'issued_at'  => now(),
            ]);

            $assets = RoomAsset::where('flat_id', $lease->flat_id)
                ->where('active', true)
                ->whereNull('deleted_at')
                ->get();

            foreach ($assets as $asset) {
                AssetAcknowledgementItem::create([
                    'acknowledgement_id'        => $ack->id,
                    'room_asset_id'             => $asset->id,
                    'room_id'                   => $asset->room_id,
                    'asset_category_id'         => $asset->asset_category_id,
                    'asset_name_snapshot'       => $asset->name,
                    'quantity_snapshot'         => $asset->quantity,
                    'owner_condition_snapshot'  => $asset->condition,
                ]);
            }

            // Notify tenant (in-app + push)
            if ($lease->tenant?->user_id && ($user = User::find($lease->tenant->user_id))) {
                $this->notifications->notify(
                    $user,
                    'Asset acknowledgement pending',
                    'Please review and acknowledge the assets in your flat.',
                    ['type' => 'asset_ack', 'lease_id' => $lease->id, 'acknowledgement_id' => $ack->id],
                    ['in_app', 'push']
                );
            }

            return $ack;
        });
    }
}
