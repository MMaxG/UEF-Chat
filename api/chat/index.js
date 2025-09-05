const axios = require('axios');

module.exports = async function (context, req) {
  const apiKey = process.env.FOUNDRY_API_KEY;
  if (!apiKey) {
    context.log.error('FOUNDRY_API_KEY not set');
    context.res = { status: 500, body: { error: 'Server misconfigured' } };
    return;
  }

  const userMessage = req.body?.message || '';
  const url = 'https://YOUR-FOUNDRY-ENDPOINT/openai/deployments/YOUR_DEPLOYMENT/chat/completions?api-version=2024-05-01-preview';

  try {
    const resp = await axios.post(url, {
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      }
    });

    context.res = {
      status: resp.status,
      body: resp.data
    };
  } catch (err) {
    context.log.error(err.message || err);
    context.res = { status: 500, body: { error: err.message || 'upstream error' } };
  }
};
