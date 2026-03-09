# Forgot Password & Reset Password (Milestone 6.2)

## Flow

1. **Forgot password (POST)**  
   User enters email on the login page → “Forgot Password” tab → “Send Reset Link”.  
   Backend validates email exists, sets a `remember_token`, and sends **Email #1** with a link.

2. **Email #1**  
   “Reset my password” link points to the **backend** so the reset runs as soon as they click:  
   `APP_URL/api/password_reset?remember_token=...`  
   (e.g. `http://localhost:8000/api/password_reset?remember_token=...`)

3. **User opens the link**  
   Browser opens that URL. The backend generates a new random password, saves it, clears the token, and sends **Email #2** with the new password. The user then sees a simple HTML page: “Password reset – check your email for your new password” and a “Go to sign in” link to your app.

4. **Email #2**  
   Contains the new temporary password. User signs in on the login page with that password.

## Getting emails in your inbox

By default Laravel uses `MAIL_MAILER=log`, so messages go to `storage/logs/laravel.log`, not to a real inbox.

To see emails in an inbox (for the deliverable):

1. **Option A – Mailtrap (recommended for dev)**  
   - Sign up at [mailtrap.io](https://mailtrap.io).  
   - Create an inbox and copy SMTP credentials.  
   - In `backend/.env` set:

   ```env
   MAIL_MAILER=smtp
   MAIL_HOST=live.smtp.mailtrap.io
   MAIL_PORT=587
   MAIL_USERNAME=your_mailtrap_username
   MAIL_PASSWORD=your_mailtrap_password
   MAIL_ENCRYPTION=tls
   MAIL_FROM_ADDRESS="noreply@yourdomain.com"
   MAIL_FROM_NAME="${APP_NAME}"
   FRONTEND_URL=http://localhost:4200
   ```

2. **Option B – Gmail (use an app password)**  
   - Use a Gmail account and create an [App Password](https://support.google.com/accounts/answer/185833).  
   - In `backend/.env`:

   ```env
   MAIL_MAILER=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=your@gmail.com
   MAIL_PASSWORD=your_16_char_app_password
   MAIL_ENCRYPTION=tls
   MAIL_FROM_ADDRESS="your@gmail.com"
   MAIL_FROM_NAME="${APP_NAME}"
   FRONTEND_URL=http://localhost:4200
   ```

3. **FRONTEND_URL**  
   Must match where the Angular app runs so the link in Email #1 goes to your app (e.g. `http://localhost:4200` in dev).

## Routes

| Method | Route               | Controller method  | Purpose                          |
|--------|---------------------|--------------------|----------------------------------|
| POST   | `/api/forgot_password` | `forgotPassword`   | Submit email, send reset link    |
| GET    | `/api/password_reset`  | `passwordReset`    | Token in query; set new password and email it |

## Deliverable checklist

- [ ] Enter a **valid** email on Forgot Password → success message.  
- [ ] Check inbox → **Email #1** with “Reset my password” link.  
- [ ] Open the link → second email sent.  
- [ ] Check inbox → **Email #2** with the new password (hard string).  
- [ ] Sign in on the login page with that new password.
