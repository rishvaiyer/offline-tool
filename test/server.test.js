import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../server.js";

const upstreamRecords = [
  {
    event_id: "adult-1", event_name: "Brooklyn Community Run", start_date_time: "2026-08-12T15:00:00Z",
    end_date_time: "2026-08-12T17:00:00Z", event_agency: "Parks", event_type: "Sport - Running",
    event_borough: "Brooklyn", event_location: "Prospect Park"
  },
  {
    event_id: "youth-1", event_name: "Youth Soccer Clinic", start_date_time: "2026-08-13T15:00:00Z",
    end_date_time: "2026-08-13T17:00:00Z", event_agency: "Parks", event_type: "Sport - Youth",
    event_borough: "Brooklyn", event_location: "McCarren Park"
  },
  {
    event_id: "load-in-1", event_name: "Market Load-In", start_date_time: "2026-08-14T15:00:00Z",
    end_date_time: "2026-08-14T17:00:00Z", event_agency: "Events", event_type: "Production Load In",
    event_borough: "Brooklyn", event_location: "Prospect Park"
  },
  {
    event_id: "market-1", event_name: "Saturday Market", start_date_time: "2026-08-15T15:00:00Z",
    end_date_time: "2026-08-15T17:00:00Z", event_agency: "Markets", event_type: "Market",
    event_borough: "Brooklyn", event_location: "Grand Army Plaza"
  },
  {
    event_id: "market-duplicate", event_name: " Saturday  Market ", start_date_time: "2026-08-15T15:00:00Z",
    end_date_time: "2026-08-15T17:00:00Z", event_agency: "Markets", event_type: "Market",
    event_borough: "Brooklyn", event_location: "Grand Army Plaza"
  }
];

async function request(app, path) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const address = server.address();
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("returns prepared events with bounded-source metadata", async () => {
  const requests = [];
  const app = createApp({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return new Response(JSON.stringify(upstreamRecords), { status: 200 });
    },
    now: new Date("2026-08-09T12:00:00Z")
  });

  const response = await request(app, "/api/events?vertical=athletic&goal=sampling&audience=adults&borough=Brooklyn&energy=active&scale=small");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.counts, { reviewed: 5, qualified: 2, excluded: 2, duplicates: 1 });
  assert.equal(body.capped, false);
  assert.match(body.queryWindow.start, /^2026-08-09/);
  assert.match(body.queryWindow.end, /^2026-/);
  assert.deepEqual(body.facets, { boroughs: ["Brooklyn"], eventTypes: ["Market", "Production Load In", "Sport - Running", "Sport - Youth"] });
  assert.equal(body.events[0].event.id, "adult-1");
  assert.equal(requests[0].searchParams.get("$limit"), "1001");
});

test("contains upstream failures behind the existing safe error", async () => {
  const app = createApp({
    fetchImpl: async () => new Response("database password: leaked", { status: 503 }),
    now: new Date("2026-08-09T12:00:00Z")
  });

  const response = await request(app, "/api/events");
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.deepEqual(body, { error: "Public-event data is unavailable right now. Please try again shortly." });
  assert.doesNotMatch(JSON.stringify(body), /database password|leaked|503/i);
});

test("caches a stable daily query window for five minutes", async () => {
  let callCount = 0;
  let clock = new Date("2026-08-09T12:00:00Z");
  const app = createApp({
    fetchImpl: async () => {
      callCount += 1;
      return new Response(JSON.stringify(upstreamRecords), { status: 200 });
    },
    now: () => clock
  });

  await request(app, "/api/events");
  clock = new Date("2026-08-09T12:01:00Z");
  await request(app, "/api/events");

  assert.equal(callCount, 1);
});
