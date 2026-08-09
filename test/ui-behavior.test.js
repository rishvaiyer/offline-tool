import test from "node:test";
import assert from "node:assert/strict";

const planner = await import("../public/planner.js");

test("uses three primary results when available and truthful sparse copy otherwise", () => {
  const abundant = planner.shortlistPresentation([1, 2, 3, 4]);
  const sparse = planner.shortlistPresentation([1, 2]);

  assert.deepEqual(abundant.primary, [1, 2, 3]);
  assert.deepEqual(abundant.additional, [4]);
  assert.equal(abundant.heading, "Three rooms to investigate");
  assert.equal(abundant.summary, "3 primary signals");

  assert.deepEqual(sparse.primary, [1, 2]);
  assert.deepEqual(sparse.additional, []);
  assert.equal(sparse.heading, "Two rooms to investigate");
  assert.equal(sparse.summary, "2 qualified signals");
});

test("formats query-window boundaries as UTC calendar dates", () => {
  assert.equal(planner.formatUtcDate("2026-08-09T00:00:00.000Z"), "Aug 9, 2026");
  assert.equal(planner.formatUtcDate("2026-12-07T00:00:00.000Z"), "Dec 7, 2026");
  assert.equal(planner.formatUtcDate("not-a-date"), null);
});

test("preserves reviewed, qualified, excluded, and duplicate counts separately", () => {
  assert.deepEqual(planner.statsRows({
    reviewed: 12,
    qualified: 7,
    excluded: 3,
    duplicates: 2
  }), [
    [12, "records reviewed"],
    [7, "qualified signals"],
    [3, "records excluded"],
    [2, "duplicates removed"]
  ]);
});

test("custom start clears prior results, brief selection, and event URL state", () => {
  const defaults = {
    vertical: "athletic",
    goal: "sampling",
    audience: "adults",
    borough: "All",
    energy: "active",
    scale: "small"
  };
  const state = {
    mode: "sample",
    filters: { vertical: "beverage" },
    events: [{ event: { id: "old" } }],
    selectedEventId: "old",
    brief: { eventId: "old" }
  };

  planner.resetCustomState(state, defaults);
  const url = new URL(planner.plannerUrl("https://planner.test/?event=old", state.filters, state.selectedEventId));

  assert.deepEqual(state, {
    mode: "custom",
    filters: defaults,
    events: [],
    selectedEventId: null,
    brief: null
  });
  assert.equal(url.searchParams.get("event"), null);
  assert.equal(url.searchParams.get("vertical"), "athletic");
  assert.equal(url.searchParams.get("scale"), "small");
});

test("only the newest overlapping request can commit UI state", () => {
  const tracker = planner.createRequestTracker();
  const committed = [];
  const older = tracker.begin();
  const newer = tracker.begin();

  assert.equal(tracker.commit(older, () => committed.push("older")), false);
  assert.equal(tracker.commit(newer, () => committed.push("newer")), true);
  assert.deepEqual(committed, ["newer"]);
});

test("loading or error metadata clears the prior successful source snapshot", () => {
  const success = planner.metadataText({
    fetchedAt: "2026-08-09T12:00:00.000Z",
    queryWindow: {
      start: "2026-08-09T00:00:00.000Z",
      end: "2026-12-07T00:00:00.000Z"
    },
    capped: false
  });
  const cleared = planner.metadataText(null);

  assert.match(success, /Window Aug 9, 2026 to Dec 7, 2026/);
  assert.doesNotMatch(cleared, /Aug 9|Dec 7|Fetched/);
  assert.equal(cleared, "Source details appear after a successful search.");
});

test("successful results move focus and the visual viewport to the heading", () => {
  const calls = [];
  const heading = {
    focus(options) { calls.push(["focus", options]); },
    scrollIntoView(options) { calls.push(["scroll", options]); }
  };

  assert.equal(planner.revealElement(heading, { focus: true, reducedMotion: false }), true);
  assert.deepEqual(calls, [
    ["focus", { preventScroll: true }],
    ["scroll", { behavior: "smooth", block: "start" }]
  ]);
});

test("JavaScript reveal paths avoid animation when reduced motion is requested", () => {
  const calls = [];
  const section = {
    scrollIntoView(options) { calls.push(options); }
  };

  planner.revealElement(section, { reducedMotion: true });
  assert.deepEqual(calls, [{ behavior: "auto", block: "start" }]);
});

test("escapes dynamic record copy and encodes source identifiers", () => {
  assert.equal(planner.escapeHtml(`<img src=x onerror="bad"> & 'quoted'`), "&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; &#039;quoted&#039;");
  assert.equal(
    planner.sourceUrl("record & one"),
    "https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=record%20%26%20one"
  );
});
