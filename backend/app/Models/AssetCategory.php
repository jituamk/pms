<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetCategory extends Model
{
    protected $fillable = ['key', 'label', 'icon', 'sort_order', 'active'];
    protected $casts    = ['active' => 'boolean'];

    public function assets(): HasMany { return $this->hasMany(RoomAsset::class); }
}
