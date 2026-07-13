import { config } from '../config';

// ---------------------------------------------------------------------------
// Minimal OpenAI-compatible chat client for the API.
//
// The Python worker talks to the same Ollama/vLLM endpoint for resume scoring;
// this is the Node-side equivalent used for interactive, request/response
// features (candidate comparison and follow-up Q&A) where we need an LLM call
// inline in the HTTP request rather than on the BullMQ queue.
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatOptions = {
  /** Ask the server to constrain output to a single JSON object. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Override the default model for this call. */
  model?: string;
};

/** Remove leading/trailing ``` or ```json fences the model may wrap output in. */
function stripCodeFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

/**
 * Call the configured chat-completions endpoint and return the assistant's
 * message content. Throws on HTTP error, timeout, or empty response.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.vllm.timeoutSeconds * 1000
  );

  try {
    const res = await fetch(`${config.vllm.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: opts.model ?? config.vllm.model,
        messages,
        max_tokens: opts.maxTokens ?? config.vllm.maxTokens,
        temperature: opts.temperature ?? config.vllm.temperature,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`LLM endpoint returned HTTP ${res.status}: ${detail.slice(0, 500)}`),
        { statusCode: 502, code: 'LLM_ERROR' }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw Object.assign(new Error('LLM returned an empty response'), {
        statusCode: 502,
        code: 'LLM_EMPTY',
      });
    }
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(
        new Error(`LLM request timed out after ${config.vllm.timeoutSeconds}s`),
        { statusCode: 504, code: 'LLM_TIMEOUT' }
      );
    }
    if (err instanceof TypeError) {
      // fetch throws TypeError when the host is unreachable
      throw Object.assign(
        new Error(`Could not reach LLM endpoint at ${config.vllm.baseUrl}`),
        { statusCode: 502, code: 'LLM_UNREACHABLE' }
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call the LLM expecting a single JSON object back, and parse it. Retries once
 * on a parse failure (small local models occasionally emit trailing prose).
 */
export async function chatCompletionJson<T = unknown>(
  messages: ChatMessage[],
  opts: Omit<ChatOptions, 'json'> = {}
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await chatCompletion(messages, { ...opts, json: true });
    try {
      return JSON.parse(stripCodeFences(raw)) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw Object.assign(
    new Error(`LLM did not return valid JSON: ${String(lastErr)}`),
    { statusCode: 502, code: 'LLM_BAD_JSON' }
  );
}
