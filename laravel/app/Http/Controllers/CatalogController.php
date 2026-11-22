<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Unit;
use App\Models\Warranty;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CatalogController extends Controller
{
    public function categories(): View
    {
        $categories = Category::query()->withCount('products')->orderBy('name')->get();
        return view('catalog.categories', compact('categories'));
    }

    public function storeCategory(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
        ]);
        $category = Category::query()->create($data + ['status' => true]);

        if ($request->expectsJson()) {
            return response()->json($category, 201);
        }

        return back()->with('success', 'Category added.');
    }

    public function destroyCategory(Category $category): RedirectResponse
    {
        $category->delete();
        return back()->with('success', 'Category deleted.');
    }

    public function brands(): View
    {
        $brands = Brand::query()->withCount('products')->orderBy('name')->get();
        return view('catalog.brands', compact('brands'));
    }

    public function storeBrand(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:100']]);
        $brand = Brand::query()->create($data + ['status' => true]);

        if ($request->expectsJson()) {
            return response()->json($brand, 201);
        }

        return back()->with('success', 'Brand added.');
    }

    public function destroyBrand(Brand $brand): RedirectResponse
    {
        $brand->delete();
        return back()->with('success', 'Brand deleted.');
    }

    public function warranties(): View
    {
        $units = Unit::query()->orderBy('name')->get();
        $warranties = Warranty::query()->orderBy('name')->get();
        return view('catalog.warranties', compact('units', 'warranties'));
    }

    public function storeUnit(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:50'], 'description' => ['nullable', 'string']]);
        $unit = Unit::query()->create($data + ['status' => true]);

        if ($request->expectsJson()) {
            return response()->json($unit, 201);
        }

        return back()->with('success', 'Unit added.');
    }

    public function storeWarranty(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:100'], 'duration' => ['nullable', 'string', 'max:50']]);
        if (empty($data['duration'])) {
            $data['duration'] = $data['name'];
        }
        $warranty = Warranty::query()->create($data + ['status' => true]);

        if ($request->expectsJson()) {
            return response()->json($warranty, 201);
        }

        return back()->with('success', 'Warranty option added.');
    }
}
