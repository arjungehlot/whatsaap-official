const { decrypt } = require('../utils/crypto');

function timeout(ms = 30000) {
  const controller = new AbortController();
  return { controller, timer: setTimeout(() => controller.abort(), ms) };
}

async function generate(config, messages, systemPrompt) {
  const { controller, timer } = timeout(
    Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000)
  );
  try {
    if (config.provider === 'openai') {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            temperature: 0.4,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw providerError(body, response.status);
      return {
        text: body?.choices?.[0]?.message?.content?.trim() || '',
        usage: body.usage || {},
      };
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(body, response.status);
    return {
      text:
        body?.content
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
          .trim() || '',
      usage: body.usage || {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function providerError(body, status) {
  const error = new Error(
    body?.error?.message || `AI provider request failed (${status})`
  );
  error.status = status === 401 || status === 403 ? 400 : 502;
  return error;
}
function loadConfig(row, requireActive = true) {
  if (!row || (requireActive && !row.is_active)) return null;
  return {
    provider: row.provider,
    model: row.model,
    systemPrompt: row.system_prompt || '',
    apiKey: decrypt(row.api_key),
    autoReplyEnabled: Boolean(row.auto_reply_enabled),
    handoffAgentId: row.handoff_agent_id || null,
  };
}
function defaultPrompt(config, mode, knowledge = []) {
  const knowledgeText = knowledge.length
    ? `\n\nUse this business knowledge when it is relevant:\n${knowledge.join('\n\n')}`
    : '';
  return `${config.systemPrompt || 'You are a helpful WhatsApp business assistant. Be concise, accurate, and polite.'}\n\nMode: ${mode}.${knowledgeText}`;
}
module.exports = { generate, loadConfig, defaultPrompt };
