<?php

use App\Http\Controllers\Api\AcknowledgementController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FlatController;
use App\Http\Controllers\Api\InspectionController;
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

    /* ---------- Assets (room inventory) ---------- */
    Route::get   ('asset-categories',         [AssetController::class, 'categories']);
    Route::get   ('rooms/{room}/assets',      [AssetController::class, 'indexByRoom']);
    Route::get   ('flats/{flat}/assets',      [AssetController::class, 'indexByFlat']);
    Route::post  ('rooms/{room}/assets',      [AssetController::class, 'store'])
        ->middleware('role:owner,delegate,super_admin');
    Route::patch ('assets/{asset}',           [AssetController::class, 'update'])
        ->middleware('role:owner,delegate,super_admin');
    Route::delete('assets/{asset}',           [AssetController::class, 'destroy'])
        ->middleware('role:owner,delegate,super_admin');

    /* ---------- Tenant acknowledgements ---------- */
    Route::get   ('acknowledgements',                       [AcknowledgementController::class, 'index']);
    Route::get   ('acknowledgements/{acknowledgement}',     [AcknowledgementController::class, 'show']);
    Route::patch ('acknowledgement-items/{item}',           [AcknowledgementController::class, 'updateItem']);
    Route::post  ('acknowledgements/{acknowledgement}/submit',[AcknowledgementController::class, 'submit']);
    Route::post  ('leases/{lease}/acknowledgements/generate',[AcknowledgementController::class, 'generate'])
        ->middleware('role:owner,delegate,super_admin');

    /* ---------- Move-out inspections ---------- */
    Route::get   ('inspections',                            [InspectionController::class, 'index']);
    Route::get   ('inspections/{inspection}',               [InspectionController::class, 'show']);
    Route::post  ('leases/{lease}/inspections/start',       [InspectionController::class, 'start'])
        ->middleware('role:owner,delegate,super_admin');
    Route::patch ('inspection-items/{item}',                [InspectionController::class, 'updateItem'])
        ->middleware('role:owner,delegate,super_admin');
    Route::post  ('inspections/{inspection}/finalize',      [InspectionController::class, 'finalize'])
        ->middleware('role:owner,delegate,super_admin');
});
