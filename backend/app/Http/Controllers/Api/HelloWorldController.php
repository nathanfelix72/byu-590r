<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class HelloWorldController extends Controller
{
    /**
     * Simple hello world endpoint
     */
    public function hello(): JsonResponse
    {
        return response()->json([
            'message' => 'Hello World from BYU 590R Monorepo!',
            'status' => 'success',
            'timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Health check endpoint
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'service' => 'byu-590r-monorepo-backend',
            'version' => '1.0.0',
            'timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Test S3 file operations (save and delete)
     */
    public function testS3(): JsonResponse
    {
        try {
            $bucketName = env('S3_BUCKET', 'byu-590r-' . time() . '-fallback');
            
            if (empty($bucketName)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'S3 bucket not configured',
                    'bucket' => null,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            $testFileName = 'test-file-' . time() . '.txt';
            $testContent = 'This is a test file for BYU 590R S3 operations. Created at: ' . now()->toISOString();
            
            // Test file upload to S3
            $uploadResult = Storage::disk('s3')->put($testFileName, $testContent);
            
            if (!$uploadResult) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Failed to upload file to S3',
                    'bucket' => $bucketName,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            $fileExists = Storage::disk('s3')->exists($testFileName);
            
            if (!$fileExists) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'File upload succeeded but file not found in S3',
                    'bucket' => $bucketName,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            // Test file download from S3
            $downloadedContent = Storage::disk('s3')->get($testFileName);
            
            if ($downloadedContent !== $testContent) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Downloaded content does not match uploaded content',
                    'bucket' => $bucketName,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            // Test file deletion from S3
            $deleteResult = Storage::disk('s3')->delete($testFileName);
            
            if (!$deleteResult) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Failed to delete file from S3',
                    'bucket' => $bucketName,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            $fileStillExists = Storage::disk('s3')->exists($testFileName);
            
            if ($fileStillExists) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'File deletion succeeded but file still exists in S3',
                    'bucket' => $bucketName,
                    'timestamp' => now()->toISOString()
                ], 500);
            }
            
            return response()->json([
                'status' => 'success',
                'message' => 'S3 operations completed successfully',
                'operations' => [
                    'upload' => 'success',
                    'download' => 'success',
                    'delete' => 'success'
                ],
                'bucket' => $bucketName,
                'test_file' => $testFileName,
                'timestamp' => now()->toISOString()
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'S3 test failed: ' . $e->getMessage(),
                'bucket' => env('S3_BUCKET', 'byu-590r-fallback'),
                'timestamp' => now()->toISOString()
            ], 500);
        }
    }
}
