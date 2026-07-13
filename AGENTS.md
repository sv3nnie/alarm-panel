# AGENTS.md

## Relationship with API Backend

This frontend depends on the **backend API** at `https://github.com/sv3nnie/api` (deployed at `https://api.poggers.win`).

When making frontend changes that touch API calls, **always** cross-check the corresponding backend code in `/Users/fose/repos/api`:

### Endpoint ↔ Backend Mapping

| Frontend call | Backend file |
|---|---|
| `api.getAlarmStatus()` | `api/src/controllers/alarm-controller.js` → `getStatus()` |
| `api.armAlarm()` | `api/src/controllers/alarm-controller.js` → `armAlarm()` |
| `api.disarmAlarm()` | `api/src/controllers/alarm-controller.js` → `disarmAlarm()` |
| `api.verifyPin()` | `api/src/controllers/auth-controller.js` → `verifyPin()` |
| `api.createSSEConnection()` | `api/src/controllers/alarm-controller.js` → `sse()` |

### Verification Steps

Before committing frontend changes:

1. If changing request shape (body, headers, query params), verify the backend route/middleware accepts it in `/Users/fose/repos/api/src/routes/alarm-routes.js`
2. If changing auth flow, verify `/Users/fose/repos/api/src/middleware/alarm-auth.js`
3. If changing rate limit behavior, verify `/Users/fose/repos/api/src/middleware/rate-limit.js`
4. If adding/removing endpoints, verify the backend controller and route definitions
5. Run `npx tsc --noEmit` in both repos

### Auth Model

- Sessions are JWT-based, obtained via `POST /api/auth/pin` with name + PIN
- Token passed as `Authorization: Bearer <token>` header for REST calls
- Token passed as `?token=<token>` query param for SSE (EventSource limitation)
- Token expires after 15 minutes

### CORS

Backend has `cors()` with no origin restriction. The frontend's `NEXT_PUBLIC_API_URL` defaults to `https://api.poggers.win`.
