<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Queue\SerializesModels;

class ForgotPassword extends Mailable
{
    use Queueable, SerializesModels;

    protected $user;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(config('mail.from.address'), config('mail.from.name')),
            subject: 'Reset your password',
        );
    }

    public function content(): Content
    {
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:4200'), '/');
        $resetUrl = $frontendUrl . '/reset-password?remember_token=' . urlencode($this->user->remember_token);
        return new Content(
            view: 'mail.forgot_password',
            with: [
                'reset_url' => $resetUrl,
                'user' => $this->user
            ]
        );
    }
}

