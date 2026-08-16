# 07 — Admin auth (staff login)

**What to build:** Staff (secretary, doctor, admin) log in to the admin panel with email and hashed password. The session token is carried by the global HTTP client for authenticated requests.

**Blocked by:** 01

**Status:** ready-for-review

- [x] `POST /api/admin/login` validates credentials and returns a session token
- [x] Password hashed with bcrypt (or equivalent)
- [x] Auth middleware protects all `/api/admin/*` routes except login
- [x] UI: login page in `features/admin/`
- [x] Global HTTP client (`client/src/services/apiClient.ts`) injects staff session token on admin requests
- [x] Service-layer unit tests: valid login returns token, invalid credentials rejected
- [x] API contract test: login flow
