# Sprint 6 — Security and privacy review

## Scope and evidence

Reviewed the current authentication controllers/routes and user model, token middleware, report upload middleware/controller/routes, report and plan ownership queries, OTP routes, environment validation, request/error logging, and the Sprint 5 implementation notes. This is a source review, not a penetration test. No real account, report, or health data was used.

## Changes made

- OTP request responses include `dev_otp` only in `development` and `test`. A `staging` environment no longer receives an authentication or password-reset code in the HTTP response.
- Password reset now increments `tokenVersion` while clearing refresh sessions. Existing access tokens fail the token-version check after a password change.
- Logout-all now increments `tokenVersion` as well as clearing refresh sessions. Per-device logout revokes the refresh token; already-issued access tokens remain valid only until their short expiry.

## Verified controls in the current source

- Passwords are stored with bcrypt using 12 salt rounds; the password hash is excluded from default Mongoose selection.
- Access and refresh tokens use separate configured secrets, HS256 verification, access tokens defaulting to 15 minutes and refresh sessions to 7 days. Refresh tokens are stored as SHA-256 hashes, rotated on refresh, and limited to five sessions.
- Cookies are HTTP-only for the refresh token, `SameSite=Strict`, and `Secure` in production. Logout removes the corresponding refresh-token hash; logout-all and password-reset revoke all token versions.
- Protected routes validate the access token and, outside tests, resolve an active database user and verify `tokenVersion`.
- Report upload routes authenticate before file handling; uploads are limited to one 10 MB PDF/JPEG/PNG, checked against file signatures, staged with restricted directory permissions, quota-limited per user, and cleaned up after transfer.
- Report reads, review, delete, diet-plan reads, grocery reads, and meal-plan reads include the authenticated user ID in database filters. Report outputs omit encrypted raw OCR text.
- OTPs are bcrypt-hashed, short-lived, attempt-limited, single-use, and protected by a rate limiter. Password-reset tokens are random, hashed, short-lived, single-use, and now revoke issued access and refresh tokens.
- Application logging uses an allowlist of operational metadata; request logs omit bodies and headers. The error handler returns generic 5xx errors in production and includes a request ID.

## Remaining risks and limitations

- Existing test-mode auth middleware intentionally accepts synthetic JWT identities without loading a database user. Keep test-only configuration isolated from staging/production.
- Single-device logout cannot revoke a stateless access token immediately without a per-token denylist; it remains usable until expiry. Logout-all and password reset now invalidate access tokens through `tokenVersion`.
- Staging must use `NODE_ENV=production` security semantics or equivalent hardened configuration; this change specifically prevents OTP disclosure outside `development`/`test`.
- Object ownership is covered by user-scoped queries in the inspected plan and report controllers, but no full authorization fuzz/penetration test was run.
- Upload signature checks establish file type only; they do not guarantee that a PDF/image is benign. OCR runs in a separately bounded processing path.
- No cloud storage, live MongoDB, live Redis, email provider, or production deployment was exercised in this audit.

## Validation

Regression coverage was added for withholding OTPs in staging and for token-version revocation after password reset. The focused OTP suite could not start in this Windows execution context because Node's test runner failed to spawn its worker (`spawn EPERM`). The changes therefore require rerunning the OTP suite in the permitted test execution context before beta sign-off. No secrets or user data were written to this document.
