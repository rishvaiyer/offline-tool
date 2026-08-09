import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const planner = await import("../public/planner.js");

const DEFAULTS = {
  vertical: "athletic",
  goal: "sampling",
  audience: "adults",
  borough: "All",
  energy: "active",
  scale: "small"
};

function fakeElement({ value = "", options = [] } = {}) {
  const listeners = new Map();
  let manualCopy = null;
  return {
    value,
    options,
    hidden: false,
    innerHTML: "",
    textContent: "",
    dataset: {},
    classList: { toggle() {} },
    addEventListener(type, handler) { listeners.set(type, handler); },
    emit(type, event = {}) { return listeners.get(type)?.(event); },
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = true; },
    setAttribute() {},
    removeAttribute() {},
    replaceChildren(...children) { this.options = children; },
    add(child) { this.options.push(child); },
    append(child) {
      manualCopy = child;
      child.remove = () => { if (manualCopy === child) manualCopy = null; };
    },
    querySelector(selector) { return selector === ".manual-copy" ? manualCopy : null; }
  };
}

function createBrowser({ href = "https://planner.test/", fetchImpl, clipboard = { writeText: async () => {} } } = {}) {
  const selects = Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [
    key,
    fakeElement({ value, options: key === "borough" ? [{ value: "All" }] : [{ value }]
    })
  ]));
  const form = fakeElement();
  form.elements = selects;
  const briefContent = fakeElement();
  const briefTitle = fakeElement();
  const nodes = {
    "#filters": form,
    "#borough": selects.borough,
    "#results-section": fakeElement(),
    "#results": fakeElement(),
    "#stats": fakeElement(),
    "#result-summary": fakeElement(),
    "#workflow-status": fakeElement(),
    "#step-number": fakeElement(),
    "#sample-badge": fakeElement(),
    "#source-meta": fakeElement(),
    "#brief-output": fakeElement(),
    "#brief-content": briefContent,
    "#brief-action-status": fakeElement(),
    "#results-title": fakeElement(),
    "#sample-start": fakeElement(),
    "#custom-start": fakeElement(),
    "#edit-from-start": fakeElement(),
    "#copy-brief": fakeElement(),
    "#print-brief": fakeElement(),
    "#copy-share-link": fakeElement(),
    "#reset-brief": fakeElement(),
    "#brief-title": briefTitle
  };
  const steps = [1, 2, 3].map((step) => ({ ...fakeElement(), dataset: { step: String(step) } }));
  const document = {
    querySelector(selector) {
      if (selector.startsWith(".form-step")) return selects.vertical;
      return nodes[selector] ?? null;
    },
    querySelectorAll(selector) {
      if (selector === ".form-step") return steps;
      if (selector === ".disclosure") return [];
      return [];
    },
    createElement() {
      const textarea = fakeElement();
      textarea.select = () => { textarea.selected = true; };
      return textarea;
    }
  };
  const location = { href };
  const window = {
    location,
    history: {
      replaceState(_state, _title, nextUrl) { location.href = new URL(nextUrl, location.href).href; }
    },
    matchMedia: () => ({ matches: false }),
    print() { window.printed = true; }
  };

  return {
    nodes,
    selects,
    globals: { document, window, navigator: { clipboard }, fetch: fetchImpl, Option: class Option { constructor(text, value) { this.text = text; this.value = value; } } }
  };
}

function installBrowser(browser) {
  Object.assign(globalThis, {
    document: browser.globals.document,
    window: browser.globals.window,
    fetch: browser.globals.fetch,
    Option: browser.globals.Option
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: browser.globals.navigator
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

function response(events) {
  return {
    ok: true,
    json: async () => ({
      events,
      facets: { boroughs: ["Queens"] },
      counts: { reviewed: 1, qualified: 1, excluded: 0, duplicates: 0 },
      fetchedAt: "2026-08-09T12:00:00.000Z",
      queryWindow: { start: "2026-08-09T00:00:00.000Z", end: "2026-12-07T00:00:00.000Z" },
      capped: false
    })
  };
}

const rankedEvent = {
  event: {
    id: "old-event",
    name: "Queens Night Market",
    type: "Market",
    start: "2026-08-22T18:00:00.000Z",
    borough: "Queens",
    location: "Flushing Meadows Corona Park"
  },
  score: 72,
  components: { vertical: 30, goal: 25, audience: 15, geography: 0, timing: 2 },
  matched: ["vertical", "goal", "audience"],
  unknown: ["geography", "timing"]
};

async function loadApp(browser) {
  installBrowser(browser);
  await import(`../public/app.js?behavior-test=${Date.now()}-${Math.random()}`);
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

function sharedHref() {
  return "https://planner.test/?vertical=athletic&goal=sampling&audience=adults&borough=All&energy=active&scale=small&event=old-event";
}

async function restoreSelectedEvent(browser) {
  await loadApp(browser);
  await settle();
  await settle();
  await settle();
}

test("filter edits invalidate a deferred shared-event restoration", { concurrency: false }, async () => {
  const firstResponse = deferred();
  const browser = createBrowser({
    href: sharedHref(),
    fetchImpl: () => firstResponse.promise
  });
  browser.nodes["#brief-output"].hidden = true;
  await loadApp(browser);

  browser.selects.vertical.value = "beverage";
  browser.nodes["#filters"].emit("change");
  assert.equal(browser.nodes["#results-section"].hidden, true);
  assert.equal(browser.nodes["#results"].innerHTML, "");
  assert.match(browser.nodes["#workflow-status"].textContent, /choices changed.*submit/i);
  firstResponse.resolve(response([rankedEvent]));
  await settle();
  await settle();

  assert.equal(new URL(browser.globals.window.location.href).searchParams.get("event"), null);
  assert.equal(browser.nodes["#brief-output"].hidden, true);
  assert.doesNotMatch(browser.nodes["#brief-content"].innerHTML, /Queens Night Market/);
});

test("clipboard rejection exposes selected manual brief copy", { concurrency: false }, async () => {
  const browser = createBrowser({
    href: sharedHref(),
    fetchImpl: async () => response([rankedEvent]),
    clipboard: { writeText: async () => { throw new Error("denied"); } }
  });
  await restoreSelectedEvent(browser);

  browser.nodes["#copy-brief"].emit("click");
  await settle();

  const manual = browser.nodes["#brief-content"].querySelector(".manual-copy");
  assert.ok(manual, `brief status: ${browser.nodes["#workflow-status"].textContent}; results: ${browser.nodes["#results"].innerHTML}`);
  assert.equal(manual.selected, true);
  assert.match(manual.value, /Limitations:/);
  assert.match(browser.nodes["#brief-action-status"].textContent, /copy it manually/i);
});

test("reset clears the shared URL and returns focus to Build my own", { concurrency: false }, async () => {
  const browser = createBrowser({ href: sharedHref(), fetchImpl: async () => response([rankedEvent]) });
  await restoreSelectedEvent(browser);

  browser.nodes["#reset-brief"].emit("click");

  assert.equal(browser.globals.window.location.href, "https://planner.test/");
  assert.equal(browser.nodes["#brief-output"].hidden, true);
  assert.equal(browser.nodes["#custom-start"].focused, true);
});

test("print details visibly include source and limitations while hiding controls", { concurrency: false }, async () => {
  const browser = createBrowser({ href: sharedHref(), fetchImpl: async () => response([rankedEvent]) });
  await restoreSelectedEvent(browser);
  const rendered = browser.nodes["#brief-content"].innerHTML;
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(rendered, /<p class="brief-source-url">https:\/\/data\.cityofnewyork\.us\/resource\/tvpp-9vvx\.json\?event_id=old-event<\/p>/);
  assert.match(rendered, /<h4>Limitations<\/h4>/);
  assert.match(css, /\.brief-details summary\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /@media print[\s\S]*\.brief-actions[^}]*display:\s*none/);
  assert.match(css, /@media print[\s\S]*\.brief-details[^}]*display:\s*block/);
});

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
