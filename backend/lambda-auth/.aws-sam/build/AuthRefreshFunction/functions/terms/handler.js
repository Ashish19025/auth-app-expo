const { dynamo, respond } = require('./auth-common');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

const termsTable = process.env.TERMS_TABLE || 'Terms';

exports.handler = async (event) => {
  try {
    const result = await dynamo.send(new ScanCommand({
      TableName: termsTable
    }));

    return respond(200, {
      message: 'Terms retrieved',
      terms: result.Items || []
    });
  } catch (error) {
    console.error('Terms error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};
