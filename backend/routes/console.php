<?php

use App\Services\AuditService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('audit:purge', function () {
    $deleted = AuditService::purgeExpired();
    $this->info("Purged {$deleted} audit log entries beyond retention period.");
})->purpose('Purge audit logs older than 5 years');

Schedule::command('audit:purge')->dailyAt('03:00');
