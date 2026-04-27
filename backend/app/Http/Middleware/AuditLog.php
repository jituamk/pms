<?php

namespace App\Http\Middleware;

use App\Services\AuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditLog
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Log mutating verbs only; reads are usually too noisy
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            AuditService::log(
                action: $request->method() . ' ' . $request->path(),
                changes: ['status' => $response->getStatusCode()]
            );
        }

        return $response;
    }
}
