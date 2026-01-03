<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Queue\SerializesModels;

class PasswordReset extends Mailable
{
    use Queueable, SerializesModels;

    protected $newPassword;

    public function __construct($newPassword)
    {
        $this->newPassword = $newPassword;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address('webmaster@localhost.com', 'Webmaster'),
            subject: 'Temp Password Reset Complete!',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.password_reset',
            with: [
                'newPassword' => $this->newPassword
            ]
        );
    }
}

