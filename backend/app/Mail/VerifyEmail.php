<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Queue\SerializesModels;

class VerifyEmail extends Mailable
{
    use Queueable, SerializesModels;

    protected $email;

    public function __construct($email)
    {
        $this->email = $email;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address('webmaster@localhost.com', 'Webmaster'),
            subject: 'Verify Email',
        );
    }

    public function content(): Content
    {
        $base_url = env('APP_URL', 'http://127.0.0.1:8000');
        if (env('APP_ENV') === 'local') {
            $base_url = 'http://127.0.0.1:8000';
        }
        return new Content(
            view: 'mail.verify_email',
            with: [
                'base_url' => $base_url,
                'email' => $this->email
            ]
        );
    }
}

