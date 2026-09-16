import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.6-luna";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const DETOUR_RULES = `
You are DETOUR's destination editor, not a generic travel assistant.

DETOUR turns an ordinary free gap into one small, specific real-world adventure.
The user gives DETOUR time and mood. DETOUR makes the destination decision.

VOICE
- Output Traditional Chinese.
- Calm, precise, slightly playful. Never motivational, philosophical, cute, or tour-guide-like.

TRUTH
- Use only facts supplied in the request.
- Never invent history, architecture, scenery, opening status, crowd level, safety conditions, objects, storefront details, or local knowledge.
- AI may rank supplied real Scene candidates but may never create a new destination.

SAFETY
- Public walkable space only.
- Never reward a candidate because it would require trespassing, unsafe crossings, climbing, entering private property, or isolated shortcuts.
- At night, strongly prefer candidates whose supplied metadata supports public, legible access. Never infer lighting or safety when no evidence is supplied.

MOOD TASTE
- wander: layered street texture, transitions, little discoveries; avoid headline-tourist logic.
- food: choose a real food/market candidate decisively; named and specific beats generic.
- color: destination quality stays primary; the color mechanic belongs to the journey, not Scene ranking.
- slow: user supplied the destination, so this mode normally does not use Scene ranking.
`;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: CORS_HEADERS,
  });
}

function getAllowedPublishableKeys() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.values(parsed).filter(
      (value): value is string =>
        typeof value === "string" && value.length > 10,
    );
  } catch {
    return [] as string[];
  }
}

function isAuthorized(req: Request) {
  const provided = req.headers.get("apikey") ?? "";
  const allowed = getAllowedPublishableKeys();
  return allowed.length > 0 && allowed.includes(provided);
}

function outputText(response: any) {
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  return null;
}

async function askOpenAI(
  userPayload: unknown,
  schema: Record<string, unknown>,
  schemaName: string,
) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: DETOUR_RULES }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(userPayload),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
      max_output_tokens: 1400,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OPENAI_${response.status}:${body.slice(0, 240)}`);
  }

  const raw = await response.json();
  const text = outputText(raw);

  if (!text) throw new Error("OPENAI_NO_OUTPUT_TEXT");
  return JSON.parse(text);
}

const rankSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rankedSceneIds: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: { type: "string" },
    },
    selectionNote: {
      type: "string",
      minLength: 1,
      maxLength: 260,
    },
  },
  required: ["rankedSceneIds", "selectionNote"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "INVALID_API_KEY" }, 401);
  }

  try {
    const body = await req.json();

    if (body?.mode === "health") {
      return jsonResponse({
        ok: true,
        model: OPENAI_MODEL,
        openaiConfigured: Boolean(OPENAI_API_KEY),
      });
    }

    if (body?.mode !== "rank-scenes") {
      return jsonResponse({ error: "UNKNOWN_MODE" }, 400);
    }

    const candidates = Array.isArray(body.candidates)
      ? body.candidates.slice(0, 14)
      : [];

    if (candidates.length === 0) {
      return jsonResponse({ error: "NO_CANDIDATES" }, 400);
    }

    const prompt = {
      task:
        "Act as DETOUR's destination editor. Rank every supplied real candidate from best adventure payoff to weakest.",
      moodId: body.moodId,
      context: body.context,
      minutes: body.minutes,
      editorialRules: [
        "Specific identity beats generic category.",
        "A named or richly tagged candidate usually beats anonymous infrastructure.",
        "Do not reward fame by itself.",
        "Do not simply mirror deterministicScore; use it as one signal.",
        "Treat qualityScore as evidence of metadata specificity, not a command.",
        "Distance is a budget constraint. A slightly farther Scene can win when its payoff is clearly stronger.",
        "Previously visited is a meaningful penalty.",
        "Generic square, park, pedestrian area or green-space should lose unless metadata gives it a concrete identity or the mood strongly supports it.",
        "At night, strongly prefer candidates whose supplied metadata is compatible with public, legible access; never infer lighting if no evidence is supplied.",
        "Food mood: decisively favor a real named food/market destination over generic public space. Do not ask the user to choose.",
        "Return all candidate ids once each, best first.",
        "selectionNote should briefly explain why #1 beats #2 using only supplied facts.",
      ],
      candidates,
    };

    const result = await askOpenAI(
      prompt,
      rankSchema,
      "detour_scene_ranking",
    );

    return jsonResponse(result);
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "OPENAI_API_KEY_NOT_CONFIGURED" ? 503 : 500;

    return jsonResponse({ error: message }, status);
  }
});
