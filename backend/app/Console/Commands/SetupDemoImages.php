<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class SetupDemoImages extends Command
{
    protected $signature = 'app:setup-demo-images';

    protected $description = 'Copy demo book images from public/assets/books to storage/app/public/images for local development (no S3).';

    public function handle(): int
    {
        $sourceDir = public_path('assets/books');
        $targetDir = storage_path('app/public/images');

        if (! is_dir($sourceDir)) {
            File::ensureDirectoryExists($sourceDir);
            $this->comment('Created ' . $sourceDir . '. Add demo images (hp1.jpeg, bom.jpg, etc.) for local book covers.');
            File::ensureDirectoryExists($targetDir);
            return self::SUCCESS;
        }

        $files = File::files($sourceDir);
        if (empty($files)) {
            $this->comment('No files in ' . $sourceDir . '. Add demo images for local book covers.');
            File::ensureDirectoryExists($targetDir);
            return self::SUCCESS;
        }

        File::ensureDirectoryExists($targetDir);
        $copied = 0;
        foreach ($files as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $name = $file->getFilename();
            $target = $targetDir . DIRECTORY_SEPARATOR . $name;
            if (File::copy($file->getPathname(), $target)) {
                $copied++;
            }
        }

        $this->info('Copied ' . $copied . ' demo image(s) to storage/app/public/images.');

        // Ensure public/storage -> storage/app/public so /storage/images/... is served
        $linkPath = public_path('storage');
        if (! file_exists($linkPath)) {
            $this->call('storage:link');
        }

        return self::SUCCESS;
    }
}
