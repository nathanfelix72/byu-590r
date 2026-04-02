<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Exception;

class ImageGenerationService
{
    private ?string $apiKey;
    private string $provider;

    public function __construct()
    {
        $this->provider = config('image-generation.provider', 'openai');
        $apiKeyValue = config('image-generation.api_key');
        
        // Ensure we can assign even if null temporarily
        $this->apiKey = $apiKeyValue;

        if (!$this->apiKey) {
            throw new Exception('Image generation API key not configured. Please set IMAGE_GENERATION_API_KEY in your .env file.');
        }
    }

    /**
     * Generate an image and return the provider-hosted URL.
     */
    public function generateImage(string $prompt, string $type = 'game_cover'): string
    {
        if ($this->provider === 'openai') {
            return $this->generateWithOpenAI($prompt, $type);
        } elseif ($this->provider === 'gemini') {
            return $this->generateWithGemini($prompt, $type);
        }

        throw new Exception("Unknown image generation provider: {$this->provider}");
    }

    /**
     * Generate an image and persist it to configured storage.
     *
     * @return string Stored path (not URL)
     */
    public function generateAndStoreImage(string $prompt, string $type = 'game_cover', ?int $sessionId = null): string
    {
        $imageUrl = $this->generateImage($prompt, $type);
        try {
            return $this->storeImageFromUrl($imageUrl, $type, $sessionId);
        } catch (Exception $e) {
            // Keep session creation resilient when storage is temporarily unavailable.
            \Log::warning('Image storage failed; falling back to provider-hosted URL (image will not be in configured storage)', [
                'disk' => $this->resolveStorageDisk(),
                'type' => $type,
                'session_id' => $sessionId,
                'error' => $e->getMessage(),
            ]);
            return $imageUrl;
        }
    }

    /**
     * Resolve a stored path to a public URL for API responses.
     */
    public function storedPathToUrl(string $path): string
    {
        $disk = $this->resolveStorageDisk();
        return Storage::disk($disk)->url($path);
    }

    /**
     * Generate image using OpenAI DALL-E
     */
    private function generateWithOpenAI(string $prompt, string $type): string
    {
        \Log::info('Starting OpenAI image generation', ['prompt' => $prompt, 'type' => $type]);
        
        $response = Http::withToken($this->apiKey)
            ->timeout(60)
            ->post('https://api.openai.com/v1/images/generations', [
                'model' => 'dall-e-3',
                'prompt' => $this->buildPrompt($prompt, $type),
                'n' => 1,
                'size' => '1024x1024',
                'quality' => 'standard',
            ]);

        \Log::info('OpenAI API response', ['status' => $response->status(), 'status_text' => $response->reason()]);

        if (!$response->successful()) {
            \Log::error('OpenAI API error', ['status' => $response->status(), 'body' => $response->body()]);
            throw new Exception('OpenAI API error: ' . $response->body());
        }

        $imageUrl = $response->json('data.0.url');
        \Log::info('Image URL from OpenAI', ['url' => $imageUrl]);

        if (!$imageUrl) {
            \Log::error('No image URL in response', ['response' => $response->body()]);
            throw new Exception('No image URL returned from OpenAI API. Response: ' . $response->body());
        }

        return $imageUrl;
    }

    /**
     * Generate image using Google Gemini
     */
    private function generateWithGemini(string $prompt, string $type): string
    {
        $response = Http::withHeader('x-goog-api-key', $this->apiKey)
            ->post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', [
                'contents' => [
                    [
                        'parts' => [
                            [
                                'text' => $this->buildPrompt($prompt, $type),
                            ]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => 1024,
                ]
            ]);

        if (!$response->successful()) {
            throw new Exception('Gemini API error: ' . $response->body());
        }

        // Note: Gemini API returns text descriptions, not images directly
        // This example is simplified - you'd need to handle differently
        // Consider using image generation models or a different approach

        throw new Exception('Gemini text API does not generate images directly. Use OpenAI or a dedicated image service.');
    }

    /**
     * Build a detailed prompt based on the input and type
     */
    private function buildPrompt(string $prompt, string $type): string
    {
        $basePrompt = $prompt;

        if ($type === 'game_cover') {
            return "Create a vibrant, appealing game cover image for '{$basePrompt}'. The style should be modern and game-related, with bright colors and engaging visuals. Resolution: 1024x1024.";
        } elseif ($type === 'uno_background') {
            return "Create a colorful UNO game board background for '{$basePrompt}'. Include card game elements, numbers, and colors related to UNO. The design should be energetic and fun. Make it suitable for a game background.";
        }

        return $basePrompt;
    }

    /**
     * Download image from URL and store it locally
     */
    private function storeImageFromUrl(string $url, string $type, ?int $sessionId = null): string
    {
        try {
            \Log::info('Downloading image from URL', ['url' => $url]);
            
            $response = Http::timeout(30)->get($url);
            
            if (!$response->successful()) {
                throw new Exception('Failed to download image: HTTP ' . $response->status());
            }
            
            $imageContent = $response->body();
            
            if (empty($imageContent)) {
                throw new Exception('Downloaded image content is empty');
            }
            
            \Log::info('Image downloaded', ['size' => strlen($imageContent)]);

            $disk = $this->resolveStorageDisk();
            $filename = $this->buildFileName($type, $sessionId, $response->header('Content-Type'));
            $path = "generated-images/{$filename}";

            $this->ensureStorageTargetReady($disk, 'generated-images');

            $writeResult = Storage::disk($disk)->put($path, $imageContent, ['visibility' => 'public']);
            if ($writeResult !== true) {
                throw new Exception("Storage write returned false for disk '{$disk}' at path '{$path}'");
            }

            if (!Storage::disk($disk)->exists($path)) {
                throw new Exception("Storage write reported success but file was not found on disk '{$disk}' at path '{$path}'");
            }

            $publicUrl = Storage::disk($disk)->url($path);

            \Log::info('Image stored successfully', [
                'disk' => $disk,
                'path' => $path,
                'url' => $publicUrl,
                'session_id' => $sessionId,
                'type' => $type,
            ]);

            return $path;
        } catch (Exception $e) {
            \Log::error('Failed to store image', ['error' => $e->getMessage()]);
            throw new Exception('Failed to store generated image: ' . $e->getMessage());
        }
    }

    /**
     * Validate local disk target is writable before attempting to store generated files.
     */
    private function ensureStorageTargetReady(string $disk, string $directory): void
    {
        if ($disk !== 'public') {
            return;
        }

        Storage::disk($disk)->makeDirectory($directory);
        $fullPath = Storage::disk($disk)->path($directory);

        if (!is_dir($fullPath)) {
            throw new Exception("Storage directory does not exist: {$fullPath}");
        }

        if (!is_writable($fullPath)) {
            // Best effort in local/dev environments where bind mounts may be restrictive.
            @chmod($fullPath, 0775);
        }

        if (!is_writable($fullPath)) {
            throw new Exception("Storage directory is not writable: {$fullPath}");
        }
    }

    private function resolveStorageDisk(): string
    {
        $configuredDisk = (string) config('image-generation.storage_disk', 's3');
        $disks = (array) config('filesystems.disks', []);
        if (!array_key_exists($configuredDisk, $disks)) {
            return 'public';
        }

        if ($configuredDisk === 's3') {
            $key = (string) config('filesystems.disks.s3.key');
            $bucket = (string) config('filesystems.disks.s3.bucket');
            if ($key === '' || $bucket === '') {
                return 'public';
            }
        }

        return $configuredDisk;
    }

    private function buildFileName(string $type, ?int $sessionId, ?string $contentType): string
    {
        $extension = 'png';
        if (is_string($contentType)) {
            if (str_contains($contentType, 'jpeg') || str_contains($contentType, 'jpg')) {
                $extension = 'jpg';
            } elseif (str_contains($contentType, 'webp')) {
                $extension = 'webp';
            }
        }

        $sessionPart = $sessionId ? "session{$sessionId}" : 'session0';
        return sprintf('%s_%s_%s.%s', $type, $sessionPart, Str::uuid()->toString(), $extension);
    }
}
