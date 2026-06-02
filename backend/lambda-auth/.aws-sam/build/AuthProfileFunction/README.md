# Auth Lambdas

This folder contains the auth backend in a per-function layout and is designed to deploy as a SAM stack.

## Layout
- `shared/auth-common.js` — shared DynamoDB, secrets, token, and response helpers.
- `functions/register/handler.js`
- `functions/login/handler.js`
- `functions/refresh/handler.js`
- `functions/logout/handler.js`
- `functions/terms/handler.js`
- `functions/user-terms/handler.js`
- `functions/profile/handler.js`

## Build and deploy
1. Package the Lambda ZIPs:
```powershell
.\build.ps1
```
2. Deploy the SAM stack:
```powershell
.\deploy.ps1 -FirebaseSecretArn '<firebase-secret-arn>' -JwtSecretArn '<jwt-secret-arn>'
```

## Local checks
```powershell
npm run test:register
npm run test:login
npm run test:refresh
npm run test:logout
npm run test:terms
npm run test:user-terms
npm run test:profile
```

## SAM parameters
- `UsersTableName`
- `SessionsTableName`
- `TermsTableName`
- `UserTermsTableName`
- `FirebaseSecretArn`
- `JwtSecretArn`
- `JwtIssuer`
- `JwtAudience`
- `AccessTokenExpiresSeconds`
- `RefreshTokenExpiresSeconds`

## Environment variables per function
- `DYNAMO_USERS_TABLE`
- `DYNAMO_SESSIONS_TABLE`
- `DYNAMO_TERMS_TABLE`
- `DYNAMO_USER_TERMS_TABLE`
- `FIREBASE_SERVICE_ACCOUNT_SECRET_ID`
- `JWT_PRIVATE_KEY_SECRET_ID`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `ACCESS_TOKEN_EXPIRES_SECONDS`
- `REFRESH_TOKEN_EXPIRES_SECONDS`

