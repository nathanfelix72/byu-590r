<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class BaseController extends Controller
{
    public function sendResponse($result, $message)
    {
        $response = [
            'success' => true,
            'results' => $result,
            'message' => $message,
        ];

        return response()->json($response, 200);
    }

    public function sendError($error, $errorMessages = [], $code = 404)
    {
        $response = [
            'success' => false,
            'message' => $error,
        ];

        if (!empty($errorMessages)) {
            $response['data'] = $errorMessages;
        }

        return response()->json($response, $code);
    }

    /**
     * Resolve a stored file path to a URL. Uses local storage (demo images) when
     * FILESYSTEM_DISK=local or S3 is not configured; otherwise uses S3.
     *
     * @param string|null $path Storage path (e.g. "images/hp1.jpeg")
     * @param int|null $minutes Minutes for S3 temporary URL (null = public URL)
     * @return string|null
     */
    public function getS3Url($path, $minutes = 10)
    {
        if (!$path) {
            return null;
        }

        // Local: serve from storage/app/public (e.g. demo images from backend/public/assets/books)
        if ($this->useLocalStorageForImages()) {
            if (Storage::disk('public')->exists($path)) {
                return asset('storage/' . $path);
            }
            return null;
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $s3 */
        $s3 = Storage::disk('s3');
        try {
            if ($s3->exists($path)) {
                if ($minutes === null) {
                    $s3->setVisibility($path, "public");
                    // @phpstan-ignore-next-line - url() method exists on S3 adapter at runtime
                    return $s3->url($path);
                }
                // @phpstan-ignore-next-line - temporaryUrl() method exists on S3 adapter at runtime
                return $s3->temporaryUrl($path, now()->addMinutes($minutes));
            }
        } catch (\Exception $e) {
            Log::error('S3 URL generation failed: ' . $e->getMessage());
            return null;
        }

        return null;
    }

    /**
     * Whether to resolve image URLs from local storage (public disk) instead of S3.
     */
    protected function useLocalStorageForImages(): bool
    {
        if (in_array(config('filesystems.default'), ['local', 'development', 'dev'], true)) {
            return true;
        }
        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');
        return empty($key) || empty($bucket);
    }
}

