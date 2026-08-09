# Offline One-Minute Brief Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing event explorer into a mobile-first flow that converts a six-part campaign intent into three transparent public signals and one compact, portable, sourced campaign brief.

**Architecture:** Keep the Express application and dependency-light browser client. Split pure event qualification, scoring, and brief generation into testable modules, return source metadata from the API, and render the flow as progressive UI states without a framework.

**Tech Stack:** Node.js 22+, Express 5, native `node:test`, semantic HTML, CSS, and browser JavaScript.

## Global Constraints

- The sample path must take under one minute and a custom path under two minutes.
- The first planner action must appear within the first 844px at 390px wide.
- The score maximum is 90 and must never imply attendance, trust, pricing, conversion, lift, reach, or return.
- Youth events are excluded unless the intended audience explicitly allows them.
- Host trust, willingness, pricing, capacity, and relationship fit remain unscored.
- Every result keeps a visible source action and a visible selection action.
- The generated brief is deterministic, template-based, and explicitly labelled as a starting direction.
- The collapsed brief is a one-screen summary; Host questions, measurement, limitations, and methodology sit behind one `Open details` control.
- All actionable controls have a minimum 44px touch target.
- There are no em dashes in user-facing copy.
- No authentication, private Host inventory, pricing, campaign budgeting, hidden AI, or production analytics are added.

---

## File Map

- `src/scoring.js`: normalize, qualify, deduplicate, score, and rank public event records.
- `public/brief.js`: validate brief inputs and deterministically generate activation and measurement content for both browser use and Node tests.
- `server.js`: bounded NYC Open Data query, cache, API filter parsing, metadata, and static delivery.
- `public/index.html`: semantic one-minute flow, brief output, methodology, and research-source disclosure.
- `public/app.js`: client state, sample/custom paths, URL restoration, rendering, copy, print, reset, and error recovery.
- `public/styles.css`: responsive compact UI, controls, cards, brief sheet, print view, and reduced motion.
- `test/scoring.test.js`: qualification, deduplication, scoring, ranking, and tie-order tests.
- `test/brief.test.js`: deterministic brief-generation and boundary tests.
- `test/server.test.js`: API query metadata and upstream-error behavior using exported app dependencies.
- `test/ui-contract.test.js`: static accessibility and source-visibility contracts.

### Task 1: Public Signal Qualification and Transparent Ranking

**Files:**
- Modify: `src/scoring.js`
- Modify: `test/scoring.test.js`

**Interfaces:**
- Consumes: normalized NYC records with `id`, `name`, `start`, `end`, `agency`, `type`, `borough`, and `location`.
- Produces: `prepareEvents(events, filters, now)` returning `{ results, counts }`, where every result has `{ event, score, components, matched, unknown }` and counts has `{ reviewed, qualified, excluded, duplicates }`.

- [ ] **Step 1: Replace the legacy ranking test with failing behavior tests**

Add fixtures for an adult athletic event, youth sport, production load-in, duplicate market, and unrelated administrative record. Assert:

```js
const prepared = prepareEvents(fixtures, {
  vertical: "athletic",
  goal: "sampling",
  audience: "adults",
  borough: "Brooklyn",
  energy: "active",
  scale: "small"
}, new Date("2026-08-09T12:00:00Z"));

assert.equal(prepared.results[0].score <= 90, true);
assert.deepEqual(Object.keys(prepared.results[0].components), [
  "vertical", "goal", "audience", "geography", "timing"
]);
assert.equal(prepared.results.some(({ event }) => event.type.includes("Youth")), false);
assert.equal(prepared.counts.duplicates, 1);
assert.match(prepared.results[0].unknown.join(" "), /Host trust/);
```

- [ ] **Step 2: Run the scoring tests and confirm failure**

Run: `node --test test/scoring.test.js`

Expected: FAIL because `prepareEvents` and structured score components do not exist.

- [ ] **Step 3: Implement qualification, deduplication, and 90-point scoring**

Export:

```js
export function prepareEvents(events, filters, now = new Date())
export function normaliseEvent(record)
```

Use the fixed component maxima `30`, `25`, `15`, `10`, and `10`. Exclude names or types matching `/load[ -]?in|load[ -]?out|setup|breakdown|production hold|administrative/i`; exclude youth for `audience !== "families"`; deduplicate on normalized name, location, type, and start. Sort by descending score, then ascending start, then `event.id.localeCompare`.

- [ ] **Step 4: Run the scoring tests**

Run: `node --test test/scoring.test.js`

Expected: all scoring tests PASS and no returned score exceeds 90.

- [ ] **Step 5: Commit the ranking slice**

```bash
git add src/scoring.js test/scoring.test.js
git commit -m "Build transparent public signal ranking"
```

### Task 2: Deterministic Brief Generation

**Files:**
- Create: `public/brief.js`
- Create: `test/brief.test.js`

**Interfaces:**
- Consumes: `generateBrief(inputs, rankedResult)` with the six selected input values and one structured ranking result from Task 1.
- Produces: `{ title, intent, gathering, fit, activation, valueAdd, hostQuestions, measurement, limitations, sourceUrl }` with plain-text-safe strings and arrays.

- [ ] **Step 1: Write failing generation tests**

```js
const brief = generateBrief({
  vertical: "beverage",
  goal: "sampling",
  audience: "adults",
  borough: "Brooklyn",
  energy: "social",
  scale: "small"
}, rankedResult);

assert.match(brief.activation, /starting direction/i);
assert.equal(brief.hostQuestions.length >= 3, true);
assert.deepEqual(brief.measurement.map((item) => item.key), [
  "attendance", "referral", "optIn", "repeat", "hostRenewal"
]);
assert.match(brief.limitations.join(" "), /public record/i);
assert.doesNotMatch(JSON.stringify(brief), /projected|estimated ROI|guaranteed/i);
```

- [ ] **Step 2: Run the brief tests and confirm failure**

Run: `node --test test/brief.test.js`

Expected: FAIL because `public/brief.js` does not exist.

- [ ] **Step 3: Implement bounded activation templates and brief assembly**

Use explicit lookup tables keyed by vertical, goal, energy, scale, and event type. Every activation begins with `Starting direction:`. Always include questions about Host interest, room norms, operational capacity, accessibility, and consent. Measurement items describe collection mechanics only and contain no numeric outcome forecasts.

- [ ] **Step 4: Run brief and scoring tests**

Run: `node --test test/brief.test.js test/scoring.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit the brief engine**

```bash
git add public/brief.js test/brief.test.js
git commit -m "Generate honest campaign briefs"
```

### Task 3: Bounded Public Data API and Source Metadata

**Files:**
- Modify: `server.js`
- Create: `test/server.test.js`

**Interfaces:**
- Consumes: query keys `vertical`, `goal`, `audience`, `borough`, `energy`, and `scale`.
- Produces: `/api/events` JSON with `{ events, facets, fetchedAt, source, queryWindow, counts, capped }`.

- [ ] **Step 1: Write failing API tests with injected upstream fetch**

Refactor `server.js` to export `createApp({ fetchImpl, now })` without starting a listener when imported. Test that a successful request returns:

```js
assert.deepEqual(body.counts, {
  reviewed: 5,
  qualified: 2,
  excluded: 2,
  duplicates: 1
});
assert.equal(body.capped, false);
assert.match(body.queryWindow.start, /^2026-08-09/);
assert.match(body.queryWindow.end, /^2026-/);
```

Also assert an upstream non-2xx response returns status `502` with the existing safe error sentence and no upstream body leakage.

- [ ] **Step 2: Run the API tests and confirm failure**

Run: `node --test test/server.test.js`

Expected: FAIL because the app is not injectable and metadata is absent.

- [ ] **Step 3: Implement the bounded query and API contract**

Query a 120-day window with a source limit of `1000`, request `1001` records to detect capping, trim to `1000`, and expose the cap truthfully. Return normalized facets from reviewed records and structured results from `prepareEvents`. Preserve five-minute caching with window metadata in the cache key.

- [ ] **Step 4: Run all server-side tests**

Run: `npm test`

Expected: all tests PASS without starting a second server process.

- [ ] **Step 5: Commit the API slice**

```bash
git add server.js test/server.test.js
git commit -m "Expose bounded public signal metadata"
```

### Task 4: One-Minute Planner and Three-Signal Selection UI

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Create: `test/ui-contract.test.js`

**Interfaces:**
- Consumes: Task 3 API response.
- Produces: `window.location.search` state using the six filter keys plus `event`; a visible shortlist of at most three primary signals; selection invokes `renderBrief` from Task 5.

- [ ] **Step 1: Write failing static UI contract tests**

Read `public/index.html` as text and assert it contains:

```js
assert.match(html, /Try a sample brief/);
assert.match(html, /Build my own/);
assert.match(html, /Sources \+ methodology/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /id="brief-output"/);
```

Read `public/app.js` and assert source and selection controls are rendered outside the event-details disclosure. Read `public/styles.css` and assert `min-height: 44px`, `@media (max-width: 390px)`, and `@media print` exist.

- [ ] **Step 2: Run the UI contract test and confirm failure**

Run: `node --test test/ui-contract.test.js`

Expected: FAIL because the sample/custom flow and brief output do not exist.

- [ ] **Step 3: Replace the hero and filter grid with progressive flow markup**

Keep the top bar and visual identity. Add visible `Try a sample brief` and `Build my own` buttons, a compact six-control form, progress/status copy, results, brief output, and disclosures for methodology and research context. Link WHO, HHS, Eventbrite, IAB, CreatorIQ, Offline public material, Rothy's example, and NYC Open Data with source-type labels.

- [ ] **Step 4: Implement client state, sample path, API load, and primary result cards**

Use one state object:

```js
const state = {
  mode: "start",
  filters: { vertical, goal, audience, borough, energy, scale },
  events: [],
  selectedEventId: null,
  brief: null
};
```

The sample path loads a visibly fictional beverage-awareness brief. Render exactly three primary cards, with score components, matched evidence, unknown evidence, `View source record`, and `Build a brief around this` visible without expanding details. Put additional qualified records behind one disclosure.

- [ ] **Step 5: Implement responsive layout and interaction states**

At `390x844`, keep the first action visible in the first viewport and show one full-width card per row. At `320x568`, stack every action and prevent horizontal scrolling. Add 44px targets, focus-visible styles, loading skeleton or status, empty state, retry button, and reduced motion. Use compact type sizes and no fixed-position arrows.

- [ ] **Step 6: Run all tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit the planner interface**

```bash
git add public/index.html public/app.js public/styles.css test/ui-contract.test.js
git commit -m "Build one-minute signal planner flow"
```

### Task 5: Portable Brief, Share State, Print, and Reset

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `test/ui-contract.test.js`

**Interfaces:**
- Consumes: the selected result and `generateBrief` imported from `public/brief.js`.
- Produces: a one-screen visible brief summary, one expandable details region, clipboard text, print layout, restorable URL state, and a reset state with no full page reload.

- [ ] **Step 1: Extend the UI contract test for portable actions**

Assert `public/app.js` contains handlers for `navigator.clipboard.writeText`, `window.print`, `history.replaceState`, shared-event fallback copy, and reset. Assert `public/index.html` contains buttons named `Copy brief`, `Print or save PDF`, `Copy share link`, and `Start over`.

- [ ] **Step 2: Run the UI contract test and confirm failure**

Run: `node --test test/ui-contract.test.js`

Expected: FAIL because portable brief actions are incomplete.

- [ ] **Step 3: Render the brief and implement actions**

Render intent, selected gathering, fit, activation, and value add in the default brief view. Put Host questions, measurement plan, limitations, source, and methodology inside one prominent `Open details` disclosure. Move focus to the brief heading after selection. Copy plain text with a manual textarea fallback, call `window.print()` for PDF, copy the current URL with filters and event ID, and reset controls/state/history without reloading.

- [ ] **Step 4: Add print and shared-state behavior**

The print stylesheet hides navigation, forms, research context, and non-print actions while preserving the full brief, source URL, and limitations. On load, restore valid query values; if the shared event is absent, show `That public record is no longer in this window. Here are the current best matches.` and retain the brief filters.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit portable brief behavior**

```bash
git add public/app.js public/styles.css test/ui-contract.test.js
git commit -m "Add portable campaign brief actions"
```

### Task 6: Responsive, Live-Data, and Railway Verification

**Files:**
- Modify only if verification exposes a defect: `public/index.html`, `public/app.js`, `public/styles.css`, `server.js`, or tests covering the defect.

**Interfaces:**
- Consumes: complete local application and Railway service configuration.
- Produces: verified local build, pushed Git revision, successful Railway deployment, and live URL evidence.

- [ ] **Step 1: Run automated verification**

Run: `npm test`

Expected: every test passes with exit code `0`.

- [ ] **Step 2: Start the local service and verify endpoints**

Run: `PORT=3010 npm start`

Verify `/api/health` returns `{ "ok": true }`; `/api/events` returns at most 1000 reviewed records, three or more ranked candidates when data permits, source metadata, query window, counts, and scores no higher than 90.

- [ ] **Step 3: Perform browser QA at required breakpoints**

Inspect `320x568`, `390x844`, `721x900`, `1024x768`, and `1440x900`. Complete sample and custom paths, open sources/methodology, select a result, copy the brief, restore a shared URL, reset, and open print preview. Confirm no horizontal overflow, clipped controls, overlapping text, or hidden primary actions.

- [ ] **Step 4: Commit any verification fixes**

If defects were found, add a focused failing test first, fix the defect, rerun `npm test`, then commit only those files:

```bash
git add public/index.html public/app.js public/styles.css public/brief.js server.js src/scoring.js test
git commit -m "Fix verified planner edge cases"
```

If no defects were found, do not create an empty commit.

- [ ] **Step 5: Push and deploy through the configured Railway service**

Push the current branch, deploy from the verified checkout, and wait for Railway to report success. Record the deployment ID and deployed commit SHA.

- [ ] **Step 6: Verify the deployed artifact**

Open the live planner and repeat health, sample-path, source-link, brief-selection, shared-link, and `390x844` checks. Confirm the deployed revision matches the pushed commit before calling the work shipped.
