<?php

namespace App\Http\Controllers\Api;

use App\Models\Payment;
use App\Models\PaymentSmsInbox;
use App\Services\AuditService;
use App\Services\SmsParserService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SmsInboxController extends Controller
{
    public function __construct(protected SmsParserService $parser) {}

    public function index(Request $request)
    {
        $user    = $request->user();
        $ownerId = $user->ownerScope();

        $q = PaymentSmsInbox::with(['payment:id,payment_number,amount,verification_status'])
            ->where('owner_id', $ownerId);

        if ($status   = $request->query('status'))   $q->where('status', $status);
        if ($provider = $request->query('provider')) $q->where('provider', $provider);

        return response()->json($q->orderByDesc('received_at')->paginate(30));
    }

    /** Manually ingest an SMS (used by user-side import + by SMS gateway webhook). */
    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'sender'      => ['required', 'string', 'max:60'],
            'body'        => ['required', 'string', 'max:2000'],
            'received_at' => ['nullable', 'date'],
        ]);

        $row = $this->parser->ingest(
            $user->ownerScope(),
            $data['sender'],
            $data['body'],
            isset($data['received_at']) ? \Carbon\Carbon::parse($data['received_at']) : null
        );

        AuditService::log('sms_inbox_ingest', $row, ['provider' => $row->provider, 'status' => $row->status]);
        return response()->json($row, 201);
    }

    /** Manually link an SMS row to a specific payment. */
    public function match(Request $request, PaymentSmsInbox $sms)
    {
        $this->authorize($request, $sms);
        $data = $request->validate(['payment_id' => ['required', 'exists:payments,id']]);

        $payment = Payment::with('lease')->findOrFail($data['payment_id']);
        abort_unless($payment->lease?->owner_id === $request->user()->ownerScope(), 403);

        $sms->update(['status' => 'matched', 'matched_payment_id' => $payment->id]);
        if (in_array($payment->verification_status, ['pending', 'manual_review', 'pending_info'])) {
            $payment->update(['verification_status' => Payment::STATUS_AUTO_VERIFIED]);
            $payment->invoice?->recalcBalance();
        }

        AuditService::log('sms_inbox_match', $sms, ['payment_id' => $payment->id]);
        return response()->json($sms->fresh()->load('payment'));
    }

    public function ignore(Request $request, PaymentSmsInbox $sms)
    {
        $this->authorize($request, $sms);
        $sms->update(['status' => 'ignored']);
        AuditService::log('sms_inbox_ignore', $sms, []);
        return response()->json($sms->fresh());
    }

    public function destroy(Request $request, PaymentSmsInbox $sms)
    {
        $this->authorize($request, $sms);
        AuditService::log('sms_inbox_delete', $sms, []);
        $sms->delete();
        return response()->json(['ok' => true]);
    }

    protected function authorize(Request $request, PaymentSmsInbox $sms): void
    {
        abort_unless($sms->owner_id === $request->user()->ownerScope(), 403);
    }
}
