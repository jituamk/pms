<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PaymentProof extends Model
{
    protected $fillable = [
        'payment_id', 'file_path', 'original_name', 'mime_type', 'size_bytes', 'image_hash',
    ];

    public function payment(): BelongsTo { return $this->belongsTo(Payment::class); }
}
