# API Contract — Auth App (AWS)

This document specifies the backend API contract, DynamoDB schema, token strategy, and deployment notes for the Expo frontend.

It aligns with the frontend scaffold in `src/services/*` and is intended for Lambda + API Gateway + DynamoDB implementation.

---

## High-level auth flow

- Registration (client):
  1. Client verifies phone via Firebase (returns Firebase ID token).
  2. Client POSTs `/auth/register` with user fields + Firebase ID token + terms selections.
  3. Backend verifies Firebase token using Firebase Admin SDK, creates a user record, stores terms, creates a session (refresh token), and issues access + refresh tokens.

- Login:
  1. Client POSTs `/auth/login` with username/email + password.
  2. Backend validates password (bcrypt), records lastLoginAt, creates session, issues tokens.

- Token Refresh:
  1. Client POSTs `/auth/refresh` with refresh token.
  2. Backend validates refresh token against Sessions table, rotates refresh token (issue new refresh token, mark old as revoked), returns new access token (and optionally new refresh token).

- Logout:
  1. Client POSTs `/auth/logout` with refresh token (or Authorization header).
  2. Backend revokes session (mark revoked) and optionally deletes session.

- Terms:
  - GET `/terms` — returns current terms list
  - POST `/user/terms` — record user's accepted/declined selections (no timestamps required by frontend requirement).

---

## Authentication scheme

- Access Token: JWT (RS256 preferred) with short expiry (recommended 15 minutes).
  - Claims: `sub` (userId), `iat`, `exp`, `scope` (optional), `kid` (if using key rotation).

- Refresh Token: long opaque token (random string), stored hashed (e.g., HMAC or bcrypt) in `Sessions` table.
  - Expiry: e.g., 14–30 days.
  - Rotation: on refresh, issue a new refresh token and set the old token as `rotated`/`revoked` to detect reuse.

- Transport: Always over HTTPS (API Gateway TLS). Client sends `Authorization: Bearer <accessToken>` header for protected routes. For refresh/logout the client posts the `refreshToken` in the body.

---

## Endpoints

All endpoints are under an API Gateway base URL — `https://{api}.execute-api.{region}.amazonaws.com/prod` (example). Replace with `EXPO_PUBLIC_API_BASE_URL` on the frontend.

### POST /auth/register

- Purpose: Create a new user after Firebase phone verification. Issue tokens and create a session.
- Auth: none (client provides Firebase ID token for phone verification).
- Body (application/json):
  {
    "name": "string",
    "email": "string",
    "password": "string",
    "phone": "+919999999999",
    "firebaseIdToken": "string",
    "termsSelections": [{ "termId": "terms-service", "accepted": true }, ...]
  }
- Responses:
  - 201 Created
    {
      "user": { "userId": "uuid", "name": "...", "email": "...", "phone": "..." },
      "tokens": { "accessToken": "jwt", "refreshToken": "opaque" },
      "expiresIn": 900
    }
  - 400 Bad Request — invalid input
  - 401 Unauthorized — Firebase token invalid or phone mismatch
  - 409 Conflict — email or phone already exists
  - 500 Internal Server Error

### POST /auth/login

- Purpose: Authenticate with username/email and password.
- Auth: none
- Body:
  {
    "usernameOrEmail": "string",
    "password": "string"
  }
- Responses:
  - 200 OK (same payload shape as register: user + tokens)
  - 400 Bad Request
  - 401 Unauthorized — invalid credentials

### POST /auth/refresh

- Purpose: Exchange a valid refresh token for new access token (and rotated refresh token).
- Auth: none (refresh token in body)
- Body:
  {
    "refreshToken": "opaque"
  }
- Flow:
  - Lookup hashed refresh token in `Sessions` table.
  - If found and not revoked and not expired — issue new access token and new refresh token, store hashed new refresh token and mark old as revoked.
  - If reuse detected (old refresh token used twice) — revoke all sessions for user and require re-login.
- Responses:
  - 200 OK: { "accessToken": "jwt", "refreshToken": "opaque", "expiresIn": 900 }
  - 401 Unauthorized — invalid/expired token

### POST /auth/logout

- Purpose: Revoke the session / refresh token
- Auth: optional bearer access token; body may include refreshToken
- Body:
  { "refreshToken": "opaque" }
- Responses:
  - 200 OK
  - 400 Bad Request

### GET /terms

- Purpose: Retrieve current Terms list for showing modal
- Auth: optional
- Response:
  - 200 OK: { "terms": [{ "termId": "string", "title": "string", "text": "string", "mandatory": true|false }, ...] }

### POST /user/terms

- Purpose: Record user's selections for terms
- Auth: Bearer access token required
- Body:
  {
    "userId": "string",
    "accepted": [{ "termId": "string", "accepted": true|false }, ...]
  }
- Response: 200 OK
- Notes: Frontend does not require timestamps for each item. For auditing you may store `acceptedAt` or `version` if needed.

### GET /user/profile

- Purpose: Return current user's profile
- Auth: Bearer access token
- Response: 200 OK: { "user": { ... } }

### GET /user/sessions (optional)

- Purpose: Device/session management (list active sessions)
- Auth: Bearer
- Response: 200 OK: { "sessions": [{ sessionId, createdAt, userAgent, ip, lastActiveAt, revoked }, ...] }

---

## DynamoDB schema (suggested)

Note: Use separate tables with clear PK/SK designs. Examples below are simplified.

### Users table
- Table: `Users`
- PK: `userId` (string — UUID)
- Attributes: `email` (string), `username` (string, optional), `phone` (string), `name` (string), `passwordHash` (string, nullable if Firebase-only), `createdAt`, `lastLoginAt`
- GSIs:
  - `emailIndex` — PK: `email`
  - `phoneIndex` — PK: `phone`

### Sessions table
- Table: `Sessions`
- PK: `refreshTokenId` (string — UUID or hashed id)
- Attributes: `userId`, `refreshTokenHash`, `expiresAt` (number — epoch), `createdAt`, `lastActiveAt`, `revoked` (bool), `userAgent`, `ip`
- TTL: set on `expiresAt` if you want auto-expiration

### Terms table
- Table: `Terms`
- PK: `termId` (string)
- Attributes: `title`, `text`, `mandatory`, `version`

### UserTerms table
- Table: `UserTerms`
- PK: `userId` (string)
- SK: `termId` (string)
- Attributes: `accepted` (bool), `version` (optional)

Alternative: store `acceptedTerms` as a map attribute on the `Users` item for simpler queries (but harder to audit).

---

## Lambda responsibilities (per route)

- auth/register
  - Validate input
  - Verify Firebase ID token with Firebase Admin SDK, ensure `phone_number` matches
  - Check for duplicate email/phone
  - Hash password with bcrypt
  - Create `Users` record
  - Create session (generate secure refresh token, hash & store)
  - Issue JWT access token (RS256) and return both tokens

- auth/login
  - Find user by email/username via GSI
  - Compare password with bcrypt
  - Create session, issue tokens, update `lastLoginAt`

- auth/refresh
  - Validate refresh token lookup in `Sessions`
  - Ensure token not revoked and not expired
  - Rotate refresh token (store new hashed token, revoke old)
  - Issue new access token

- auth/logout
  - Mark session revoked (or delete session record)

- terms (GET)
  - Return terms list from `Terms` table

- user/terms (POST)
  - Validate user (from access token)
  - Upsert records in `UserTerms` or update `Users.acceptedTerms`

- user/profile
  - Return user entry from `Users` table (omit passwordHash)

---

## Security notes and best practices

- Use RS256 JWTs. Keep the private key in AWS Secrets Manager; make public key available to other services if needed.
- Store refresh tokens in `Sessions` table in hashed form (use HMAC or bcrypt). Keep the full plaintext token only in the client.
- Use least-privilege IAM roles for Lambdas: allow read/write only on the required DynamoDB tables and read-only access to specific Secrets Manager ARNs.
- Validate all inputs with a schema lib (Zod/Joi). Protect against injection attacks.
- Add API Gateway throttling to reduce brute-force/password guessing.
- Enable CloudWatch Logs + X-Ray for observability.

---

## Environment variables for Lambdas

- `FIREBASE_SERVICE_ACCOUNT` — JSON for Firebase Admin (store in Secrets Manager or encrypted param store)
- `JWT_PRIVATE_KEY_SECRET_ARN` — ARN of Secrets Manager secret holding your RSA private key (or symmetric secret)
- `JWT_ISSUER` — token issuer
- `JWT_AUDIENCE` — expected audience
- `ACCESS_TOKEN_EXPIRES_SECONDS` — e.g., 900
- `REFRESH_TOKEN_EXPIRES_SECONDS` — e.g., 1209600 (14 days)
- `DYNAMO_USERS_TABLE`, `DYNAMO_SESSIONS_TABLE`, `DYNAMO_TERMS_TABLE`, `DYNAMO_USER_TERMS_TABLE`

---

## Example token generation and verification

- Use `jsonwebtoken` or `jose` in Lambda for signing/verifying.
- Sign with RS256: `jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '15m', issuer, audience, keyid })`
- Verify access tokens for protected routes: `jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer, audience })`

---

## Deployment notes (quick)

- IaC (recommended): Use AWS SAM or CDK to define DynamoDB tables, Lambda functions, IAM roles and API Gateway.
- Secrets: store private keys and Firebase service account JSON in Secrets Manager and grant Lambda roles access to the specific secret ARNs.
- CI: Use GitHub Actions to run tests and deploy SAM stack via `sam deploy` or CDK via `cdk deploy` (use OIDC or stored credentials)

---

## Examples (curl)

Register (example):

```bash
curl -X POST "${API_BASE}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Alice",
    "email":"alice@example.com",
    "password":"password123",
    "phone":"+919999999999",
    "firebaseIdToken":"<firebase-id-token>",
    "termsSelections":[{"termId":"terms-service","accepted":true}]
  }'
```

Login (example):

```bash
curl -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"alice@example.com","password":"password123"}'
```

Refresh (example):

```bash
curl -X POST "${API_BASE}/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<opaque-refresh-token>"}'
```

---

If you'd like, I can also:
- generate a SAM template skeleton for these routes and tables,
- scaffold Lambda handler code (Node/TypeScript) for `/auth/register` and `/auth/login`, or
- create a separate `docs/sequence_diagram.svg` showing the flows.

Which next step would you like me to do? 
