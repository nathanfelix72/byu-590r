<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class S3Test extends TestCase
{
    /**
     * Test S3 file operations endpoint
     */
    public function test_s3_operations_endpoint(): void
    {
        // Mock the S3 disk to avoid actual S3 calls during testing
        Storage::fake('s3');
        
        $response = $this->get('/api/test-s3');
        
        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'success',
            'message' => 'S3 operations completed successfully',
            'operations' => [
                'upload' => 'success',
                'download' => 'success',
                'delete' => 'success'
            ]
        ]);
        
        $responseData = $response->json();
        $this->assertArrayHasKey('bucket', $responseData);
        $this->assertArrayHasKey('test_file', $responseData);
        $this->assertArrayHasKey('timestamp', $responseData);
    }

    /**
     * Test S3 operations with real S3 (integration test)
     * This test will only run if AWS credentials are configured
     */
    public function test_s3_operations_with_real_s3(): void
    {
        // Skip this test if AWS credentials are not configured
        if (!env('AWS_ACCESS_KEY_ID') || !env('AWS_SECRET_ACCESS_KEY') || !env('S3_BUCKET')) {
            $this->markTestSkipped('AWS credentials not configured for S3 integration test');
        }
        
        $response = $this->get('/api/test-s3');
        
        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'success',
            'message' => 'S3 operations completed successfully',
            'operations' => [
                'upload' => 'success',
                'download' => 'success',
                'delete' => 'success'
            ]
        ]);
        
        $responseData = $response->json();
        $this->assertArrayHasKey('bucket', $responseData);
        $this->assertEquals(env('S3_BUCKET', '590r'), $responseData['bucket']);
        $this->assertArrayHasKey('test_file', $responseData);
        $this->assertArrayHasKey('timestamp', $responseData);
    }

    /**
     * Test S3 operations failure handling
     */
    public function test_s3_operations_without_credentials(): void
    {
        // Temporarily clear AWS credentials and bucket
        $originalKey = env('AWS_ACCESS_KEY_ID');
        $originalSecret = env('AWS_SECRET_ACCESS_KEY');
        $originalBucket = env('S3_BUCKET');
        
        config(['filesystems.disks.s3.key' => '']);
        config(['filesystems.disks.s3.secret' => '']);
        config(['filesystems.disks.s3.bucket' => '']);
        
        $response = $this->get('/api/test-s3');
        
        // Should return error status
        $response->assertStatus(500);
        $response->assertJson([
            'status' => 'error'
        ]);
        
        // Restore original credentials
        config(['filesystems.disks.s3.key' => $originalKey]);
        config(['filesystems.disks.s3.secret' => $originalSecret]);
        config(['filesystems.disks.s3.bucket' => $originalBucket]);
    }
}
