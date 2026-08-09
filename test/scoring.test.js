import test from "node:test";
import assert from "node:assert/strict";

import { normaliseEvent, rankEvents } from "../src/scoring.js";

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

test("rankEvents prioritizes a fitting event and makes its reason visible", () => {
  const ranked = rankEvents([
    normaliseEvent(rawEvent),
    { ...normaliseEvent(rawEvent), id: "2", name: "Street Festival", type: "Street Event", borough: "Queens" }
  ], { vertical: "athletic", goal: "sampling", borough: "All", eventType: "All" });

  assert.equal(ranked[0].event.id, "950351");
  assert.match(ranked[0].reason, /vertical fit/);
  assert.match(ranked[0].reason, /goal fit/);
});
