<?php

namespace App\Http\Controllers\Api;

use App\Mail\ForgotPassword;
use App\Mail\PasswordReset;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RegisterController extends BaseController
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|min:1',
            'email' => 'required|email|unique:users,email|min:3',
            'password' => 'required|min:8',
            'c_password' => 'required|same:password|min:8',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors());
        }

        $input = $request->all();
        $input['password'] = bcrypt($input['password']);
        $user = User::create($input);
        $token = $user->createToken('MyApp');
        $success['token'] = $token->plainTextToken;
        $success['name'] = $user->name;

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

        $success['remember_token'] = $user->remember_token;
        return $this->sendResponse($success, '++Check your email for password reset email.');
    }

    public function passwordReset(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'remember_token' => 'required',
            'setPassword' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return $this->sendResponse([], 'Check your email for password reset email.');
        }

        $remember_token = $request['remember_token'];

        if (!$remember_token) {
            return $this->sendError('Token Expired or Incorrect.', ['error' => 'Token Expired or Incorrect']);
        }
        $user = User::where('remember_token', $remember_token)->first();
        if (!$user) {
            return $this->sendError('Token Expired or Incorrect.', ['error' => 'Token Expired or Incorrect']);
        }
        $user = User::find($user->id);
        $newPassword = $request['setPassword'];
        if (!$request['setPassword']) {
            $newPassword = Str::random(8);
        }

        $user->password = bcrypt($newPassword);
        $user->remember_token = null;
        $user->save();

        if ($request['setPassword']) {
            return $this->sendResponse([], 'Password Reset Successfully!');
        }
        Mail::to($user->email)->send(new PasswordReset($newPassword));

        return 'Password Reset Complete! Email Sent with a Temp New Password!';
    }

    public function verifyEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email|min:3',
        ]);

        if ($validator->fails()) {
            return $this->sendResponse([], 'Email could not be verified');
        }

        $email = $request['email'];

        if (!$email) {
            return $this->sendError('Email Expired or Incorrect.', ['error' => 'Email Expired or Incorrect']);
        }
        $user = User::where('email', $email)->first();
        if (!$user) {
            return $this->sendError('Email Expired or Incorrect.', ['error' => 'Email Expired or Incorrect']);
        }

        $user = User::findOrFail($user->id);
        $user->email_verified_at = now();
        $user->save();

        return Redirect::to(env('FRONTEND_URL', 'http://localhost:4200') . '/home');
    }
}

