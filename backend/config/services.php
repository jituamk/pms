<?php

return [
    'sms' => [
        'provider'  => env('SMS_PROVIDER', 'log'),
        'api_url'   => env('SMS_API_URL'),
        'api_key'   => env('SMS_API_KEY'),
        'sender_id' => env('SMS_SENDER_ID', 'PMS'),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY'),
        'sender_id'  => env('FCM_SENDER_ID'),
    ],

    'otp' => [
        'length'      => (int) env('OTP_LENGTH', 6),
        'ttl_minutes' => (int) env('OTP_TTL_MINUTES', 5),
    ],

    'audit' => [
        'retention_years' => (int) env('AUDIT_RETENTION_YEARS', 5),
    ],
];
