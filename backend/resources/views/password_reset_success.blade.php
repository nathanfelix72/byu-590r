<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password reset</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 1rem; text-align: center; }
        a { color: #1976d2; }
        .btn { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; background: #1976d2; color: #fff; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Password reset</h1>
    <p>Your password has been reset. Check your email for your new password.</p>
    <p>Use that password to sign in, then you can change it from your account if you like.</p>
    <a href="{{ $login_url }}" class="btn">Go to sign in</a>
</body>
</html>
