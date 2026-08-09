import test from "node:test";
import assert from "node:assert/strict";

import { normaliseEvent, prepareEvents, rankEvents } from "../src/scoring.js";

const rawEvent = {
  event_id: "950351",
  event_name: "Soccer - Regulation",
  start_date_time: "2026-10-15T16:00:00.000",
  end_date_time: "2026-10-15T18:00:00.000",
  event_agency: "Parks Department",
  event_type: "Sport - Youth",
  event_borough: "Brooklyn",
  event_location: "Red Hook Recreation Area: Soccer-05"
};

test("normaliseEvent maps the public NYC record into planner fields", () => {
  assert.deepEqual(normaliseEvent(rawEvent), {
    id: "950351",
    name: "Soccer - Regulation",
    start: "2026-10-15T16:00:00.000",
    end: "2026-10-15T18:00:00.000",
    agency: "Parks Department",
    type: "Sport - Youth",
    borough: "Brooklyn",
    location: "Red Hook Recreation Area: Soccer-05"
  });
});

const fixtures = [
  {
    id: "adult-1",
    name: "Brooklyn Community Run",
    start: "2026-08-12T15:00:00Z",
    end: "2026-08-12T17:00:00Z",
    agency: "Parks Department",
    type: "Sport - Running",
    borough: "Brooklyn",
    location: "Prospect Park"
  },
  {
    id: "youth-1",
    name: "Youth Soccer Clinic",
    start: "2026-08-13T15:00:00Z",
    end: "2026-08-13T17:00:00Z",
    agency: "Parks Department",
    type: "Sport - Youth",
    borough: "Brooklyn",
    location: "McCarren Park"
  },
  {
    id: "load-in-1",
    name: "Market Load-In",
    start: "2026-08-14T15:00:00Z",
    end: "2026-08-14T17:00:00Z",
    agency: "Events Office",
    type: "Production Load In",
    borough: "Brooklyn",
    location: "Prospect Park"
  },
  {
    id: "market-1",
    name: "Saturday Market",
    start: "2026-08-15T15:00:00Z",
    end: "2026-08-15T17:00:00Z",
    agency: "Public Markets",
    type: "Market",
    borough: "Brooklyn",
    location: "Grand Army Plaza"
  },
  {
    id: "market-duplicate",
    name: " Saturday  Market ",
    start: "2026-08-15T15:00:00Z",
    end: "2026-08-15T17:00:00Z",
    agency: "Public Markets",
    type: "Market",
    borough: "Brooklyn",
    location: "Grand Army Plaza"
  },
  {
    id: "admin-1",
    name: "Administrative Staff Meeting",
    start: "2026-08-16T15:00:00Z",
    end: "2026-08-16T17:00:00Z",
    agency: "City Office",
    type: "Administrative",
    borough: "Brooklyn",
    location: "Municipal Building"
  }
];

test("qualifies, deduplicates, and transparently ranks public signals", () => {
  const prepared = prepareEvents(fixtures, {
    vertical: "athletic",
    goal: "sampling",
    audience: "adults",
    borough: "Brooklyn",
    energy: "active",
    scale: "small"
  }, new Date("2026-08-09T12:00:00Z"));

  assert.equal(prepared.results[0].event.id, "adult-1");
  assert.equal(prepared.results[0].score <= 90, true);
  assert.deepEqual(Object.keys(prepared.results[0].components), [
    "vertical", "goal", "audience", "geography", "timing"
  ]);
  assert.equal(prepared.results.some(({ event }) => event.type.includes("Youth")), false);
  assert.equal(prepared.counts.duplicates, 1);
  assert.match(prepared.results[0].unknown.join(" "), /Host trust/);
});

test("uses stable start and identifier ordering for equal scores", () => {
  const events = fixtures.slice(0, 1).map((event) => ({ ...event, id: "z" })).concat({
    ...fixtures[0], id: "a", start: "2026-08-12T15:00:00Z", location: "McCarren Park"
  });

  const prepared = prepareEvents(events, {
    vertical: "athletic", goal: "sampling", audience: "adults", borough: "Brooklyn",
    energy: "active", scale: "small"
  }, new Date("2026-08-09T12:00:00Z"));

  assert.deepEqual(prepared.results.map(({ event }) => event.id), ["a", "z"]);
});

test("interprets floating event times in New York and excludes events that already started", () => {
  const events = [
    {
      ...fixtures[0],
      id: "already-started",
      start: "2026-08-09T09:00:00.000",
      end: "2026-08-09T11:00:00.000"
    },
    {
      ...fixtures[0],
      id: "future-local",
      start: "2026-08-09T10:00:00.000",
      end: "2026-08-09T12:00:00.000",
      location: "McCarren Park"
    }
  ];

  const prepared = prepareEvents(events, {
    vertical: "athletic", goal: "sampling", audience: "adults", borough: "Brooklyn",
    energy: "active", scale: "small"
  }, new Date("2026-08-09T13:30:00Z"));

  assert.deepEqual(prepared.results.map(({ event }) => event.id), ["future-local"]);
  assert.deepEqual(prepared.counts, { reviewed: 2, qualified: 1, excluded: 1, duplicates: 0 });
});

test("does not qualify records with no vertical or campaign-goal signal", () => {
  const unrelated = {
    ...fixtures[0],
    id: "unrelated",
    name: "Neighborhood Gathering",
    type: "Public Meeting",
    start: "2026-08-20T18:00:00.000",
    end: "2026-08-20T20:00:00.000"
  };

  const prepared = prepareEvents([unrelated], {
    vertical: "athletic", goal: "sampling", audience: "adults", borough: "Brooklyn",
    energy: "active", scale: "small"
  }, new Date("2026-08-09T12:00:00Z"));

  assert.deepEqual(prepared.results, []);
  assert.deepEqual(prepared.counts, { reviewed: 1, qualified: 0, excluded: 1, duplicates: 0 });
});

test("rankEvents excludes youth unless families is explicitly selected", () => {
  const filters = {
    vertical: "athletic", goal: "sampling", borough: "Brooklyn", eventType: "All"
  };
  const nonFamily = rankEvents([fixtures[1]], { ...filters, audience: "adults" });
  const family = rankEvents([fixtures[1]], { ...filters, audience: "families" });

  assert.deepEqual(nonFamily, []);
  assert.equal(family[0].event.id, "youth-1");
});

test("adult briefs exclude school-program language found in live NYC records", () => {
  const schoolPrograms = [
    { ...fixtures[0], id: "after-school", name: "Afterschool Fun", type: "Open Street Partner Event" },
    { ...fixtures[0], id: "students", name: "Open Street Recess for NYCPS Summer Rising Students", type: "Street Event" }
  ];
  const filters = {
    vertical: "beverage", goal: "awareness", borough: "All", eventType: "All"
  };

  assert.deepEqual(rankEvents(schoolPrograms, { ...filters, audience: "adults" }), []);
  assert.deepEqual(
    rankEvents(schoolPrograms, { ...filters, audience: "families" }).map(({ event }) => event.id),
    ["after-school", "students"]
  );
});

test("rankEvents preserves the eventType filter", () => {
  const ranked = rankEvents([fixtures[0], fixtures[3]], {
    vertical: "athletic",
    goal: "sampling",
    audience: "adults",
    borough: "Brooklyn",
    eventType: "Market"
  });

  assert.deepEqual(ranked.map(({ event }) => event.id), ["market-1"]);
});
