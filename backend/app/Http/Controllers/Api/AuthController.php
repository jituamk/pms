<?php

namespace App\Http\Controllers\Api;

use App\Models\Tenant;
use App\Models\User;
use App\Services\AuditService;
use App\Services\OtpService;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function __construct(
        protected OtpService $otp,
        protected SmsService $sms
    ) {}

    /* ---------- OWNER SIGN-UP (phone OTP + NID upload) ---------- */

    public function requestSignupOtp(Request $request)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^(\+?880|0)?1\d{9}$/', Rule::unique('users', 'phone')],
        ]);

        $this->otp->generate($data['phone'], 'signup', $request->ip());
        return response()->json(['message' => 'OTP sent', 'phone' => $data['phone']]);
    }

    public function verifySignup(Request $request)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email', Rule::unique('users', 'email')],
            'phone'    => ['required', 'string', Rule::unique('users', 'phone')],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'otp'      => ['required', 'string'],
            'nid_number' => ['required', 'string', 'max:30'],
            'nid_image'  => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'],
        ]);

        if (!$this->otp->verify($data['phone'], $data['otp'], 'signup')) {
            return response()->json(['message' => 'Invalid or expired OTP'], 422);
        }

        $nidPath = $request->file('nid_image')->store('nid', 'local');

        $user = User::create([
            'name'              => $data['name'],
            'email'             => $data['email'],
            'phone'             => $data['phone'],
            'password'          => $data['password'],
            'role'              => User::ROLE_OWNER,
            'phone_verified_at' => now(),
            'nid_number'        => $data['nid_number'],
            'nid_image_path'    => $nidPath,
            'is_active'         => true,
        ]);

        AuditService::log('owner_signup', $user);

        $token = $user->createToken('pms-pwa')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ], 201);
    }

    /* ---------- LOGIN (email or phone + password) ---------- */

    public function login(Request $request)
    {
        $data = $request->validate([
            'identifier' => ['required', 'string'],     // email or phone
            'password'   => ['required', 'string'],
            'fcm_token'  => ['nullable', 'string'],
        ]);

        $user = User::where('email', $data['identifier'])
            ->orWhere('phone', $data['identifier'])
            ->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }
        if (!$user->is_active) {
            return response()->json(['message' => 'Account is disabled'], 403);
        }

        $user->update([
            'last_login_at' => now(),
            'fcm_token'     => $data['fcm_token'] ?? $user->fcm_token,
        ]);

        AuditService::log('login', $user);

        // Multi-device login allowed — token name includes UA hint
        $tokenName = 'pms-' . substr(md5($request->userAgent() ?? 'web'), 0, 6);
        $token = $user->createToken($tokenName)->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        AuditService::log('logout', $request->user());
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()]);
    }

    /* ---------- PASSWORD RESET (phone OTP) ---------- */

    public function requestPasswordResetOtp(Request $request)
    {
        $data = $request->validate(['phone' => ['required', 'string']]);
        $user = User::where('phone', $data['phone'])->first();
        if (!$user) {
            // Don't leak existence
            return response()->json(['message' => 'If the phone exists, an OTP has been sent']);
        }
        $this->otp->generate($data['phone'], 'password_reset', $request->ip());
        return response()->json(['message' => 'OTP sent']);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'phone'    => ['required', 'string'],
            'otp'      => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (!$this->otp->verify($data['phone'], $data['otp'], 'password_reset')) {
            return response()->json(['message' => 'Invalid or expired OTP'], 422);
        }

        $user = User::where('phone', $data['phone'])->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        $user->update(['password' => $data['password']]);
        $user->tokens()->delete(); // invalidate all sessions

        AuditService::log('password_reset', $user);

        return response()->json(['message' => 'Password reset successful']);
    }

    /* ---------- INVITE TENANT (Owner-only, sends temp password by SMS) ---------- */

    public function inviteTenant(Request $request)
    {
        $owner = $request->user();
        abort_unless($owner->isOwner() || $owner->isDelegate(), 403);

        $data = $request->validate([
            'tenant_id' => ['required', 'exists:tenants,id'],
        ]);

        $tenant = Tenant::where('id', $data['tenant_id'])
            ->where('owner_id', $owner->ownerScope())
            ->firstOrFail();

        $tempPassword = Str::random(10);

        $user = User::firstOrCreate(
            ['phone' => $tenant->phone],
            [
                'name'     => $tenant->full_name,
                'email'    => $tenant->email ?: 'tenant-' . $tenant->id . '@pms.local',
                'role'     => User::ROLE_TENANT,
                'owner_id' => $owner->ownerScope(),
                'password' => $tempPassword,
            ]
        );

        $tenant->update(['user_id' => $user->id]);

        $this->sms->send(
            $tenant->phone,
            "Welcome to PMS. Your login: phone {$tenant->phone}, password {$tempPassword}. Change it on first login."
        );

        AuditService::log('invite_tenant', $tenant);

        return response()->json(['message' => 'Tenant invited via SMS', 'user_id' => $user->id]);
    }
}
