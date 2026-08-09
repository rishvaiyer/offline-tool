const verticalSignals = {
  athletic: [/sport/i, /soccer/i, /run/i, /rugby/i, /cricket/i],
  beverage: [/market/i, /food/i, /open street/i],
  wellness: [/sport/i, /park/i, /open street/i],
  beauty: [/street/i, /market/i, /festival/i],
  fintech: [/open street/i, /street event/i, /festival/i],
  fashion: [/street/i, /market/i, /festival/i],
  apps: [/open street/i, /street event/i, /festival/i]
};

const goalSignals = {
  sampling: [/market/i, /sport/i],
  awareness: [/street event/i, /open street/i, /festival/i],
  signups: [/open street/i, /street event/i, /festival/i],
  content: [/street event/i, /market/i, /festival/i]
};

const exclusionPattern = /load[ -]?in|load[ -]?out|setup|breakdown|production hold|administrative/i;
const componentNames = ["vertical", "goal", "audience", "geography", "timing"];
const unknownSignals = [
  "Host trust",
  "willingness",
  "pricing",
  "capacity",
  "relationship fit"
];

export function normaliseEvent(record) {
  return {
    id: record.event_id,
    name: record.event_name,
    start: record.start_date_time,
    end: record.end_date_time,
    agency: record.event_agency,
    type: record.event_type,
    borough: record.event_borough,
    location: record.event_location
  };
}

function eventText(event) {
  return `${event.name ?? ""} ${event.type ?? ""} ${event.location ?? ""}`;
}

function matches(signalSet, event) {
  return signalSet.some((pattern) => pattern.test(eventText(event)));
}

function normaliseKey(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isYouth(event) {
  return /youth|children|child|kids|junior/i.test(`${event.name ?? ""} ${event.type ?? ""}`);
}

function scoreEvent(event, filters, now) {
  const start = new Date(event.start);
  const vertical = matches(verticalSignals[filters.vertical] ?? [], event) ? 30 : 0;
  const goal = matches(goalSignals[filters.goal] ?? [], event) ? 25 : 0;
  const audience = filters.audience === "families" || !isYouth(event) ? 15 : 0;
  const geography = filters.borough === "All" || event.borough === filters.borough ? 10 : 0;
  const timing = Number.isNaN(start.getTime()) || start <= now ? 0 : 10;
  const components = { vertical, goal, audience, geography, timing };
  const matched = componentNames.filter((component) => components[component] > 0);
  const unknown = unknownSignals.slice();

  return {
    event,
    score: Math.min(90, Object.values(components).reduce((total, value) => total + value, 0)),
    components,
    matched,
    unknown
  };
}

function duplicateKey(event) {
  return [event.name, event.location, event.type, event.start].map(normaliseKey).join("|");
}

export function prepareEvents(events, filters, now = new Date()) {
  const counts = { reviewed: events.length, qualified: 0, excluded: 0, duplicates: 0 };
  const seen = new Set();
  const results = [];

  for (const event of events) {
    const outOfScope = filters.borough !== "All" && event.borough !== filters.borough;
    const wrongAudience = filters.audience !== "families" && isYouth(event);
    if (outOfScope || wrongAudience || exclusionPattern.test(`${event.name ?? ""} ${event.type ?? ""}`)) {
      counts.excluded += 1;
      continue;
    }

    const key = duplicateKey(event);
    if (seen.has(key)) {
      counts.duplicates += 1;
      continue;
    }
    seen.add(key);
    results.push(scoreEvent(event, filters, now));
  }

  counts.qualified = results.length;
  results.sort((a, b) => b.score - a.score || a.event.start.localeCompare(b.event.start) || String(a.event.id).localeCompare(String(b.event.id)));
  return { results, counts };
}

export function rankEvents(events, filters) {
  const eventType = filters.eventType ?? "All";
  const scopedEvents = eventType === "All"
    ? events
    : events.filter((event) => event.type === eventType);

  return prepareEvents(scopedEvents, {
    ...filters,
    audience: filters.audience ?? "adults",
    energy: filters.energy ?? "any",
    scale: filters.scale ?? "any"
  }).results.map((result) => ({
    event: result.event,
    value: result.score,
    reason: result.matched.length ? result.matched.join(" · ") : "broad public-event signal"
  }));
}
