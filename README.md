# Backend API

Express + SQLite backend for auth.

## Setup

1. Install dependencies:
   npm install
2. (Optional) copy env file:
   cp .env.example .env
3. Start dev server:
   npm run dev

The API runs on http://localhost:4000 by default.

Recommended local port layout for the shared-login setup:

- Main frontend: `http://localhost:3000`
- Main backend: `http://localhost:4000`
- Classroom frontend: `http://localhost:3100`
- Classroom backend: `http://localhost:4100`

## Endpoints

- GET /api/health
- POST /api/auth/signup
  - body: { "name": string, "email": string, "password": string }
- POST /api/auth/login
  - body: { "email": string, "password": string }
- GET /api/auth/me
- POST /api/auth/logout

`/api/auth/login` now sets an HTTP-only auth cookie for cross-subdomain SSO.

## Required Env For Subdomains

- `CORS_ORIGIN`: comma-separated list of allowed frontend origins, for example:
   - `https://main.example.com,https://classroom.example.com,https://code.example.com`
- `AUTH_JWT_SECRET`: shared JWT signing secret
- `AUTH_COOKIE_NAME`: cookie key, default `sso_token`
- `AUTH_COOKIE_DOMAIN`: parent domain for all subdomains, for example `.example.com`
- `AUTH_COOKIE_SECURE`: `true` in production (HTTPS)
- `AUTH_COOKIE_SAMESITE`: usually `none` for cross-site frontend calls, otherwise `lax`
- `AUTH_COOKIE_MAX_AGE_MS`: cookie lifetime in milliseconds
- `AUTH_TOKEN_TTL`: JWT lifetime, e.g. `7d`

## Database

SQLite file: data.sqlite (created automatically in backend folder).
