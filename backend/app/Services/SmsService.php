<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMS gateway abstraction. Default driver is `log` — swap in production.
 * Common BD providers: SSL Wireless, BulkSMSBD, Alpha SMS, etc.
 */
class SmsService
{
    public function send(string $phone, string $message): bool
    {
        $provider = config('services.sms.provider', 'log');
        $phone    = $this->normalize($phone);

        return match ($provider) {
            'log'    => $this->logDriver($phone, $message),
            'http'   => $this->httpDriver($phone, $message),
            default  => $this->logDriver($phone, $message),
        };
    }

    protected function logDriver(string $phone, string $message): bool
    {
        Log::channel('stack')->info("[SMS:{$phone}] {$message}");
        return true;
    }

    protected function httpDriver(string $phone, string $message): bool
    {
        try {
            $resp = Http::asForm()->post(config('services.sms.api_url'), [
                'api_key' => config('services.sms.api_key'),
                'sender'  => config('services.sms.sender_id'),
                'to'      => $phone,
                'message' => $message,
            ]);
            return $resp->successful();
        } catch (\Throwable $e) {
            Log::error('SMS send failed', ['error' => $e->getMessage(), 'phone' => $phone]);
            return false;
        }
    }

    protected function normalize(string $phone): string
    {
        $phone = preg_replace('/\D+/', '', $phone);
        if (str_starts_with($phone, '880')) return '+' . $phone;
        if (str_starts_with($phone, '0'))   return '+880' . substr($phone, 1);
        return '+' . $phone;
    }
}
