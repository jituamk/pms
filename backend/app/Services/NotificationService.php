<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;

class NotificationService
{
    public function __construct(
        protected FcmService $fcm,
        protected SmsService $sms
    ) {}

    public function notify(User $user, string $title, string $body, array $payload = [], array $channels = ['in_app']): void
    {
        foreach ($channels as $channel) {
            $notif = AppNotification::create([
                'user_id' => $user->id,
                'title'   => $title,
                'body'    => $body,
                'channel' => $channel,
                'status'  => 'queued',
                'payload' => $payload,
            ]);

            $sent = match ($channel) {
                'sms'   => $user->phone ? $this->sms->send($user->phone, $body) : false,
                'push'  => $user->fcm_token ? $this->fcm->sendToToken($user->fcm_token, $title, $body, $payload) : false,
                'email' => true, // hand off to Laravel Mail in production
                default => true, // in_app
            };

            $notif->update([
                'status'  => $sent ? 'sent' : 'failed',
                'sent_at' => now(),
            ]);
        }
    }
}
