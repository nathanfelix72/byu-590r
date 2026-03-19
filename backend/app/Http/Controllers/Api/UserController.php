<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class UserController extends BaseController
{
    public function getUser()
    {
        $authUser = Auth::user();
        $user = User::with('profile')->findOrFail($authUser->id);
        if (!$user->profile) {
            $user->profile = Profile::create(['user_id' => $user->id, 'wins' => 0, 'losses' => 0]);
        }
        $user->avatar = $this->getS3Url($user->avatar);
        return $this->sendResponse($user, 'User');
    }

    public function uploadAvatar(Request $request)
    {
        // If PHP rejected the upload (e.g. over upload_max_filesize), file won't be valid
        $file = $request->file('image');
        if (!$file || !$file->isValid()) {
            $msg = 'The image failed to upload.';
            if ($file && $file->getError() !== UPLOAD_ERR_OK) {
                $msg .= ' ' . $file->getErrorMessage();
            } else {
                $msg .= ' Check that the file is under 5MB and try again (PHP upload limits may apply).';
            }
            return $this->sendError($msg, ['image' => [$msg]], 422);
        }

        $request->validate([
            'image' => [
                'required',
                'file',
                'mimes:jpeg,png,jpg,gif,webp',
                'max:5120', // 5MB
            ],
        ], [
            'image.required' => 'Please select an image to upload.',
            'image.file' => 'The image failed to upload. Check file size (max 5MB) and try again.',
            'image.mimes' => 'The image must be a jpeg, png, gif, or webp file.',
            'image.max' => 'The image may not be larger than 5MB.',
        ]);

        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        $file = $request->file('image');
        $extension = $file->getClientOriginalExtension();
        $image_name = time() . '_' . $authUser->id . '.' . $extension;

        $disk = $this->avatarDisk();
        $path = $file->storeAs('images', $image_name, $disk);

        if (!$path) {
            return $this->sendError('User profile avatar failed to upload!', [], 500);
        }

        if ($disk === 's3') {
            Storage::disk('s3')->setVisibility($path, 'public');
        }

        $user->avatar = $path;
        $user->save();

        $success['avatar'] = $this->getS3Url($path);
        return $this->sendResponse($success, 'User profile avatar uploaded successfully!');
    }

    /** Use S3 when configured, otherwise public disk for local/dev. */
    private function avatarDisk(): string
    {
        $key = config('filesystems.disks.s3.key');
        $bucket = config('filesystems.disks.s3.bucket');
        if (!empty($key) && !empty($bucket)) {
            return 's3';
        }
        return 'public';
    }

    public function removeAvatar()
    {
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        if ($user->avatar) {
            if ($this->avatarDisk() === 's3') {
                Storage::disk('s3')->delete($user->avatar);
            }
            Storage::disk('public')->delete($user->avatar);
        }
        $user->avatar = null;
        $user->save();
        $success['avatar'] = null;
        return $this->sendResponse($success, 'User profile avatar removed successfully!');
    }

    public function changeEmail(Request $request)
    {
        $request->validate([
            'change_email' => 'required|email|unique:users,email|min:3',
        ]);
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        $user->email = $request->change_email;
        $user->save();
        $success['email'] = $user->email;
        return $this->sendResponse($success, 'Email updated.');
    }
}

