const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { jsonResponse, getHeader } = require('./auth-common');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const usersTable = process.env.DYNAMO_USERS_TABLE || 'Users';
const sessionsTable = process.env.DYNAMO_SESSIONS_TABLE || 'Sessions';
const termsTable = process.env.DYNAMO_TERMS_TABLE || 'Terms';
const userTermsTable = process.env.DYNAMO_USER_TERMS_TABLE || 'UserTerms';
const firebaseSecretId = process.env.FIREBASE_SERVICE_ACCOUNT_SECRET_ID || 'auth-app/firebase-service-account';
const jwtSecretId = process.env.JWT_PRIVATE_KEY_SECRET_ID || 'auth-app/jwt-keys';
const jwtIssuer = process.env.JWT_ISSUER || 'auth-app-expo';
const jwtAudience = process.env.JWT_AUDIENCE || 'auth-app-expo-users';
const accessTokenExpiresSeconds = Number(process.env.ACCESS_TOKEN_EXPIRES_SECONDS || 900);
const refreshTokenExpiresSeconds = Number(process.env.REFRESH_TOKEN_EXPIRES_SECONDS || 1209600);

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const secrets = new SecretsManagerClient({ region });

let firebaseInitialized = false;
let firebaseInitPromise;
let jwtPrivateKeyPromise;

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  phone: z.string().trim().min(6),
  firebaseIdToken: z.string().min(1).optional(),
  termsSelections: z.array(z.object({
    termId: z.string().trim().min(1),
    accepted: z.boolean(),
  })).default([]),
});

async function getSecretString(secretId) {
  try {
    console.log('Loading secret:', secretId);
    const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (response.SecretString) {
      console.log('Loaded secret string:', secretId, 'length:', response.SecretString.length);
      return response.SecretString;
    }
    if (response.SecretBinary) {
      const secretString = Buffer.from(response.SecretBinary).toString('utf8');
      console.log('Loaded secret binary:', secretId, 'length:', secretString.length);
      return secretString;
    }
    const error = new Error(`Secret ${secretId} has no retrievable value.`);
    error.name = 'SecretAccessError';
    throw error;
  } catch (error) {
    if (error?.name === 'SecretAccessError') {
      throw error;
    }

    const accessError = new Error(`Unable to load secret ${secretId}: ${error.message}`);
    accessError.name = 'SecretAccessError';
    accessError.cause = error;
    throw accessError;
  }
}

function normalizeJwtPrivateKey(secretString) {
  const trimmed = String(secretString || '').trim();

  function getPemTypeLocal(s) {
    const str = String(s || '');
    if (str.includes('-----BEGIN PRIVATE KEY-----')) return 'PKCS8';
    if (str.includes('-----BEGIN RSA PRIVATE KEY-----')) return 'PKCS1';
    if (str.includes('-----BEGIN PUBLIC KEY-----')) return 'PUBLIC';
    if (!str) return 'EMPTY';
    return 'UNKNOWN';
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate = parsed.privateKey || parsed.private_key || parsed.key || parsed.value || null;
      if (candidate) {
        console.log('[DEBUG] normalizeJwtPrivateKey: extracted privateKey from secret JSON; header=' + getPemTypeLocal(candidate) + '; length=' + candidate.length);
        return candidate;
      }
      console.log('[DEBUG] normalizeJwtPrivateKey: secret JSON did not contain known privateKey fields; returning raw');
      console.log('[DEBUG] normalizeJwtPrivateKey: raw header=' + getPemTypeLocal(trimmed) + '; length=' + trimmed.length);
      return secretString;
    } catch {
      console.log('[DEBUG] normalizeJwtPrivateKey: secret looked like JSON but parsing failed; returning raw');
      console.log('[DEBUG] normalizeJwtPrivateKey: raw header=' + getPemTypeLocal(trimmed) + '; length=' + trimmed.length);
      return secretString;
    }
  }

  console.log('[DEBUG] normalizeJwtPrivateKey: secret is not JSON; header=' + getPemTypeLocal(trimmed) + '; length=' + trimmed.length);
  return secretString;
}

async function getFirebaseAdmin() {
  if (!firebaseInitPromise) {
    console.log('Initializing Firebase Admin. Already initialized:', firebaseInitialized);
    firebaseInitPromise = (async () => {
      if (!firebaseInitialized) {
        try {
          const serviceAccount = JSON.parse(await getSecretString(firebaseSecretId));
          console.log('Firebase service account keys:', Object.keys(serviceAccount).sort().join(','));
          admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
          firebaseInitialized = true;
          console.log('Firebase Admin initialized successfully');
        } catch (error) {
          const initError = new Error(`Firebase admin initialization failed: ${error.message}`);
          initError.name = error?.name === 'SecretAccessError' ? 'SecretAccessError' : 'FirebaseInitializationError';
          initError.cause = error;
          firebaseInitPromise = undefined;
          throw initError;
        }
      }
      return admin;
    })();
  }

  try {
    return await firebaseInitPromise;
  } catch (error) {
    firebaseInitPromise = undefined;
    throw error;
  }
}

async function getJwtPrivateKey() {
  if (!jwtPrivateKeyPromise) {
    console.log('[DEBUG] getJwtPrivateKey: loading secret id=' + jwtSecretId);
    jwtPrivateKeyPromise = (async () => {
      const raw = await getSecretString(jwtSecretId);
      const normalized = normalizeJwtPrivateKey(raw);
      const header = String(normalized || '').includes('-----BEGIN PRIVATE KEY-----') ? 'PKCS8' : (String(normalized || '').includes('-----BEGIN RSA PRIVATE KEY-----') ? 'PKCS1' : 'UNKNOWN');
      console.log('[DEBUG] getJwtPrivateKey: normalized header=' + header + '; length=' + (normalized ? normalized.length : 0));
      return normalized;
    })();
  }
  return jwtPrivateKeyPromise;
}

async function verifyFirebaseToken(firebaseIdToken, expectedPhone) {
  const firebase = await getFirebaseAdmin();
  let decoded;

  try {
    decoded = await firebase.auth().verifyIdToken(firebaseIdToken);
  } catch (error) {
    const authCodes = new Set([
      'auth/argument-error',
      'auth/invalid-id-token',
      'auth/id-token-expired',
      'auth/invalid-credential',
      'auth/invalid-user-token',
    ]);

    if (authCodes.has(error?.code)) {
      const unauthorized = new Error('Invalid Firebase token.');
      unauthorized.name = 'FirebaseUnauthorizedError';
      throw unauthorized;
    }

    throw error;
  }

  const phoneNumber = decoded.phone_number || decoded.firebase?.identities?.phone?.[0] || '';
  if (!phoneNumber) {
    const unauthorized = new Error('Firebase token does not contain a phone number.');
    unauthorized.name = 'FirebaseUnauthorizedError';
    throw unauthorized;
  }
  if (expectedPhone && phoneNumber !== expectedPhone) {
    const unauthorized = new Error('Phone number mismatch between request and Firebase token.');
    unauthorized.name = 'FirebaseUnauthorizedError';
    throw unauthorized;
  }
  return { uid: decoded.uid, phoneNumber };
}

async function emailExists(email) {
  try {
    const queryResult = await dynamo.send(new QueryCommand({
      TableName: usersTable,
      IndexName: 'emailIndex',
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': email.toLowerCase() },
      Limit: 1,
    }));
    return (queryResult.Items || []).length > 0;
  } catch (error) {
    if (error?.name !== 'ValidationException' && error?.name !== 'ResourceNotFoundException') {
      throw error;
    }

    const scanResult = await dynamo.send(new ScanCommand({
      TableName: usersTable,
      FilterExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': email.toLowerCase() },
      Limit: 1,
    }));
    return (scanResult.Items || []).length > 0;
  }
}

async function phoneExists(phone) {
  try {
    const queryResult = await dynamo.send(new QueryCommand({
      TableName: usersTable,
      IndexName: 'phoneIndex',
      KeyConditionExpression: '#phone = :phone',
      ExpressionAttributeNames: { '#phone': 'phone' },
      ExpressionAttributeValues: { ':phone': phone },
      Limit: 1,
    }));
    return (queryResult.Items || []).length > 0;
  } catch (error) {
    if (error?.name !== 'ValidationException' && error?.name !== 'ResourceNotFoundException') {
      throw error;
    }

    const scanResult = await dynamo.send(new ScanCommand({
      TableName: usersTable,
      FilterExpression: '#phone = :phone',
      ExpressionAttributeNames: { '#phone': 'phone' },
      ExpressionAttributeValues: { ':phone': phone },
      Limit: 1,
    }));
    return (scanResult.Items || []).length > 0;
  }
}

async function getTermsByIds(termIds) {
  const results = [];
  for (const termId of termIds) {
    const response = await dynamo.send(new GetCommand({
      TableName: termsTable,
      Key: { termId },
    }));
    if (response.Item) {
      results.push(response.Item);
    }
  }
  return results;
}

async function createAccessTokenRs256({ userId, email }) {
  const privateKey = await getJwtPrivateKey();
  const header = String(privateKey || '').includes('-----BEGIN PRIVATE KEY-----') ? 'PKCS8' : (String(privateKey || '').includes('-----BEGIN RSA PRIVATE KEY-----') ? 'PKCS1' : 'UNKNOWN');
  console.log(`[DEBUG] createAccessTokenRs256: signing for user=${userId}; privateKeyHeader=${header}; keyLength=${privateKey ? privateKey.length : 0}`);
  const token = jwt.sign(
    { sub: userId, email },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: accessTokenExpiresSeconds,
      issuer: jwtIssuer,
      audience: jwtAudience,
    },
  );
  console.log('[DEBUG] createAccessTokenRs256: token signed; tokenLength=' + (token ? token.length : 0));
  return token;
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  try {
    console.log('Register handler invoked');
    console.log('Event info:', JSON.stringify({
      hasBody: Boolean(event.body),
      isBase64Encoded: event.isBase64Encoded,
      httpMethod: event.httpMethod || event.requestContext?.http?.method,
      contentType: getHeader(event, 'content-type'),
    }));

    let rawBody = event.body || '{}';
    if (event.isBase64Encoded === true) {
      try {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      } catch (error) {
        console.error('Base64 decode error:', error.message);
        return jsonResponse(400, { message: 'Invalid base64 encoding in request body.' });
      }
    }

    let bodyJson;
    try {
      bodyJson = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parse failed:', parseError.message);
      console.error('Raw body (first 500 chars):', rawBody.substring(0, 500));
      return jsonResponse(400, { message: 'Invalid JSON in request body.' });
    }

    const payload = registerSchema.parse(bodyJson);
    console.log('Payload validated for email/phone:', payload.email, payload.phone);
    // Handle Firebase verification:
    // - If SKIP_FIREBASE_VERIFY=true => skip verification (local test mode)
    // - If AUTH_ALLOW_MOCK_TOKEN=true and payload.firebaseIdToken === 'mock-firebase-id-token' => accept mock token
    // - If no firebaseIdToken provided but dev flags are set, allow creating user for local testing
    let firebaseResult;
    const hasToken = typeof payload.firebaseIdToken === 'string' && payload.firebaseIdToken.trim().length > 0;

    if (process.env.SKIP_FIREBASE_VERIFY === 'true') {
      console.log('SKIP_FIREBASE_VERIFY is true — skipping Firebase verification (local test mode)');
      firebaseResult = { uid: 'local-test-uid', phoneNumber: payload.phone };
    } else if (!hasToken && process.env.AUTH_ALLOW_MOCK_TOKEN === 'true') {
      console.log('No firebaseIdToken provided, but AUTH_ALLOW_MOCK_TOKEN is true — allowing dev registration without token');
      firebaseResult = { uid: 'mock-uid', phoneNumber: payload.phone };
    } else if (process.env.AUTH_ALLOW_MOCK_TOKEN === 'true' && payload.firebaseIdToken === 'mock-firebase-id-token') {
      console.log('AUTH_ALLOW_MOCK_TOKEN is true and received mock token — allowing mock Firebase token for dev/testing');
      firebaseResult = { uid: 'mock-uid', phoneNumber: payload.phone };
    } else {
      if (!hasToken) {
        return jsonResponse(400, { message: 'firebaseIdToken is required.' });
      }
      firebaseResult = await verifyFirebaseToken(payload.firebaseIdToken, payload.phone);
      if (!firebaseResult.phoneNumber) {
        return jsonResponse(401, { message: 'Firebase verification failed.' });
      }
    }

    const normalizedEmail = payload.email.toLowerCase();
    const normalizedPhone = payload.phone.trim();

    if (await emailExists(normalizedEmail)) {
      return jsonResponse(409, { message: 'Email already exists.' });
    }
    if (await phoneExists(normalizedPhone)) {
      return jsonResponse(409, { message: 'Phone already exists.' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const nowEpoch = Math.floor(Date.now() / 1000);

    const userItem = {
      userId,
      name: payload.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      createdAt: nowEpoch,
      lastLoginAt: nowEpoch,
      firebaseUid: firebaseResult.uid,
    };

    await dynamo.send(new PutCommand({
      TableName: usersTable,
      Item: userItem,
      ConditionExpression: 'attribute_not_exists(userId)',
    }));

    if (payload.termsSelections.length > 0) {
      for (const ts of payload.termsSelections) {
        await dynamo.send(new PutCommand({
          TableName: userTermsTable,
          Item: {
            userId,
            termId: ts.termId,
            accepted: Boolean(ts.accepted),
            version: 1,
            timestamp: nowEpoch,
          },
        }));
      }
    }

    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = nowEpoch + refreshTokenExpiresSeconds;

    await dynamo.send(new PutCommand({
      TableName: sessionsTable,
      Item: {
        sessionId: crypto.randomUUID(),
        refreshTokenId: crypto.randomUUID(),
        userId,
        refreshTokenHash,
        createdAt: nowEpoch,
        lastActiveAt: nowEpoch,
        expiresAt,
        revoked: false,
        userAgent: getHeader(event, 'user-agent') || null,
        ip: event.requestContext?.identity?.sourceIp || event.requestContext?.http?.sourceIp || null,
      },
    }));

    const accessToken = await createAccessTokenRs256({ userId, email: normalizedEmail });

    return jsonResponse(201, {
      user: {
        userId,
        name: userItem.name,
        email: userItem.email,
        phone: userItem.phone,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      expiresIn: accessTokenExpiresSeconds,
    });
  } catch (error) {
    if (error?.name === 'ZodError') {
      return jsonResponse(400, { message: 'Invalid request payload.', issues: error.issues });
    }

    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'FirebaseUnauthorizedError') {
      return jsonResponse(401, { message: 'Invalid Firebase token.' });
    }

    if (error?.name === 'SecretAccessError') {
      console.error('Secret access failed', error);
      return jsonResponse(500, { message: 'Secret access failed.' });
    }

    if (error?.name === 'FirebaseInitializationError') {
      console.error('Firebase initialization failed', error);
      return jsonResponse(500, { message: 'Firebase initialization failed.' });
    }

    console.error('register handler failed', error);
    return jsonResponse(500, { message: 'Internal server error.' });
  }
}

module.exports = { handler };
