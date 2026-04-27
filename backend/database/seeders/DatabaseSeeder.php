<?php

namespace Database\Seeders;

use App\Models\AssetCategory;
use App\Models\Building;
use App\Models\Flat;
use App\Models\Floor;
use App\Models\RentPolicy;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {

            // Asset categories (master list — fixed)
            $categories = [
                ['key' => 'furniture',   'label' => 'Furniture',   'icon' => 'sofa',    'sort_order' => 1],
                ['key' => 'electronics', 'label' => 'Electronics', 'icon' => 'plug',    'sort_order' => 2],
                ['key' => 'fixtures',    'label' => 'Fixtures',    'icon' => 'lightbulb','sort_order' => 3],
                ['key' => 'kitchen',     'label' => 'Kitchen',     'icon' => 'utensils','sort_order' => 4],
                ['key' => 'other',       'label' => 'Other',       'icon' => 'box',     'sort_order' => 99],
            ];
            foreach ($categories as $c) {
                AssetCategory::firstOrCreate(['key' => $c['key']], $c);
            }

            // Super admin
            User::firstOrCreate(
                ['email' => 'admin@pms.test'],
                [
                    'name'              => 'Super Admin',
                    'phone'             => '+8801700000000',
                    'role'              => User::ROLE_SUPER_ADMIN,
                    'password'          => 'password',
                    'phone_verified_at' => now(),
                    'email_verified_at' => now(),
                    'is_active'         => true,
                ]
            );

            // Demo owner
            $owner = User::firstOrCreate(
                ['email' => 'owner@pms.test'],
                [
                    'name'              => 'Demo Owner',
                    'phone'             => '+8801711000000',
                    'role'              => User::ROLE_OWNER,
                    'password'          => 'password',
                    'phone_verified_at' => now(),
                    'is_active'         => true,
                ]
            );

            // Default policy
            $policy = RentPolicy::firstOrCreate(
                ['owner_id' => $owner->id, 'name' => 'Standard Policy'],
                [
                    'is_default'                => true,
                    'due_day'                   => 5,
                    'grace_period_days'         => 3,
                    'late_fee_method'           => 'percentage',
                    'late_fee_percentage'       => 1.0,
                    'notice_period_months'      => 1,
                    'minimum_stay_months'       => 6,
                    'advance_rent_months'       => 2,
                    'security_deposit_required' => true,
                    'main_door_unlock_time'     => '06:00',
                    'main_door_lock_time'       => '23:00',
                ]
            );

            // Sample building
            $building = Building::firstOrCreate(
                ['owner_id' => $owner->id, 'name' => 'Demo Tower'],
                [
                    'address'      => '12 Road 7, Dhanmondi',
                    'city'         => 'Dhaka',
                    'area'         => 'Dhanmondi',
                    'total_floors' => 3,
                    'status'       => 'active',
                ]
            );

            for ($lvl = 0; $lvl < 3; $lvl++) {
                $floor = Floor::firstOrCreate(
                    ['building_id' => $building->id, 'level' => $lvl],
                    ['name' => $lvl === 0 ? 'Ground' : "{$lvl}" . ($lvl === 1 ? 'st' : ($lvl === 2 ? 'nd' : 'rd'))]
                );
                foreach (['A', 'B'] as $unit) {
                    $flat = Flat::firstOrCreate(
                        ['building_id' => $building->id, 'flat_number' => "{$lvl}{$unit}"],
                        [
                            'floor_id'    => $floor->id,
                            'bedrooms'    => 2,
                            'bathrooms'   => 2,
                            'has_balcony' => true,
                            'has_kitchen' => true,
                            'size_sqft'   => 950,
                            'base_rent'   => 18000,
                            'status'      => 'vacant',
                        ]
                    );

                    // Standard rooms per flat
                    if ($flat->rooms()->count() === 0) {
                        Room::create(['flat_id' => $flat->id, 'name' => 'Master Bedroom', 'type' => 'bedroom', 'size_sqft' => 180]);
                        Room::create(['flat_id' => $flat->id, 'name' => 'Bedroom 2',      'type' => 'bedroom', 'size_sqft' => 140]);
                        Room::create(['flat_id' => $flat->id, 'name' => 'Living Room',    'type' => 'living',  'size_sqft' => 220]);
                        Room::create(['flat_id' => $flat->id, 'name' => 'Kitchen',        'type' => 'kitchen', 'size_sqft' => 80]);
                    }
                }
            }
        });
    }
}
