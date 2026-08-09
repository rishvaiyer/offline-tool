import express from "express";
import { fileURLToPath } from "node:url";
import { normaliseEvent, prepareEvents } from "./src/scoring.js";

const port = process.env.PORT || 3000;
const source = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json";
const cacheDurationMs = 5 * 60 * 1000;
const sourceLimit = 1000;

function cleanFilter(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function filtersFrom(query) {
  return {
    vertical: cleanFilter(query.vertical, "athletic"),
    goal: cleanFilter(query.goal, "sampling"),
    audience: cleanFilter(query.audience, "adults"),
    borough: cleanFilter(query.borough, "All"),
    energy: cleanFilter(query.energy, "any"),
    scale: cleanFilter(query.scale, "any")
  };
}

function currentDate(now) {
  return new Date(typeof now === "function" ? now() : now);
}

function queryWindowFor(now) {
  const current = currentDate(now);
  const start = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate()
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 120);
  return { start: start.toISOString(), end: end.toISOString() };
}

function facetsFor(events) {
  return {
    boroughs: [...new Set(events.map((event) => event.borough).filter(Boolean))].sort(),
    eventTypes: [...new Set(events.map((event) => event.type).filter(Boolean))].sort()
  };
}

export function createApp({ fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const app = express();
  const cache = new Map();

  async function getPublicEvents() {
    const queryWindow = queryWindowFor(now);
    const cacheKey = `${queryWindow.start}|${queryWindow.end}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached;

    const query = new URLSearchParams({
      "$select": "event_id,event_name,start_date_time,end_date_time,event_agency,event_type,event_borough,event_location",
      "$where": `start_date_time >= '${queryWindow.start.replace(/Z$/, "")}' AND start_date_time < '${queryWindow.end.replace(/Z$/, "")}'`,
      "$order": "start_date_time ASC",
      "$limit": String(sourceLimit + 1)
    });
    const response = await fetchImpl(`${source}?${query}`);

    if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);

    const records = await response.json();
    if (!Array.isArray(records)) throw new Error("NYC Open Data returned an invalid payload");
    const capped = records.length > sourceLimit;
    const events = records
      .slice(0, sourceLimit)
      .filter((record) => record.event_id && record.event_name && record.start_date_time)
      .map(normaliseEvent);

    const data = {
      expiresAt: Date.now() + cacheDurationMs,
      events,
      fetchedAt: currentDate(now).toISOString(),
      queryWindow,
      capped
    };
    cache.set(cacheKey, data);
    return data;
  }

  app.get("/api/health", (_request, response) => response.json({ ok: true }));

  app.get("/api/events", async (request, response) => {
    try {
      const data = await getPublicEvents();
      const filters = filtersFrom(request.query);
      const { results, counts } = prepareEvents(data.events, filters, currentDate(now));

      response.json({
        events: results,
        facets: facetsFor(data.events),
        fetchedAt: data.fetchedAt,
        source,
        queryWindow: data.queryWindow,
        counts,
        capped: data.capped
      });
    } catch {
      response.status(502).json({ error: "Public-event data is unavailable right now. Please try again shortly." });
    }
  });

  app.use(express.static("public"));
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createApp().listen(port, () => console.log(`Offline Signal Planner listening on ${port}`));
}
