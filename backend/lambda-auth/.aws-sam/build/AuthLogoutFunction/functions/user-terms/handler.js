const { dynamo, respond, verifyAccessToken } = require('./auth-common');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');

const userTermsTable = process.env.DYNAMO_USER_TERMS_TABLE || process.env.USER_TERMS_TABLE || 'UserTerms';

exports.handler = async (event) => {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader) {
      return respond(401, { message: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    let body = {};
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    const { accepted } = body;

    if (!Array.isArray(accepted)) {
      return respond(400, { message: 'Accepted array is required' });
    }

    for (const item of accepted) {
      const params = {
        TableName: userTermsTable,
        Item: {
          userId,
          termId: item.termId,
          accepted: item.accepted,
          timestamp: new Date().toISOString(),
          userAgent: event.headers['user-agent']
        }
      };
      await dynamo.send(new PutCommand(params));
    }

    return respond(200, {
      message: 'Terms acceptance recorded',
      count: accepted.length
    });
  } catch (error) {
    console.error('User-terms error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};
