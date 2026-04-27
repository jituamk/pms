<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditService
{
    public static function log(string $action, $subject = null, ?array $changes = null): void
    {
        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => $action,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id'   => $subject?->id,
            'changes'      => $changes,
            'ip_address'   => Request::ip(),
            'user_agent'   => substr((string) Request::userAgent(), 0, 250),
            'method'       => Request::method(),
            'url'          => substr((string) Request::fullUrl(), 0, 500),
            'created_at'   => now(),
        ]);
    }

    /**
     * Purge audit entries older than the configured retention period.
     * Schedule: php artisan audit:purge — call from console kernel.
     */
    public static function purgeExpired(): int
    {
        $years = (int) config('services.audit.retention_years', 5);
        return AuditLog::where('created_at', '<', now()->subYears($years))->delete();
    }
}
