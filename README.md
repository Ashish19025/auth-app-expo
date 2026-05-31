# Auth App (Expo SDK 56)

Mobile-first authentication app built with Expo Router and TypeScript.

## Features implemented

- Login screen (`username/email` + `password`)
- Registration screen (`name`, `email`, `password`, `phone`) with OTP verification flow scaffold
- Protected home screen showing logged-in user name
- Route guards for public/protected groups
- Terms & Conditions modal after registration
- Terms selection tracking (`accepted` / `not accepted`) without timestamps
- Auth state persistence with `expo-secure-store`
- Component-wise UI structure for reusable auth and form elements

## Stack

- Expo SDK 56
- Expo Router (file-based navigation)
- React Native + TypeScript
- `expo-secure-store` for secure token storage
- `firebase` (OTP integration scaffold)
- `axios` (API layer)

## Project structure

```text
src/
   app/
      _layout.tsx
      index.tsx
      (auth)/
         _layout.tsx
         login.tsx
         register.tsx
      (protected)/
         _layout.tsx
         home.tsx
   components/
      auth/
         AuthFooterLink.tsx
         AuthHeader.tsx
         TermsModal.tsx
      ui/
         AppButton.tsx
         AppInput.tsx
         InlineAction.tsx
         Screen.tsx
   constants/
      terms.ts
      theme.ts
   context/
      AuthContext.tsx
   hooks/
      useAuth.ts
   services/
      api.ts
      authService.ts
      firebase.ts
      storage.ts
      termsService.ts
   types/
      auth.ts
      terms.ts
   utils/
      validators.ts
```

## Environment variables

Create `.env` (or set via Expo env) with:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-api-gateway-url
EXPO_PUBLIC_USE_MOCK_OTP=true

EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Notes:
- Keep `EXPO_PUBLIC_USE_MOCK_OTP=true` for assignment/demo mode.
- Set `EXPO_PUBLIC_API_BASE_URL` only when your AWS backend is ready.

## Run locally

```bash
npm install
npm run start
```

Start on specific platform:

```bash
npm run android
npm run ios
```

## Validation commands

```bash
npm run lint
npx tsc --noEmit
```

## Current behavior for backend integration

- If `EXPO_PUBLIC_API_BASE_URL` is missing, app runs in mock mode:
   - registration stores a local mock user securely
   - login validates against locally stored mock credentials
   - terms submission is skipped remotely but UI flow is complete
- If `EXPO_PUBLIC_API_BASE_URL` is set, app calls backend endpoints:
   - `POST /auth/register`
   - `POST /auth/login`
   - `POST /auth/logout`
   - `GET /terms`
   - `POST /user/terms`

## AWS backend readiness checklist

- API Gateway routes for auth + terms endpoints
- Lambda handlers for register/login/logout/terms
- DynamoDB tables for users, sessions, terms, user terms
- Firebase Admin verification inside register Lambda
- JWT access/refresh token issuance and refresh rotation

## Important OTP note for Expo

Firebase phone auth in Expo managed workflow often requires native setup for full production OTP. This project includes a clean scaffold and supports assignment-friendly mock OTP mode.
