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
You are DETOUR's creative director, not a generic travel assistant.

DETOUR turns an ordinary free gap into one small, specific real-world adventure.
The user gives DETOUR time and mood. DETOUR makes the decisions.

VOICE
- Output Traditional Chinese except short uppercase English mission codes.
- Calm, precise, slightly playful. Never motivational, philosophical, cute, or tour-guide-like.
- No emoji.
- Avoid filler such as 「不妨」「試著」「感受」「探索一下」「看看周圍」「留意身邊」.
- A task should make the user immediately know what to physically do.

TRUTH
- Use only facts supplied in the request.
- Never invent history, architecture, scenery, opening status, crowd level, safety conditions, objects, storefront details, or local knowledge.
- AI may rank supplied real Scene candidates but may never create a new destination.

SAFETY
- Public walkable space only.
- Never require private property, trespassing, unsafe crossings, climbing, running into traffic, following strangers, touching strangers or their property, buying something, or interacting with a stranger.
- Never ask the user to close their eyes.
- Never instruct the user to stop in a place that blocks pedestrians or traffic.
- At night, keep tasks compatible with lit public walking and never encourage dark alleys, secluded corners, parks, stairs, bridges, waterfront edges, or isolated shortcuts.

SIDE QUEST DESIGN
- Side quests are portable: they happen along the hidden route and MUST NOT reveal or name the destination.
- Each quest should take about 10–45 seconds.
- Each quest needs an objective completion condition.
- Make each quest use a different mechanic/family within one journey.
- Prefer: counting, contrast, scale, texture, sound, movement, framing, boundaries, patterns, perspective.
- Do not require a specific object that may not exist on the route.
- Use the supplied mission slot phase:
  warmup = extremely easy, immediate success;
  discover = notice a concrete pattern while walking;
  shift = change how the same street is perceived without detouring;
  anticipate = create slight tension before arrival without revealing the destination.
- Do not repeat recent mission titles, codes, or the same mechanic when recentMissions are supplied.
- At most one side quest may require a photo. Photo=false is preferred.

ARRIVAL DESIGN
- Arrival is the payoff. The destination is now revealed by the app.
- Arrival may use supplied Scene name/type/tags, but only facts actually present.
- Give one concise task that makes this exact Scene worth stopping for.
- Do not turn arrival into a history lesson.
- Food mood: DETOUR already chose the place. Do not ask the user what to eat or whether to choose another place. Never require a purchase; the task must still be completable from public space.

MOOD TASTE
- wander: layered street texture, transitions, little discoveries; avoid headline-tourist logic.
- food: choose a real food/market candidate decisively; named and specific beats generic.
- quiet: low-friction, calm, legible public space; avoid noisy novelty for novelty's sake.
- weird: specific visual identity, odd scale, art, strange contrast, unusual form; weird must not mean unsafe.
- surprise: strongest story/payoff and novelty; avoid the most obvious generic option if a credible specific alternative exists.
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
      max_output_tokens: 2400,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OPENAI_${response.status}:${body.slice(0, 240)}`);
  }

  const raw = await response.json();
  const text = outputText(raw);

  if (!text) {
    throw new Error("OPENAI_NO_OUTPUT_TEXT");
  }

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

function missionSchema(sideMissionCount: number) {
  const mission = {
    type: "object",
    additionalProperties: false,
    properties: {
      code: {
        type: "string",
        minLength: 2,
        maxLength: 32,
      },
      family: {
        type: "string",
        enum: [
          "count",
          "contrast",
          "scale",
          "texture",
          "sound",
          "movement",
          "framing",
          "boundary",
          "pattern",
          "perspective",
        ],
      },
      title: {
        type: "string",
        minLength: 2,
        maxLength: 70,
      },
      instruction: {
        type: "string",
        minLength: 4,
        maxLength: 220,
      },
      completion: {
        type: "string",
        minLength: 2,
        maxLength: 140,
      },
      photo: { type: "boolean" },
    },
    required: [
      "code",
      "family",
      "title",
      "instruction",
      "completion",
      "photo",
    ],
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      sideMissions: {
        type: "array",
        minItems: sideMissionCount,
        maxItems: sideMissionCount,
        items: mission,
      },
      arrivalMission: mission,
      creativeNote: {
        type: "string",
        maxLength: 260,
      },
    },
    required: ["sideMissions", "arrivalMission", "creativeNote"],
  };
}

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

    if (body?.mode === "rank-scenes") {
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
          "At night, strongly prefer candidates whose supplied metadata is compatible with public, lit, legible access; never infer lighting if no evidence is supplied.",
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
    }

    if (body?.mode === "generate-missions") {
      const sideMissionCount = Math.max(
        0,
        Math.min(8, Number(body.sideMissionCount) || 0),
      );

      const slots = Array.isArray(body.missionSlots)
        ? body.missionSlots.slice(0, sideMissionCount)
        : [];

      const recentMissions = Array.isArray(body.recentMissions)
        ? body.recentMissions.slice(0, 18)
        : [];

      const prompt = {
        task:
          "Direct one complete DETOUR. Write exactly one side quest for every supplied mission slot, then one destination-specific arrival mission.",
        moodId: body.moodId,
        context: body.context,
        minutes: body.minutes,
        route: body.route,
        destination: body.scene,
        missionSlots: slots,
        recentMissions,
        hardRequirements: [
          `Return exactly ${sideMissionCount} side missions in the same order as missionSlots.`,
          "Every side mission must use a different family.",
          "Do not repeat a recent title, code, or obvious mechanic.",
          "Side quests cannot reveal the destination name, type, identity, or a clue so specific that the hidden destination becomes obvious.",
          "A portable side quest must not assume a mural, sign, shop, traffic light, tree, bench, staircase, person, animal, vehicle, water, or any other specific object will exist.",
          "Completion must be objective: count reached, comparison made, frame found, two sounds identified, boundary identified, etc.",
          "Keep title short. Keep instruction to one or two short sentences.",
          "At most one side mission may have photo=true.",
          "Arrival must be about the supplied destination and should feel meaningfully different from the side quests.",
          "For food mood, arrival must not require purchasing, ordering, entering, or choosing a dish.",
        ],
      };

      const result = await askOpenAI(
        prompt,
        missionSchema(sideMissionCount),
        "detour_mission_plan",
      );

      return jsonResponse(result);
    }

    return jsonResponse({ error: "UNKNOWN_MODE" }, 400);
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const status =
      message === "OPENAI_API_KEY_NOT_CONFIGURED" ? 503 : 500;

    return jsonResponse({ error: message }, status);
  }
});
