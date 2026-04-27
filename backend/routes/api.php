<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FlatController;
use App\Http\Controllers\Api\LeaseController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\RentPolicyController;
use App\Http\Controllers\Api\TenantController;
use Illuminate\Support\Facades\Route;

/* ---------- Public auth ---------- */

Route::prefix('auth')->group(function () {
    Route::post('signup/request-otp',  [AuthController::class, 'requestSignupOtp']);
    Route::post('signup/verify',       [AuthController::class, 'verifySignup']);
    Route::post('login',               [AuthController::class, 'login']);
    Route::post('password/request-otp',[AuthController::class, 'requestPasswordResetOtp']);
    Route::post('password/reset',      [AuthController::class, 'resetPassword']);
});

/* ---------- Authenticated ---------- */

Route::middleware(['auth:sanctum', 'audit'])->group(function () {

    Route::get ('auth/me',     [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::get('dashboard', [DashboardController::class, 'index']);

    /* Owner-side resources */
    Route::middleware('role:owner,delegate,accountant,super_admin')->group(function () {

        Route::apiResource('buildings',     BuildingController::class);
        Route::apiResource('flats',         FlatController::class);
        Route::post('floors',               [FlatController::class, 'storeFloor']);

        Route::apiResource('tenants',       TenantController::class);
        Route::apiResource('leases',        LeaseController::class)->except(['destroy']);
        Route::post('leases/{lease}/terminate', [LeaseController::class, 'terminate']);

        Route::apiResource('rent-policies', RentPolicyController::class)->except(['show']);

        Route::post('tenants/invite',       [AuthController::class, 'inviteTenant']);
    });

    /* Payments — both owner-staff and tenants */
    Route::get   ('payments',                 [PaymentController::class, 'index']);
    Route::post  ('payments',                 [PaymentController::class, 'store']);
    Route::get   ('payments/{payment}',       [PaymentController::class, 'show']);
    Route::post  ('payments/{payment}/verify',[PaymentController::class, 'verify'])
        ->middleware('role:owner,delegate,accountant,super_admin');
});
