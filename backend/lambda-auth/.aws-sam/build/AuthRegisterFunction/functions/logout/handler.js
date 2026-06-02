const {
  getSessionByRefreshTokenNew,
  revokeSessionNew,
  respond
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
    if (session) {
      await revokeSessionNew(session.sessionId);
    }

    return respond(200, { message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};
