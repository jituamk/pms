<?php

namespace App\Services;

use App\Models\Otp;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class OtpService
{
    public function __construct(protected SmsService $sms) {}

    public function generate(string $phone, string $purpose, ?string $ip = null): Otp
    {
        // Rate-limit: invalidate older OTPs of same purpose within last 60s
        Otp::where('phone', $phone)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->where('created_at', '>=', now()->subMinute())
            ->update(['used_at' => now()]);

        $length = (int) config('services.otp.length', 6);
        $ttl    = (int) config('services.otp.ttl_minutes', 5);

        $code = $this->randomDigits($length);

        $otp = Otp::create([
            'phone'      => $phone,
            'code'       => $code,
            'purpose'    => $purpose,
            'expires_at' => Carbon::now()->addMinutes($ttl),
            'ip_address' => $ip,
        ]);

        $this->sms->send(
            $phone,
            "Your PMS verification code is {$code}. Valid for {$ttl} minutes. Do not share."
        );

        return $otp;
    }

    public function verify(string $phone, string $code, string $purpose): bool
    {
        $otp = Otp::where('phone', $phone)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->latest()
            ->first();

        if (!$otp || $otp->isExpired()) {
            return false;
        }

        $otp->increment('attempts');

        if ($otp->code !== $code) {
            return false;
        }

        $otp->update(['used_at' => now()]);
        return true;
    }

    protected function randomDigits(int $len): string
    {
        $out = '';
        for ($i = 0; $i < $len; $i++) {
            $out .= random_int(0, 9);
        }
        return $out;
    }
}
