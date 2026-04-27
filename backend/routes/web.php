<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn() => response()->json([
    'name'    => config('app.name'),
    'version' => '1.0.0-phase1',
    'docs'    => '/api/auth/login',
]));
