const {
  generateAccessToken,
  generateRefreshToken,
  getSessionByRefreshTokenNew,
  createSessionNew,
  revokeSessionNew,
  getUserById,
  respond,
  sanitizeUserData
} = require('./auth-common');

exports.handler = async (event) => {
  try {
    let body = {};
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    const { refreshToken } = body;

    if (!refreshToken) {
      return respond(400, { message: 'Refresh token is required' });
    }

    const session = await getSessionByRefreshTokenNew(refreshToken);

    if (!session) {
      return respond(401, { message: 'Invalid or revoked refresh token' });
    }

    if (session.expiresAt < Math.floor(Date.now() / 1000)) {
      await revokeSessionNew(session.sessionId);
      return respond(401, { message: 'Refresh token expired' });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return respond(401, { message: 'User not found' });
    }

    await revokeSessionNew(session.sessionId);

    const newRefreshToken = generateRefreshToken();
    await createSessionNew(user.userId, newRefreshToken);

    const accessToken = await generateAccessToken(user.userId, user.email, user.name);

    return respond(200, {
      message: 'Token refreshed',
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};
