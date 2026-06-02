const { handler } = require('./functions/register/handler');

const event = {
  httpMethod: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'Local Test',
    email: 'localtest@example.com',
    password: 'Password123!',
    phone: '+1234567890',
    firebaseIdToken: 'fake-token-for-local-test',
    termsSelections: []
  }),
  isBase64Encoded: false,
  requestContext: {}
};

handler(event).then((res) => {
  console.log('Handler result:', res);
}).catch((err) => {
  console.error('Handler error:', err);
});
