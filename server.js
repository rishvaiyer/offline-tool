import express from "express";
import { normaliseEvent, rankEvents } from "./src/scoring.js";

const app = express();
const port = process.env.PORT || 3000;
const source = "https://data.cityofnewyork.us/resource/tvpp-9vvx.json";
const cache = { expiresAt: 0, events: [], fetchedAt: null };

function cleanFilter(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function filtersFrom(query) {
  return {
    vertical: cleanFilter(query.vertical, "athletic"),
    goal: cleanFilter(query.goal, "sampling"),
    borough: cleanFilter(query.borough, "All"),
    eventType: cleanFilter(query.eventType, "All")
  };
}

async function getPublicEvents() {
  if (Date.now() < cache.expiresAt && cache.events.length) return cache;

  const today = new Date().toISOString().slice(0, 10);
  const query = new URLSearchParams({
    "$select": "event_id,event_name,start_date_time,end_date_time,event_agency,event_type,event_borough,event_location",
    "$where": `start_date_time >= '${today}T00:00:00.000'`,
    "$order": "start_date_time ASC",
    "$limit": "250"
  });
  const response = await fetch(`${source}?${query}`);

  if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);

  const records = await response.json();
  const events = records
    .filter((record) => record.event_id && record.event_name && record.start_date_time)
    .map(normaliseEvent);

  cache.events = events;
  cache.fetchedAt = new Date().toISOString();
  cache.expiresAt = Date.now() + 5 * 60 * 1000;
  return cache;
}

app.get("/api/health", (_request, response) => response.json({ ok: true }));

app.get("/api/events", async (request, response) => {
  try {
    const data = await getPublicEvents();
    const filters = filtersFrom(request.query);
    const results = rankEvents(data.events, filters);
    const boroughs = [...new Set(data.events.map((event) => event.borough).filter(Boolean))].sort();
    const eventTypes = [...new Set(data.events.map((event) => event.type).filter(Boolean))].sort();

    response.json({
      events: results,
      facets: { boroughs, eventTypes },
      fetchedAt: data.fetchedAt,
      source
    });
  } catch (error) {
    response.status(502).json({ error: "Public-event data is unavailable right now. Please try again shortly." });
  }
});

app.use(express.static("public"));
app.listen(port, () => console.log(`Offline Signal Planner listening on ${port}`));
