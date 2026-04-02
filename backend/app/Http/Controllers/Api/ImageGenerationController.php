<?php

namespace App\Http\Controllers\Api;

use App\Services\ImageGenerationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ImageGenerationController extends BaseController
{
    public function __construct(private ImageGenerationService $imageGenerationService)
    {
    }

    /**
     * Generate a game session cover image
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function generateSessionCover(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'title' => 'required|string|max:100',
                'description' => 'nullable|string|max:500',
            ]);

            $prompt = $validated['title'];
            if ($validated['description']) {
                $prompt .= ' - ' . $validated['description'];
            }

            \Log::info('Generating session cover for', ['title' => $validated['title']]);
            $storedPath = $this->imageGenerationService->generateAndStoreImage($prompt, 'game_cover');
            $imageUrl = $this->imageGenerationService->storedPathToUrl($storedPath);
            \Log::info('Session cover generated', ['url' => $imageUrl]);

            return $this->sendResponse(
                ['image_url' => $imageUrl],
                'Game session cover generated successfully'
            );
        } catch (\Exception $e) {
            \Log::error('Image generation error', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->sendError(
                'Image generation failed',
                $e->getMessage(),
                500
            );
        }
    }

    /**
     * Generate an UNO board background image
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function generateUnoBoardBackground(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'theme' => 'required|string|max:100',
                'description' => 'nullable|string|max:500',
            ]);

            $prompt = $validated['theme'];
            if ($validated['description']) {
                $prompt .= ' - ' . $validated['description'];
            }

            $storedPath = $this->imageGenerationService->generateAndStoreImage($prompt, 'uno_background');
            $imageUrl = $this->imageGenerationService->storedPathToUrl($storedPath);

            return $this->sendResponse(
                ['image_url' => $imageUrl],
                'UNO board background generated successfully'
            );
        } catch (\Exception $e) {
            return $this->sendError(
                'Image generation failed',
                $e->getMessage(),
                500
            );
        }
    }
}
