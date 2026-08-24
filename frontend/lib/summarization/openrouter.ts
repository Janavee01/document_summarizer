const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const MODEL =
  "nvidia/nemotron-3-super-120b-a12b:free";

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type OpenRouterOptions = {
  maxTokens?: number;
  jsonMode?: boolean;
};

/*
 * Client-side request timeout: a hanging upstream must fail well before
 * the platform kills the route (maxDuration = 60s), so the caller receives
 * a clean, retryable error instead of a gateway timeout.
 */
const REQUEST_TIMEOUT_MS = 45_000;

export async function callOpenRouter(
  prompt: string,
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new OpenRouterError(
      "AI_API_KEY is not configured on the server."
    );
  }

  const {
    maxTokens = 1500,
    jsonMode = false,
  } = options;

  let response: Response;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      signal: controller.signal,

      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.2,

        /*
         * The free Nemotron model spends a large, variable share of
         * max_tokens on hidden reasoning before answering — enough to
         * truncate (and corrupt) JSON output and stretch calls past 50s.
         * Disabling it keeps responses fast and within budget.
         */
        reasoning: { enabled: false },

        messages: [
          {
            role: "system",
            content: jsonMode
              ? "Return only valid JSON. Do not provide reasoning, explanations, markdown, or text outside the JSON object."
              : "You are a precise document summarization assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        ...(jsonMode
          ? {
              response_format: {
                type: "json_object",
              },
            }
          : {}),
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError(
        "The AI service took too long to respond. Please try again."
      );
    }

    throw new OpenRouterError(
      "Could not reach the OpenRouter service."
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = "";

    try {
      const errorBody = await response.json();
      detail = errorBody?.error?.message ?? "";

      console.error("OpenRouter status:", response.status);
      console.error("OpenRouter error body:", errorBody);
      console.error("OpenRouter error detail:", detail);
    } catch {
      console.error(
        "OpenRouter returned an error, but the error body could not be parsed."
      );
    }

    /*
     * The provider's raw detail is logged above but deliberately not
     * forwarded to the client — it can expose internal model/route info.
     */
    throw new OpenRouterError(
      `The AI service returned an error (status ${response.status}). Please try again.`
    );
  }

  const payload = await response.json();

  /*
   * A JSON-mode response cut off by the token limit is never parseable,
   * so fail immediately with an accurate message instead of letting the
   * caller surface a confusing "couldn't be parsed" error. Truncation of
   * plain-prose responses (chunk summaries, answers) is harmless and
   * still returned.
   */
  if (
    jsonMode &&
    payload?.choices?.[0]?.finish_reason === "length"
  ) {
    throw new OpenRouterError(
      "The AI response was cut off before it could be completed. Please try again."
    );
  }

  const content =
    payload?.choices?.[0]?.message?.content ?? "";

  if (!content.trim()) {
    throw new OpenRouterError(
      "OpenRouter returned an empty response."
    );
  }

  return content;
}