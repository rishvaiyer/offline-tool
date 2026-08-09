const VERTICAL_LABELS = {
  apps: "app",
  athletic: "athletic",
  beauty: "beauty",
  beverage: "beverage",
  fashion: "fashion",
  fintech: "fintech",
  wellness: "wellness"
};

const GOAL_LABELS = {
  awareness: "build awareness",
  content: "create useful content",
  sampling: "invite sampling",
  signups: "invite opt-ins"
};

const ENERGY_LABELS = {
  active: "active",
  calm: "calm",
  social: "social",
  any: "welcoming"
};

const SCALE_LABELS = {
  small: "small",
  medium: "medium",
  large: "larger"
};

const ACTIVATION_TEMPLATES = {
  beverage: {
    sampling: {
      social: {
        small: {
          Market: "Offer a compact tasting ritual at the edge of the market, with clear consent and a useful takeaway for guests."
        },
        default: "Offer a compact tasting ritual that fits the gathering's social rhythm, with clear consent and a useful takeaway for guests."
      },
      default: "Offer a compact tasting ritual that fits the gathering, with clear consent and a useful takeaway for guests."
    },
    default: "Create a small beverage moment that adds a useful, optional contribution to the gathering."
  },
  wellness: {
    awareness: {
      calm: {
        default: "Create a quiet hydration or recovery station that supports the gathering without interrupting it."
      }
    },
    default: "Create an optional wellness contribution that supports the gathering without interrupting it."
  },
  default: {
    default: "Create an optional contribution that fits the gathering and gives guests a clear reason to take part."
  }
};

const GOAL_VALUE_ADDS = {
  awareness: "Give the room a simple, useful brand moment that guests can understand without a hard sell.",
  content: "Give guests a useful moment they can choose to document, while keeping the gathering's character in focus.",
  sampling: "Give guests a low-pressure way to try the product and leave with something useful.",
  signups: "Give interested guests a clear, consent-based next step that does not interrupt the room."
};

const MEASUREMENT = [
  { key: "attendance", label: "Attendance", method: "Use a consented check-in or host-provided attendance confirmation." },
  { key: "referral", label: "Referral", method: "Record the invitation or referral path used to reach each participant." },
  { key: "optIn", label: "Opt-in", method: "Count only explicit, consented brand actions such as a sign-up or follow-up request." },
  { key: "repeat", label: "Repeat", method: "Ask whether participants return to a later gathering or activity." },
  { key: "hostRenewal", label: "Host renewal", method: "Ask the Host whether they want to collaborate again and why." }
];

const HOST_QUESTIONS = [
  "Is the Host interested in this kind of contribution?",
  "What room norms should the activation respect?",
  "What operational capacity is available for setup, service, and cleanup?",
  "What accessibility needs should shape the experience?",
  "What consent language and opt-in process should be used?"
];

const LIMITATIONS = [
  "This direction uses a public record, not Offline's private Host inventory.",
  "Host interest, willingness, pricing, capacity, and relationship fit are still unknown.",
  "The public record does not establish attendance, conversion, reach, lift, or return.",
  "A real pilot requires Host agreement, operational design, accessibility review, and consent."
];

function clean(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
}

function label(table, value, fallback = "") {
  return table[value] ?? (clean(value) || fallback);
}

function eventTypeKey(event) {
  const type = clean(event.type);
  if (/market/i.test(type)) return "Market";
  if (/sport|run|soccer|athletic/i.test(type)) return "Sport";
  if (/festival/i.test(type)) return "Festival";
  if (/street/i.test(type)) return "Street event";
  return "default";
}

function lookupActivation(inputs, event) {
  const vertical = ACTIVATION_TEMPLATES[inputs.vertical] ?? ACTIVATION_TEMPLATES.default;
  const goal = vertical[inputs.goal] ?? vertical.default ?? ACTIVATION_TEMPLATES.default.default;
  const energy = goal[inputs.energy] ?? goal.default ?? ACTIVATION_TEMPLATES.default.default;
  const scale = energy[inputs.scale] ?? energy.default ?? ACTIVATION_TEMPLATES.default.default;
  return clean(scale[eventTypeKey(event)] ?? scale.default ?? ACTIVATION_TEMPLATES.default.default);
}

export function generateBrief(inputs, rankedResult) {
  const selected = rankedResult?.event ?? {};
  const vertical = label(VERTICAL_LABELS, inputs?.vertical, "brand");
  const goal = label(GOAL_LABELS, inputs?.goal, "add value");
  const audience = clean(inputs?.audience) || "people in the room";
  const borough = clean(inputs?.borough) || clean(selected.borough) || "the selected borough";
  const energy = label(ENERGY_LABELS, inputs?.energy, "welcoming");
  const scale = label(SCALE_LABELS, inputs?.scale, "small");
  const name = clean(selected.name) || "Selected public gathering";
  const location = clean(selected.location) || "the listed location";
  const type = clean(selected.type) || "public gathering";
  const eventBorough = clean(selected.borough) || borough;
  const sourceUrl = selected.id
    ? `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${encodeURIComponent(selected.id)}`
    : "";

  return {
    title: clean(`${vertical[0].toUpperCase()}${vertical.slice(1)} ${clean(inputs?.goal) || "brand moment"} at ${name}`),
    intent: clean(`Help ${audience} experience a ${energy} ${vertical} moment designed to ${goal} in ${borough}.`),
    gathering: clean(`${name} at ${location} in ${eventBorough}`),
    fit: clean(`This public signal matches the ${vertical} vertical, the ${clean(inputs?.goal) || "selected"} goal, the ${audience} audience, and the ${borough} geography. It is a ${scale} direction for a public gathering.`),
    activation: clean(`Starting direction: ${lookupActivation(inputs ?? {}, selected)}`),
    valueAdd: clean(GOAL_VALUE_ADDS[inputs?.goal] ?? "Give guests an optional, useful contribution that respects the room."),
    hostQuestions: HOST_QUESTIONS.map(clean),
    measurement: MEASUREMENT.map((item) => ({ ...item, label: clean(item.label), method: clean(item.method) })),
    limitations: LIMITATIONS.map(clean),
    sourceUrl
  };
}
