<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

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
     * @param string|null $path
     * @param int|null $minutes
     * @return string|null
     */
    public function getS3Url($path, $minutes = 10)
    {
        if (!$path) {
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
            // S3 is not available or configured, fall through to local file check
        }
        
        $filename = basename($path);
        $localPath = public_path("assets/books/{$filename}");
        
        if (file_exists($localPath)) {
            return asset("assets/books/{$filename}");
        }
        
        return null;
    }
}

