<?php

return [
    'provider' => env('IMAGE_GENERATION_PROVIDER', 'openai'),
    'api_key' => env('IMAGE_GENERATION_API_KEY'),
    'storage_disk' => env('IMAGE_GENERATION_STORAGE_DISK', 's3'),
];
