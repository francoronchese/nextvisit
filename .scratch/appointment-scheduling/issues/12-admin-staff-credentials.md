# 12 — Admin: staff credentials

**What to build:** The admin creates login credentials (email + password) for secretaries and doctors so they can access the admin panel.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] `POST /api/admin/users` creates a new staff user with role (secretary/doctor)
- [ ] `GET /api/admin/users` lists all staff users
- [ ] Password hashed before storage
- [ ] UI: user management form in `features/admin/` — create, list
- [ ] Service-layer unit tests: user creation, duplicate email rejected
- [ ] API contract test: admin creates user, user can log in
