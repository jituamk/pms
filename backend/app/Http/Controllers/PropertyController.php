<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Property::orderByDesc('id')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);

        $property = Property::create($data);

        return response()->json(['data' => $property], 201);
    }

    public function show(Property $property): JsonResponse
    {
        return response()->json(['data' => $property]);
    }

    public function update(Request $request, Property $property): JsonResponse
    {
        $data = $this->validateData($request);
        $property->update($data);

        return response()->json(['data' => $property]);
    }

    public function destroy(Property $property): JsonResponse
    {
        $property->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'name'    => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'city'    => ['required', 'string', 'max:255'],
            'type'    => ['required', 'in:apartment,house,commercial,land'],
            'units'   => ['required', 'integer', 'min:1'],
            'rent'    => ['required', 'numeric', 'min:0'],
            'status'  => ['required', 'in:available,occupied,maintenance'],
        ]);
    }
}
