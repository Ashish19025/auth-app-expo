const { z } = require('zod');
const {
  buildAuthResponse,
  comparePassword,
  createRefreshToken,
  createSession,
  findUserByLoginIdentifier,
  getHeader,
  getSourceIp,
  jsonResponse,
  parseRequestBody,
  updateUserLastLogin,
} = require('./auth-common');

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(1),
  password: z.string().min(8),
});

async function handler(event) {
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return jsonResponse(200, { ok: true }, { 'access-control-allow-methods': 'OPTIONS,POST' });
  }

  try {
    const payload = loginSchema.parse(parseRequestBody(event));
    const loginIdentifier = payload.usernameOrEmail.trim();

    const user = await findUserByLoginIdentifier(loginIdentifier);
    if (!user) {
      return jsonResponse(401, { message: 'Invalid credentials.' });
    }

    const passwordOk = await comparePassword(payload.password, user.passwordHash);
    if (!passwordOk) {
      return jsonResponse(401, { message: 'Invalid credentials.' });
    }

    await updateUserLastLogin(user.userId);

    const refreshToken = createRefreshToken();
    await createSession({
      userId: user.userId,
      refreshToken,
      userAgent: getHeader(event, 'user-agent') || null,
      ip: getSourceIp(event),
    });

    return jsonResponse(200, await buildAuthResponse({ user, refreshToken }));
  } catch (error) {
    if (error?.name === 'ZodError') {
      return jsonResponse(400, { message: 'Invalid request payload.', issues: error.issues });
    }

    console.error('login handler failed', error);
    return jsonResponse(500, { message: 'Internal server error.' });
  }
}

module.exports = { handler };
