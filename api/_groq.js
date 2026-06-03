// Shared Groq streaming helper (underscore-prefixed → Vercel doesn't treat it as a route).
// Calls Groq with stream:true, parses the SSE, invokes onDelta(text) per content token, and
// resolves with the full assembled answer. Throws if the request fails before any token.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function streamGroq({ model, messages, temperature = 0.3, maxTokens = 800, reasoningEffort }, onDelta) {
  const body = { model, messages, temperature, max_tokens: maxTokens, stream: true };
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM failed ${res.status}: ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return full;
      try {
        const json = JSON.parse(data);
        const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // ignore keep-alive / non-JSON lines
      }
    }
  }
  return full;
}

module.exports = { streamGroq };
