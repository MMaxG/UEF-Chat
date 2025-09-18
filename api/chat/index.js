const axios = require('axios');

module.exports = async function (context, req) {
  const apiKey = process.env.FOUNDRY_API_KEY;
  if (!apiKey) {
    context.log.error('FOUNDRY_API_KEY not set');
    context.res = { status: 500, body: { error: 'Server misconfigured' } };
    return;
  }

  // Allow client to send either `messages` (preferred) or `message` (legacy)
  const body = req.body || {};
  const messages = Array.isArray(body.messages)
    ? body.messages
    : (body.message ? [{ role: 'user', content: String(body.message) }] : []);

  // Fallbacks for model and max_tokens
  const deployment =  body.model || process.env.OPENAI_DEPLOYMENT || 'uef-chat';
  const max_tokens = body.max_tokens || body.maxTokens || 1024;

  context.log(`Client requested model: ${body.model}`);
  context.log(`Client System Instructions: ${body.messages[0].content}`);
  context.log(`Using Azure deployment: ${deployment}`);


  // If client provided dataSources AND the server has search envs, prefer server-side wiring
  const useClientDataSources = Array.isArray(body.dataSources) && body.dataSources.length > 0;

  let openaiEndpoint = process.env.OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || 'https://uef-demo-openai.openai.azure.com';
  // Normalize endpoint: if user provided a full URL with paths, strip any path after the host
  try {
    const idx = openaiEndpoint.indexOf('/openai');
    if (idx !== -1) {
      openaiEndpoint = openaiEndpoint.slice(0, idx);
    }
  } catch (e) {
    // ignore
  }
  context.log(`Using OpenAI endpoint: ${openaiEndpoint}`);
  const apiVersion = process.env.OPENAI_API_VERSION || '2023-08-01-preview';

  const payload = {
    messages,
    max_tokens,
    model: deployment
  };

  // If client included dataSources, prefer not to trust keys in client; server should inject its own if configured
  if (!useClientDataSources && process.env.SEARCH_ENDPOINT && process.env.SEARCH_INDEX && process.env.SEARCH_KEY) {
    payload.dataSources = [
      {
        type: 'AzureCognitiveSearch',
        parameters: {
          endpoint: process.env.SEARCH_ENDPOINT,
          indexName: process.env.SEARCH_INDEX,
          key: process.env.SEARCH_KEY
        }
      }
    ];
  } else if (useClientDataSources) {
    // copy client-provided dataSources but remove any keys to avoid trusting client secrets
    payload.dataSources = body.dataSources.map(ds => {
      const copy = { ...ds };
      if (copy.parameters) {
        delete copy.parameters.key;
      }
      return copy;
    });
  }

  const useExtensions = Array.isArray(payload.dataSources) && payload.dataSources.length > 0;
  const path = useExtensions ? 'extensions/chat/completions' : 'chat/completions';
  const url = `${openaiEndpoint}/openai/deployments/${deployment}/${path}?api-version=${apiVersion}`;

  try {
    // Debug logs to help diagnose 404/resource issues
    context.log(`Calling OpenAI URL: ${url}`);
    //try { context.log('Request payload: ' + JSON.stringify(payload)); } catch(e) { context.log('Request payload (unserializable)'); }

    const resp = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      }
    });

    //console.log("Response:", JSON.stringify(resp.data, null, 2));

    context.res = {
      status: resp.status,
      body: resp.data
    };
  } catch (err) {
    context.log.error(err.response?.data || err.message || err);
    const message = err.response?.data || err.message || 'upstream error';
    context.res = { status: err.response?.status || 500, body: { error: message } };
  }
};
