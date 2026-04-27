<?php

namespace App\Http\Controllers\Api;

use App\Models\Lease;
use App\Models\Payment;
use App\Models\PaymentProof;
use App\Models\PaymentVerification;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function __construct(protected NotificationService $notif) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $q = Payment::with(['tenant:id,full_name,phone', 'lease:id,flat_id', 'lease.flat:id,flat_number,building_id', 'lease.flat.building:id,name', 'proofs']);

        if ($user->isTenant()) {
            $q->where('tenant_id', $user->tenantProfile?->id);
        } else {
            $q->whereHas('lease', fn($l) => $l->where('owner_id', $user->ownerScope()));
        }

        if ($status = $request->query('status')) $q->where('verification_status', $status);
        if ($lid = $request->query('lease_id'))  $q->where('lease_id', $lid);

        return response()->json($q->latest('payment_date')->paginate(30));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'lease_id'       => ['required', 'exists:leases,id'],
            'amount'         => ['required', 'numeric', 'min:0.01'],
            'payment_date'   => ['required', 'date'],
            'method'         => ['required', 'in:cash,bank_transfer,bkash,rocket,nagad,cheque,other'],
            'transaction_id' => ['nullable', 'string', 'max:60'],
            'sender_phone'   => ['nullable', 'string', 'max:20'],
            'account_number' => ['nullable', 'string', 'max:60'],
            'cheque_number'  => ['nullable', 'string', 'max:60'],
            'cheque_date'    => ['nullable', 'date'],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'proofs'         => ['nullable', 'array'],
            'proofs.*'       => ['file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'],
        ]);

        $lease = Lease::findOrFail($data['lease_id']);

        // Authorization: owner staff OR the tenant on the lease
        if ($user->isTenant()) {
            abort_unless($lease->tenant->user_id === $user->id, 403);
        } else {
            abort_unless($lease->owner_id === $user->ownerScope(), 403);
        }

        $data['tenant_id']    = $lease->tenant_id;
        $data['recorded_by']  = $user->id;
        $data['payment_number'] = 'PMT-' . strtoupper(Str::random(8));
        $data['verification_status'] = $user->isTenant() ? Payment::STATUS_PENDING : Payment::STATUS_MANUAL_REVIEW;

        $payment = DB::transaction(function () use ($data, $request) {
            $proofs = $data['proofs'] ?? [];
            unset($data['proofs']);
            $payment = Payment::create($data);

            foreach ($request->file('proofs', []) as $file) {
                $path = $file->store('payment_proofs', 'local');
                $hash = hash_file('sha256', $file->getRealPath());

                // Duplicate proof detection (BRD 19.5.3)
                $dup = PaymentProof::where('image_hash', $hash)->where('payment_id', '!=', $payment->id)->first();

                PaymentProof::create([
                    'payment_id'    => $payment->id,
                    'file_path'     => $path,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type'     => $file->getMimeType(),
                    'size_bytes'    => $file->getSize(),
                    'image_hash'    => $hash,
                ]);

                if ($dup) {
                    $payment->update(['verification_status' => Payment::STATUS_PENDING_INFO, 'notes' => trim(($payment->notes ?? '') . " | Possible duplicate of payment {$dup->payment_id}")]);
                }
            }
            return $payment;
        });

        AuditService::log('payment_record', $payment, $data);

        // Notify owner if a tenant submitted
        if ($user->isTenant()) {
            $owner = $lease->owner;
            if ($owner) {
                $this->notif->notify(
                    $owner,
                    'New payment submitted',
                    "Tenant {$lease->tenant->full_name} submitted ৳{$payment->amount} via {$payment->method}",
                    ['payment_id' => $payment->id],
                    ['in_app', 'push']
                );
            }
        }

        return response()->json($payment->load('proofs'), 201);
    }

    public function show(Request $request, Payment $payment)
    {
        $this->authorize($request, $payment);
        return response()->json($payment->load(['proofs', 'verifications.verifiedBy:id,name', 'lease.tenant', 'lease.flat.building']));
    }

    public function verify(Request $request, Payment $payment)
    {
        $this->authorize($request, $payment, owner: true);
        $data = $request->validate([
            'result'           => ['required', 'in:verified,rejected,manual_review,pending_info'],
            'sms_match_sender' => ['nullable', 'boolean'],
            'sms_match_amount' => ['nullable', 'boolean'],
            'sms_match_txn_id' => ['nullable', 'boolean'],
            'sms_match_date'   => ['nullable', 'boolean'],
            'reason'           => ['nullable', 'string', 'max:1000'],
            'notes'            => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($payment, $data, $request) {
            PaymentVerification::create(array_merge($data, [
                'payment_id'  => $payment->id,
                'verified_by' => $request->user()->id,
                'verified_at' => now(),
            ]));
            $payment->update(['verification_status' => $data['result']]);
        });

        AuditService::log('payment_verify', $payment, $data);

        // Notify tenant
        if ($payment->tenant?->user) {
            $this->notif->notify(
                $payment->tenant->user,
                'Payment ' . str_replace('_', ' ', $data['result']),
                "Your payment of ৳{$payment->amount} was {$data['result']}.",
                ['payment_id' => $payment->id],
                ['in_app', 'push', 'sms']
            );
        }

        return response()->json($payment->fresh()->load('verifications'));
    }

    protected function authorize(Request $request, Payment $payment, bool $owner = false): void
    {
        $user = $request->user();
        if ($owner) {
            abort_unless(in_array($user->role, ['owner', 'delegate', 'accountant', 'super_admin']), 403);
            abort_unless($payment->lease->owner_id === $user->ownerScope(), 403);
            return;
        }
        if ($user->isTenant()) {
            abort_unless($payment->tenant?->user_id === $user->id, 403);
        } else {
            abort_unless($payment->lease->owner_id === $user->ownerScope(), 403);
        }
    }
}
