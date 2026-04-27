<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentSmsInbox;
use Carbon\Carbon;

/**
 * Parses inbound mobile-banking SMS bodies (bKash, Nagad, Rocket) and tries to
 * auto-match them to recorded Payment rows using transaction_id + amount.
 *
 * Real-world SMS format examples (text vendors keep changing them, so we
 * keep the patterns liberal — last digits / amount / counterparty phone):
 *
 *   bKash:  "You have received Tk 5,000.00 from 01711xxxxxx. TrxID 8AB9CDEF12 ..."
 *           "Cash In Tk 1500.00 from 017XXXXXXX. TrxID: 8C2D31AB ..."
 *
 *   Nagad:  "You received Tk 2,500.00 from 018XXXXXXXX. TxnID: 7K9LM2 ..."
 *           "Money received Tk 1,200 from 019XXXXXXXX. TXN ID 9NB123 ..."
 *
 *   Rocket: "You have received Tk 3000.00 from 015XXXXXXXX. TxID:R10X9Y8 ..."
 *           "TxID 4P7Q2 received Tk 800 from 015XXXXXXXX ..."
 */
class SmsParserService
{
    /** Detect provider from sender shortcode/body. */
    public function detectProvider(string $sender, string $body): string
    {
        $b = strtolower($body);
        $s = strtolower($sender);

        if (str_contains($s, 'bkash') || str_contains($b, 'bkash') || str_contains($b, 'trxid'))   return 'bkash';
        if (str_contains($s, 'nagad') || str_contains($b, 'nagad') || str_contains($b, 'txnid'))   return 'nagad';
        if (str_contains($s, 'rocket') || str_contains($b, 'rocket') || str_contains($b, 'txid:')) return 'rocket';
        return 'unknown';
    }

    /**
     * Parse a single SMS body and return ['transaction_id', 'amount', 'counterparty_phone'].
     * Any field can be null if not found.
     */
    public function parse(string $body, string $provider): array
    {
        $body = trim(preg_replace('/\s+/', ' ', $body));

        return [
            'transaction_id'     => $this->extractTxnId($body, $provider),
            'amount'             => $this->extractAmount($body),
            'counterparty_phone' => $this->extractPhone($body),
        ];
    }

    protected function extractTxnId(string $body, string $provider): ?string
    {
        // Try provider-specific labels first, then fall back to generic.
        $patterns = match ($provider) {
            'bkash'  => ['/TrxID[:\s]+([A-Z0-9]{6,20})/i', '/Trx\s*ID[:\s]+([A-Z0-9]{6,20})/i'],
            'nagad'  => ['/Txn\s*ID[:\s]+([A-Z0-9]{6,20})/i', '/TXN\s*ID[:\s]+([A-Z0-9]{6,20})/i'],
            'rocket' => ['/TxID[:\s]+([A-Z0-9]{6,20})/i', '/Tx\s*ID[:\s]+([A-Z0-9]{6,20})/i'],
            default  => [],
        };
        // Generic last-resort fallbacks
        $patterns = array_merge($patterns, [
            '/(?:Tr[xn]?\s*ID|TX\s*ID|Reference|Ref)[:\s#]+([A-Z0-9]{6,20})/i',
        ]);

        foreach ($patterns as $p) {
            if (preg_match($p, $body, $m)) {
                return strtoupper(trim($m[1]));
            }
        }
        return null;
    }

    protected function extractAmount(string $body): ?float
    {
        // Matches: "Tk 5,000.00", "Tk. 1500", "BDT 2,500.00", "Taka 800"
        if (preg_match('/(?:Tk\.?|BDT|Taka)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i', $body, $m)) {
            $clean = (float) str_replace(',', '', $m[1]);
            return $clean > 0 ? round($clean, 2) : null;
        }
        return null;
    }

    protected function extractPhone(string $body): ?string
    {
        // Bangladesh mobile: 11 digits starting with 01, optional +880 prefix.
        if (preg_match('/(?:\+?880|0)1[3-9]\d{8}/', $body, $m)) {
            $digits = preg_replace('/\D/', '', $m[0]);
            // Normalize to 11-digit local format starting with 01...
            if (str_starts_with($digits, '880')) $digits = '0' . substr($digits, 3);
            return $digits;
        }
        return null;
    }

    /**
     * Persist an inbound SMS, parse it, and try to auto-match to an existing Payment.
     * Returns the inbox row.
     */
    public function ingest(int $ownerId, string $sender, string $body, ?Carbon $receivedAt = null): PaymentSmsInbox
    {
        $provider = $this->detectProvider($sender, $body);
        $parsed   = $this->parse($body, $provider);

        $row = PaymentSmsInbox::create([
            'owner_id'           => $ownerId,
            'provider'           => $provider,
            'sender'             => $sender,
            'raw_body'           => $body,
            'transaction_id'     => $parsed['transaction_id'],
            'amount'             => $parsed['amount'],
            'counterparty_phone' => $parsed['counterparty_phone'],
            'received_at'        => $receivedAt ?? now(),
            'status'             => $parsed['transaction_id'] ? 'unmatched' : 'unparsed',
            'parse_error'        => $parsed['transaction_id'] ? null : 'No transaction id parsed',
        ]);

        $this->tryMatch($row);
        return $row->fresh();
    }

    /**
     * Try to match an inbox SMS to an existing Payment recorded by tenant/staff.
     * Match rule: same transaction_id (case-insensitive), method ∈ {bkash,nagad,rocket},
     * payment belongs to a lease whose owner is this owner.
     */
    public function tryMatch(PaymentSmsInbox $sms): bool
    {
        if (!$sms->transaction_id || $sms->status === 'matched' || $sms->status === 'ignored') return false;

        $payment = Payment::where('transaction_id', $sms->transaction_id)
            ->whereIn('method', ['bkash', 'nagad', 'rocket'])
            ->whereHas('lease', fn($l) => $l->where('owner_id', $sms->owner_id))
            ->first();

        if (!$payment) return false;

        // Sanity: amount within 1 BDT tolerance (or skip if SMS amount is unknown).
        if ($sms->amount && abs((float) $sms->amount - (float) $payment->amount) > 1.0) {
            return false;
        }

        $sms->update([
            'status'             => 'matched',
            'matched_payment_id' => $payment->id,
        ]);

        // Auto-verify the payment if it isn't already verified/rejected.
        if (in_array($payment->verification_status, ['pending', 'manual_review', 'pending_info'])) {
            $payment->update(['verification_status' => Payment::STATUS_AUTO_VERIFIED]);
            $payment->invoice?->recalcBalance();
        }
        return true;
    }

    /**
     * Try to match a freshly-saved Payment against any unmatched inbox SMS.
     * Called from PaymentController::store / verify.
     */
    public function tryMatchPayment(Payment $payment): ?PaymentSmsInbox
    {
        if (!$payment->transaction_id) return null;
        if (!in_array($payment->method, ['bkash', 'nagad', 'rocket'])) return null;

        $ownerId = $payment->lease?->owner_id;
        if (!$ownerId) return null;

        $sms = PaymentSmsInbox::where('owner_id', $ownerId)
            ->where('transaction_id', $payment->transaction_id)
            ->where('status', 'unmatched')
            ->first();

        if ($sms) {
            $this->tryMatch($sms);
            return $sms->fresh();
        }
        return null;
    }
}
