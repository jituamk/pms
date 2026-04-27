<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    public function sendToToken(string $token, string $title, string $body, array $data = []): bool
    {
        $serverKey = config('services.fcm.server_key');
        if (!$serverKey) {
            Log::info("[FCM:no-key] {$title} — {$body}", ['token' => $token, 'data' => $data]);
            return true;
        }

        try {
            $resp = Http::withHeaders([
                'Authorization' => "key={$serverKey}",
                'Content-Type'  => 'application/json',
            ])->post('https://fcm.googleapis.com/fcm/send', [
                'to'           => $token,
                'notification' => ['title' => $title, 'body' => $body],
                'data'         => $data,
                'priority'     => 'high',
            ]);
            return $resp->successful();
        } catch (\Throwable $e) {
            Log::error('FCM send failed', ['error' => $e->getMessage()]);
            return false;
        }
    }
}
