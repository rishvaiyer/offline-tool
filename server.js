import express from "express";
import { fileURLToPath } from "node:url";
import { normaliseEvent, prepareEvents } from "./src/scoring.js";

const port = process.env.PORT || 3000;
const source = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json";
const cacheDurationMs = 5 * 60 * 1000;
const sourcePageSize = 5000;
const sourceMaxRecords = 50000;
const newYorkDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

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
  const parts = Object.fromEntries(
    newYorkDateFormatter.formatToParts(current).map(({ type, value }) => [type, value])
  );
  const startDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 120);
  const floating = (date) => `${date.toISOString().slice(0, 10)}T00:00:00.000`;
  return { start: floating(startDate), end: floating(endDate) };
}

function facetsFor(events) {
  return {
    boroughs: [...new Set(events.map((event) => event.borough).filter(Boolean))].sort(),
    eventTypes: [...new Set(events.map((event) => event.type).filter(Boolean))].sort()
  };
}

export function createApp({ fetchImpl = globalThis.fetch, now = () => new Date(), upstreamTimeoutMs = 10000 } = {}) {
  const app = express();
  const cache = new Map();

  async function getPublicEvents() {
    const queryWindow = queryWindowFor(now);
    const cacheKey = `${queryWindow.start}|${queryWindow.end}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached;

    const records = [];
    let capped = false;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), upstreamTimeoutMs);
    try {
      while (records.length < sourceMaxRecords) {
        const query = new URLSearchParams({
          "$select": "event_id,event_name,start_date_time,end_date_time,event_agency,event_type,event_borough,event_location",
          "$where": `start_date_time >= '${queryWindow.start.replace(/Z$/, "")}' AND start_date_time < '${queryWindow.end.replace(/Z$/, "")}'`,
          "$order": "start_date_time ASC,event_id ASC",
          "$limit": String(sourcePageSize),
          "$offset": String(records.length)
        });
        const response = await fetchImpl(`${source}?${query}`, { signal: abortController.signal });

        if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);

        const page = await response.json();
        if (!Array.isArray(page)) throw new Error("NYC Open Data returned an invalid payload");
        records.push(...page.slice(0, sourceMaxRecords - records.length));
        if (page.length < sourcePageSize) break;
      }

      if (records.length === sourceMaxRecords) {
        const probe = new URLSearchParams({
          "$select": "event_id",
          "$where": `start_date_time >= '${queryWindow.start.replace(/Z$/, "")}' AND start_date_time < '${queryWindow.end.replace(/Z$/, "")}'`,
          "$order": "start_date_time ASC,event_id ASC",
          "$limit": "1",
          "$offset": String(sourceMaxRecords)
        });
        const response = await fetchImpl(`${source}?${probe}`, { signal: abortController.signal });
        if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);
        const page = await response.json();
        if (!Array.isArray(page)) throw new Error("NYC Open Data returned an invalid payload");
        capped = page.length > 0;
      }
    } finally {
      clearTimeout(timeout);
    }

    const events = records
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
        events: results.slice(0, 12),
        facets: facetsFor(data.events),
        fetchedAt: data.fetchedAt,
        source,
        queryWindow: data.queryWindow,
        counts,
        capped: data.capped,
        sourceReviewLimit: sourceMaxRecords
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
