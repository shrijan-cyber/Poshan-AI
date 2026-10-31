# Email OTP API

Import `docs/postman/PoshanAI-Email-OTP.postman_collection.json` into Postman.

Email OTP remains available for sign-in and password reset. Email verification is disabled in the current MVP; new accounts are marked verified so signup and password login work without a verification step.

Set the collection variables `baseUrl` and `email`, then set `purpose` to one of:

- `login`
- `reset-password`

Run **Request OTP**, then **Verify OTP**. In development, the request test captures `dev_otp` automatically. In production, enter the code received by email. For password reset, verify the code first, then run **Complete Password Reset**; the reset token is single-use and expires after ten minutes.

The API returns a generic request response whether or not an eligible account exists. OTP records contain only a bcrypt hash, expire after `OTP_EXPIRY_MINUTES` (default 5), and are limited to `OTP_MAX_ATTEMPTS` (default 3) incorrect attempts. OTP routes are rate-limited to five requests per IP per 15 minutes.

OTP delivery uses Gmail SMTP when configured; set `GMAIL_USER` and a Gmail app password in `GMAIL_PASS` in any environment that needs OTP email delivery. Retest reminders remain in-app only. Resend email verification is Future Scope / Not in current MVP.

To re-enable verification later: add the Resend dependency; implement `sendVerificationEmail` in `poshanai-backend/src/services/emailVerificationService.js`; configure server-side `RESEND_API_KEY` and `RESEND_FROM`; use `ENABLE_EMAIL_VERIFICATION=true` to make registration create unverified accounts and send a verification message; restore the `verify-email` API purpose and UI; add login gating for unverified users; and restore/update the verification tests and documentation. Existing accounts with `emailVerified: true` will remain verified. Never commit `.env` values.
