# Module 01 — Firebase Phone Authentication

Backend uses the existing Flask layers and the unchanged `NguoiDung` schema.
No migrations are needed. Firebase Admin SDK is already in `backend/requirements.txt`.

## PowerShell

Run from the project root, using the project's Python environment:

```powershell
Set-Location D:\MaNguonMo\LanYenPharmacy
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
$env:SECRET_KEY = python -c "import secrets; print(secrets.token_hex(32))"
$env:FIREBASE_CREDENTIALS_PATH = 'D:\MaNguonMo\LanYenPharmacy\backend\screts\firebase-service-account.json'
$env:FIREBASE_PROJECT_ID = '<your-firebase-project-id>'
$env:AUTH_ALLOWED_ORIGINS = 'http://localhost:5500'
# Local HTTP development only; production must use HTTPS and true.
$env:SESSION_COOKIE_SECURE = 'false'
# DATABASE_URL remains the existing PostgreSQL environment configuration.
Set-Location backend
python -m flask --app run:app run --host 127.0.0.1 --port 5000
```

Use a persistent, randomly generated SECRET_KEY of at least 32 characters in
deployment; changing it invalidates sessions. Do not use the development server
in production. Leave SESSION_COOKIE_SECURE=true in production.
Alternatively use GOOGLE_APPLICATION_CREDENTIALS / Application Default Credentials
instead of FIREBASE_CREDENTIALS_PATH. Credential content is never returned or logged.
The Firebase SDK itself loads credentials at runtime when authentication is requested.

Run isolated tests from `backend`:

```powershell
python -m unittest discover -s tests -v
```

## API contract

Use `credentials: 'include'` for browser requests. Keep the same hostname on local
frontend/backend (e.g. localhost for both); SameSite=Lax requires same-site deployment.
Set AUTH_ALLOWED_ORIGINS to exact trusted frontend origins, separated by commas.
CORS is restricted to these origins, and allows credentials and X-CSRF-Token.

1. `GET /api/auth/me` returns 401 with
   `{"code":"UNAUTHENTICATED","csrf_token":"..."}` before login.
   Save the CSRF token and accept the session cookie.
2. `POST /api/auth/firebase`, JSON `{"id_token":"<Firebase ID token>"}`,
   header `X-CSRF-Token: <token from /me>`.
   - 200 `PROFILE_REQUIRED`: no account/session login is created. Obtain a name
     and repeat the same endpoint with `id_token` and `ho_ten` (nonblank, <=255).
     Backend verifies Firebase again. Refresh expired Firebase ID tokens via the Web SDK.
   - 200 `AUTHENTICATED`: includes `user` and a newly rotated `csrf_token`.
     Use the new CSRF token on subsequent writes. Frontend may navigate home.
   - 401 `INVALID_TOKEN` / `PHONE_AUTH_REQUIRED`.
   - 403 `ACCOUNT_LOCKED` / `FORBIDDEN` / `CSRF_FAILED`.
   - 400 `INVALID_REQUEST`; unknown fields including client phone/role are rejected.
   - 415 `JSON_REQUIRED`.
   - 503 `AUTH_UNAVAILABLE` / `DATABASE_UNAVAILABLE`; retry later.
3. `GET /api/auth/me`: 200 with `user`, `code`, `csrf_token` when authenticated.
   Reads current role/status from PostgreSQL; deleted/locked accounts lose access.
4. `POST /api/auth/logout`: requires X-CSRF-Token and cookie; returns 200
   `{"code":"LOGGED_OUT"}` and clears the session cookie. Frontend should also
   sign out of Firebase to clear its local Firebase state.

User response fields: MaNguoiDung, HoTen, SDT, VaiTro, TrangThai, Email, AnhDaiDien.
Only a verified Firebase phone sign-in token supplies the phone; roles/status are
never accepted from clients. New accounts use VaiTro=0 and TrangThai=False.
Existing account names are not overwritten. ON CONFLICT on the existing SDT
unique constraint handles concurrent registration without changing schema.
Phone matching uses Firebase's international format (e.g. +84901234567) exactly.
Existing local-format SDT data must be reviewed before rollout; this module does
not silently rewrite stored phone numbers or infer country codes.

Session cookie: signed Flask session, HttpOnly, SameSite=Lax, Secure by default,
8-hour absolute expiry (no automatic refresh). Contains only user ID, expiry and
CSRF state; no Firebase token or credentials. Role guards query PostgreSQL each time.
The reusable `require_roles` decorator accepts explicit roles, without inventing a
role hierarchy. No unrelated business endpoints are added.

Flask sessions are signed client cookies. Logout clears the browser cookie;
an already copied cookie remains valid until expiry. Immediate server-side
revocation of copied cookies would need an approved server-side session store.
Firebase revocation/disabled-user checks occur at login, not on every local session
request; PostgreSQL TrangThai is checked on every protected request.

## Verification boundaries

Unit/API tests mock Firebase and repository access, and compile the actual
PostgreSQL conflict statement. They do not read credentials or touch application data.
A real PostgreSQL concurrency test and real Firebase OTP/token verification require
a separately configured test environment; the isolated tests do not prove those
external integrations.

Verified on 2026-11-10: `python -m unittest discover -s tests -v` ran 20 tests,
all passed. Coverage includes token errors, phone-only authentication, profile
completion, account locks, all three roles, validation, CSRF, CORS, secure cookie
flags, tampering, expiry, logout and database error rollback. `git diff --check`
also passed. Real Firebase and PostgreSQL concurrency remain unverified.

SDK reference: https://firebase.google.com/docs/reference/admin/python/firebase_admin.auth
