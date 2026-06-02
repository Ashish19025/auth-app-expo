const { respond, verifyAccessToken, getUserById, sanitizeUserData } = require('./auth-common');

exports.handler = async (event) => {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader) {
      return respond(401, { message: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    const user = await getUserById(userId);
    if (!user) {
      return respond(404, { message: 'User not found' });
    }

    return respond(200, {
      message: 'Profile retrieved',
      user: sanitizeUserData(user)
    });
  } catch (error) {
    console.error('Profile error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};
