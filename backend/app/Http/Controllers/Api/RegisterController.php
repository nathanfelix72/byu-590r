<?php

namespace App\Http\Controllers\Api;

use App\Mail\ForgotPassword;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RegisterController extends BaseController
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|min:1',
            'last_name' => 'required|string|min:1',
            'email' => 'required|email|unique:users,email|min:3',
            'password' => 'required|min:8',
            'password_confirmation' => 'required|same:password|min:8',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $input = $request->all();
        $input['name'] = trim($input['first_name'] . ' ' . $input['last_name']);
        $input['password'] = bcrypt($input['password']);
        unset($input['first_name'], $input['last_name'], $input['password_confirmation']);
        $user = User::create($input);
        Profile::updateOrCreate(['user_id' => $user->id], ['wins' => 0, 'losses' => 0]);
        $token = $user->createToken('MyApp');
        $success['token'] = $token->plainTextToken;
        $success['name'] = $user->name;
        $success['id'] = $user->id;

        return $this->sendResponse($success, 'User register successfully.');
    }

    public function login(Request $request)
    {
        if (Auth::attempt(['email' => $request->email, 'password' => $request->password])) {
            /** @var \App\Models\User $user **/
            $user = Auth::user();
            $user->tokens()->delete();
            $user->remember_token = null;
            $user->save();
            $token = $user->createToken('MyApp');
            $success['token'] = $token->plainTextToken;
            $success['name'] = $user->name;
            $success['id'] = $user->id;
            $success['avatar'] = null;
            if (isset($user->avatar)) {
                $success['avatar'] = $this->getS3Url($user->avatar);
            }

            return $this->sendResponse($success, 'User login successfully.');
        } else {
            return $this->sendError('Unauthorised.', ['error' => 'Unauthorised']);
        }
    }

    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        
        if ($token) {
            $accessToken = \App\Models\PersonalAccessToken::findToken($token);
            if ($accessToken) {
                $accessToken->delete();
            }
        }

        $success = [];
        return $this->sendResponse($success, 'User logout successfully. Token cleared.');
    }

    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email|min:3',
        ]);

        $success = [];
        if ($validator->fails()) {
            return $this->sendResponse($success, '--Check your email for password reset email.');
        }

        $user = User::where('email', $request->email)->first();
        $user = User::findOrFail($user->id);
        $user->remember_token = Str::random(30);
        $user->save();

        Mail::to($user->email)->send(new ForgotPassword($user));

        return $this->sendResponse([], 'Check your email for the password reset link.');
    }

    /** GET: Validate reset token (so frontend can show the "set new password" form). */
    public function passwordReset(Request $request)
    {
        $remember_token = $request->query('remember_token');

        if (!$remember_token) {
            return $this->sendError('Token required.', ['error' => 'Token required'], 422);
        }

        $user = User::where('remember_token', $remember_token)->first();
        if (!$user) {
            return $this->sendError('Token expired or invalid.', ['error' => 'Token expired or invalid'], 422);
        }

        return $this->sendResponse(['valid' => true], 'Token is valid.');
    }

    /** POST: Set new password using the reset token (no second email). */
    public function setNewPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'remember_token' => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation failed.', $validator->errors(), 422);
        }

        $remember_token = $request->input('remember_token');
        $user = User::where('remember_token', $remember_token)->first();
        if (!$user) {
            return $this->sendError('Token expired or invalid.', ['error' => 'Token expired or invalid'], 422);
        }

        $user->password = bcrypt($request->input('password'));
        $user->remember_token = null;
        $user->save();

        return $this->sendResponse([], 'Password updated. You can now sign in with your new password.');
    }
}

