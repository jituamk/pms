<?php

use App\Models\RentInvoice;
use App\Models\User;
use App\Services\AuditService;
use App\Services\UtilityBillingService;
use Carbon\Carbon;
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

/* ---------- Phase 3: monthly bill generation ---------- */

Artisan::command('utility:generate-bills {--month= : YYYY-MM-01, defaults to current month} {--owner= : owner user id}', function (UtilityBillingService $billing) {
    $month = $this->option('month') ? Carbon::parse($this->option('month'))->startOfMonth() : now()->startOfMonth();
    $ownerOpt = $this->option('owner');

    $owners = $ownerOpt
        ? User::where('id', $ownerOpt)->where('role', 'owner')->get()
        : User::where('role', 'owner')->get();

    $totalGen = 0; $totalSkip = 0;
    foreach ($owners as $owner) {
        $r = $billing->generateForOwner($owner->id, $month);
        $totalGen += $r['generated']; $totalSkip += $r['skipped'];
        $this->info("owner={$owner->id} generated={$r['generated']} skipped={$r['skipped']}");
    }
    $this->info("Done. month={$month->toDateString()} generated={$totalGen} skipped={$totalSkip}");
})->purpose('Generate unified monthly bills (rent + utilities + late fee) for every active lease');

/* Run on the 1st of each month at 02:00 (server tz = Asia/Dhaka). */
Schedule::command('utility:generate-bills')->monthlyOn(1, '02:00');

/* ---------- Phase 3: daily overdue/late-fee refresh ---------- */

Artisan::command('bills:apply-late-fees', function () {
    $today = now()->startOfDay();
    $count = 0;
    RentInvoice::whereIn('status', ['unpaid', 'partial'])
        ->whereDate('due_date', '<', $today)
        ->chunkById(200, function ($invoices) use (&$count) {
            foreach ($invoices as $inv) {
                if ($inv->balance_amount > 0) {
                    $inv->update(['status' => 'overdue']);
                    $count++;
                }
            }
        });
    $this->info("Marked {$count} invoices overdue.");
})->purpose('Mark unpaid invoices past due_date as overdue (late-fee accrues at next bill generation)');

Schedule::command('bills:apply-late-fees')->dailyAt('04:00');
