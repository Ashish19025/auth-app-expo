const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const usersTable = process.env.DYNAMO_USERS_TABLE || 'Users';
const sessionsTable = process.env.DYNAMO_SESSIONS_TABLE || 'Sessions';
const jwtSecretId = process.env.JWT_PRIVATE_KEY_SECRET_ID || 'auth-app/jwt-keys';
const jwtIssuer = process.env.JWT_ISSUER || 'auth-app-expo';
const jwtAudience = process.env.JWT_AUDIENCE || 'auth-app-expo-users';
const accessTokenExpiresSeconds = Number(process.env.ACCESS_TOKEN_EXPIRES_SECONDS || 900);
const refreshTokenExpiresSeconds = Number(process.env.REFRESH_TOKEN_EXPIRES_SECONDS || 1209600);

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const secrets = new SecretsManagerClient({ region });

let jwtPrivateKeyPromise;
let jwtPublicKeyPromise;

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
       'access-control-allow-origin': '*',
       'access-control-allow-headers': 'content-type,authorization',
       'access-control-allow-methods': 'OPTIONS,POST',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function getHeader(event, name) {
  const headers = event.headers || {};
  const lower = name.toLowerCase();
  return headers[name] || headers[lower] || headers[name.toUpperCase()] || '';
}

function getSourceIp(event) {
  return event.requestContext?.identity?.sourceIp || event.requestContext?.http?.sourceIp || null;
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseRequestBody(event) {
  let rawBody = event.body || '{}';

  if (event.isBase64Encoded === true) {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
  }

  return JSON.parse(rawBody || '{}');
}

async function getSecretString(secretId) {
  try {
    const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (response.SecretString) {
      return response.SecretString;
    }
    if (response.SecretBinary) {
      return Buffer.from(response.SecretBinary).toString('utf8');
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
  try {
    const parsed = JSON.parse(secretString);
    if (typeof(parsed) === 'string') {
      console.log('[DEBUG] normalizeJwtPrivateKey: secret parsed as plain string');
      const header = getPemType(parsed);
      console.log(`[DEBUG] normalizeJwtPrivateKey: header=${header}; length=${parsed.length}`);
      return parsed;
    }

    const candidate = parsed.privateKey || parsed.private_key || parsed.key || parsed.value || null;
    if (candidate) {
      const header = getPemType(candidate);
      console.log(`[DEBUG] normalizeJwtPrivateKey: extracted privateKey field; header=${header}; length=${candidate.length}`);
      return candidate;
    }

    console.log('[DEBUG] normalizeJwtPrivateKey: no standard privateKey field found in secret JSON; returning raw secretString');
    const header = getPemType(secretString);
    console.log(`[DEBUG] normalizeJwtPrivateKey: header=${header}; length=${String(secretString).length}`);
    return secretString;
  } catch {
    const header = getPemType(secretString);
    console.log(`[DEBUG] normalizeJwtPrivateKey: secret not JSON; header=${header}; length=${String(secretString).length}`);
    return secretString;
  }
}

function getPemType(s) {
  const str = String(s || '');
  if (str.includes('-----BEGIN PRIVATE KEY-----')) return 'PKCS8';
  if (str.includes('-----BEGIN RSA PRIVATE KEY-----')) return 'PKCS1';
  if (str.includes('-----BEGIN PUBLIC KEY-----')) return 'PUBLIC';
  if (!str) return 'EMPTY';
  return 'UNKNOWN';
}

async function getJwtPrivateKey() {
  if (!jwtPrivateKeyPromise) {
    console.log(`[DEBUG] getJwtPrivateKey: loading secret id=${jwtSecretId}`);
    jwtPrivateKeyPromise = (async () => {
      const raw = await getSecretString(jwtSecretId);
      const normalized = normalizeJwtPrivateKey(raw);
      const header = getPemType(normalized);
      console.log(`[DEBUG] getJwtPrivateKey: normalized header=${header}; length=${normalized ? normalized.length : 0}`);
      return normalized;
    })();
  }

  return jwtPrivateKeyPromise;
}

async function getJwtPublicKey() {
  if (!jwtPublicKeyPromise) {
    jwtPublicKeyPromise = (async () => {
      const secretString = await getSecretString(jwtSecretId);
      try {
        const parsed = JSON.parse(secretString);
        const candidate = parsed.publicKey || parsed.public_key || parsed.public || parsed.publicKeyPem || parsed.public_key_pem || null;
        if (candidate) {
          console.log('[DEBUG] getJwtPublicKey: extracted public key from secret JSON; length=' + String(candidate.length));
          return candidate;
        }
        console.log('[DEBUG] getJwtPublicKey: public key not found in secret JSON');
        return null;
      } catch {
        const header = getPemType(secretString);
        if (header === 'PUBLIC') {
          console.log('[DEBUG] getJwtPublicKey: secret contains public key PEM');
          return secretString;
        }
        console.log('[DEBUG] getJwtPublicKey: secret does not contain public key PEM; header=' + header);
        return null;
      }
    })();
  }

  return jwtPublicKeyPromise;
}

async function jwtVerifyToken(token) {
  if (!token) {
    const err = new Error('Missing token');
    err.name = 'JsonWebTokenError';
    throw err;
  }

  const publicKey = await getJwtPublicKey();
  if (!publicKey) {
    const err = new Error('JWT public key not configured in secrets manager');
    err.name = 'SecretAccessError';
    throw err;
  }

  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: jwtIssuer,
    audience: jwtAudience,
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    username: user.username,
    firebaseUid: user.firebaseUid,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

async function createAccessTokenRs256({ userId, email, scope }) {
  const privateKey = await getJwtPrivateKey();

  return jwt.sign(
    {
      sub: userId,
      email,
      scope,
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: accessTokenExpiresSeconds,
      issuer: jwtIssuer,
      audience: jwtAudience,
    },
  );
}

async function findUserByLoginIdentifier(loginIdentifier) {
  const normalized = String(loginIdentifier || '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const queryPatterns = [];

  if (normalized.includes('@')) {
    queryPatterns.push({
      indexName: 'EmailIndex',
      keyConditionExpression: '#email = :email',
      expressionAttributeNames: { '#email': 'email' },
      expressionAttributeValues: { ':email': normalized },
    });
  }

  queryPatterns.push({
    keyConditionExpression: '#email = :email',
    expressionAttributeNames: { '#email': 'email' },
    expressionAttributeValues: { ':email': normalized },
  });

  for (const pattern of queryPatterns) {
    try {
      const queryInput = {
        TableName: usersTable,
        KeyConditionExpression: pattern.keyConditionExpression,
        ExpressionAttributeNames: pattern.expressionAttributeNames,
        ExpressionAttributeValues: pattern.expressionAttributeValues,
        Limit: 1,
      };

      if (pattern.indexName) {
        queryInput.IndexName = pattern.indexName;
      }

      const queryResult = await dynamo.send(new QueryCommand(queryInput));

      if (queryResult.Items?.length) {
        return queryResult.Items[0];
      }
    } catch (error) {
      if (error?.name !== 'ValidationException' && error?.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }
  }

  const scanResult = await dynamo.send(new ScanCommand({
    TableName: usersTable,
    FilterExpression: '#email = :email OR #username = :username',
    ExpressionAttributeNames: {
      '#email': 'email',
      '#username': 'username',
    },
    ExpressionAttributeValues: {
      ':email': normalized,
      ':username': normalized,
    },
    Limit: 1,
  }));

  return scanResult.Items?.[0] || null;
}

async function getUserById(userId) {
  if (!userId) {
    return null;
  }

  const response = await dynamo.send(new GetCommand({
    TableName: usersTable,
    Key: { userId },
  }));

  return response.Item || null;
}

async function updateUserLastLogin(userId) {
  await dynamo.send(new UpdateCommand({
    TableName: usersTable,
    Key: { userId },
    UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
    ExpressionAttributeValues: {
      ':lastLoginAt': nowEpochSeconds(),
    },
  }));
}

async function createSession({ userId, refreshToken, userAgent, ip }) {
  const sessionId = crypto.randomUUID();
  const now = nowEpochSeconds();
  const expiresAt = now + refreshTokenExpiresSeconds;

  await dynamo.send(new PutCommand({
    TableName: sessionsTable,
    Item: {
      sessionId,
      refreshTokenId: sessionId,
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      createdAt: now,
      lastActiveAt: now,
      expiresAt,
      revoked: false,
      userAgent: userAgent || null,
      ip: ip || null,
    },
    ConditionExpression: 'attribute_not_exists(sessionId)',
  }));

  return { sessionId, expiresAt };
}

async function getSessionByRefreshTokenHash(refreshTokenHash) {
  const result = await dynamo.send(new ScanCommand({
    TableName: sessionsTable,
    FilterExpression: '#refreshTokenHash = :refreshTokenHash',
    ExpressionAttributeNames: {
      '#refreshTokenHash': 'refreshTokenHash',
    },
    ExpressionAttributeValues: {
      ':refreshTokenHash': refreshTokenHash,
    },
    Limit: 1,
  }));

  return result.Items?.[0] || null;
}

async function revokeSession(sessionId) {
  if (!sessionId) {
    return;
  }

  await dynamo.send(new UpdateCommand({
    TableName: sessionsTable,
    Key: { sessionId },
    UpdateExpression: 'SET revoked = :revoked, revokedAt = :revokedAt',
    ExpressionAttributeValues: {
      ':revoked': true,
      ':revokedAt': nowEpochSeconds(),
    },
  }));
}

async function markSessionActive(sessionId) {
  if (!sessionId) {
    return;
  }

  await dynamo.send(new UpdateCommand({
    TableName: sessionsTable,
    Key: { sessionId },
    UpdateExpression: 'SET lastActiveAt = :lastActiveAt',
    ExpressionAttributeValues: {
      ':lastActiveAt': nowEpochSeconds(),
    },
  }));
}

async function comparePassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

async function buildAuthResponse({ user, refreshToken, scope }) {
  const accessToken = await createAccessTokenRs256({
    userId: user.userId,
    email: user.email,
    scope,
  });

  return {
    user: sanitizeUser(user),
    tokens: {
      accessToken,
      refreshToken,
    },
    expiresIn: accessTokenExpiresSeconds,
  };
}

module.exports = {
  accessTokenExpiresSeconds,
  comparePassword,
  createAccessTokenRs256,
  createRefreshToken,
  createSession,
  dynamo,
  findUserByLoginIdentifier,
  getHeader,
  getJwtPrivateKey,
  getSessionByRefreshTokenHash,
  getSourceIp,
  getUserById,
  hashRefreshToken,
  jwtAudience,
  jwtIssuer,
  jsonResponse,
  markSessionActive,
  normalizeEmail,
  nowEpochSeconds,
  parseRequestBody,
  refreshTokenExpiresSeconds,
  revokeSession,
  sanitizeUser,
  buildAuthResponse,
  updateUserLastLogin,
  jwtVerifyToken,
};
