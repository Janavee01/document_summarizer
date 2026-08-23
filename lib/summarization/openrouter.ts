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

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0.2,

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
  } catch {
    throw new OpenRouterError(
      "Could not reach the OpenRouter service."
    );
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

  throw new OpenRouterError(
    detail
      ? `OpenRouter error: ${detail}`
      : `OpenRouter returned status ${response.status}.`
  );
}

  const payload = await response.json();

  const content =
    payload?.choices?.[0]?.message?.content ?? "";

  if (!content.trim()) {
    throw new OpenRouterError(
      "OpenRouter returned an empty response."
    );
  }

  return content;
}