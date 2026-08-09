# Offline Signal Planner

> Find the gathering before you buy the attention.

**Offline Signal Planner** is a public-data prototype for turning a campaign brief into a shortlist of real NYC gatherings where people are already showing up.

[Open the live planner](https://offline-signal-planner-production.up.railway.app/) · [View the source on GitHub](https://github.com/rishvaiyer/offline-tool)

This is an independent project by Rishva Iyer for an Offline application. It is not affiliated with Offline or any Offline product.

## The idea

Offline campaigns should begin with the room, not with a generic audience segment. The planner starts from a few practical choices:

- brand vertical
- campaign goal
- borough
- event type

It then looks at current public NYC event records and surfaces the events whose language and location are the closest fit for that brief.

The output is intentionally a starting direction. It helps a team decide where to investigate, what to ask a host, and what kind of value a brand might add once a real relationship exists.

## What the tool does

1. Fetches upcoming public events from NYC Open Data.
2. Normalizes the public records into a small, consistent event model.
3. Applies transparent keyword signals for the selected vertical and goal.
4. Adds a simple geography signal for Manhattan and Brooklyn.
5. Sorts the results by fit and then by soonest start time.
6. Shows the source record for each event so the result can be checked.

The interface keeps the top three signals visible first. Additional results and the methodology note are collapsible so the useful answer stays quick to scan.

## How ranking works

The score is a prioritization heuristic, not a prediction.

Each result is evaluated using three visible inputs:

| Signal | Strong match | Otherwise |
| --- | ---: | ---: |
| Brand vertical | 46 | 15 |
| Campaign goal | 37 | 10 |
| Manhattan or Brooklyn | 17 | 8 |

Examples of language signals include `market`, `sport`, `festival`, `street event`, and `open street`, depending on the selected brief. Ties are resolved by start time so the output stays deterministic.

The number does **not** represent attendance, reach, trust, price, conversion, return, or the probability that a host will welcome a brand.

## Data and boundaries

The planner reads from the [NYC Open Data event permits dataset](https://data.cityofnewyork.us/id/tvpp-9vvx). It requests upcoming records, orders them by start time, and reviews up to 250 records per refresh. Results are cached for five minutes to avoid repeatedly hitting the public endpoint.

Every result keeps a link to its underlying public record. The app does not use private host inventory, paid audience data, attendance estimates, pricing, host preferences, campaign performance, or hidden model output.

Those unknowns are the point of the handoff. A public signal can suggest where to look. It cannot replace consent, a host conversation, operational planning, or real measurement after an activation.

## API

The Express server exposes two small endpoints:

```text
GET /api/health
GET /api/events
```

`/api/events` accepts the same filters used by the interface:

```text
/api/events?vertical=beverage&goal=awareness&borough=Brooklyn&eventType=All
```

The response includes:

- `events`: ranked event records with `event`, `value`, and `reason`
- `facets`: boroughs and event types available in the current snapshot
- `fetchedAt`: when the public source was fetched
- `source`: the NYC Open Data endpoint used for the request

## Run locally

Requirements: Node.js 22 or newer.

```bash
git clone https://github.com/rishvaiyer/offline-tool.git
cd offline-tool
npm install
npm test
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

For development with Node's watch mode:

```bash
npm run dev
```

## Project map

```text
server.js          Express server, public-data fetch, cache, and API routes
src/scoring.js     Event normalization, heuristic matching, and ranking
public/index.html  Semantic planner markup and data-boundary copy
public/app.js      Filtering, loading states, result cards, and source links
public/styles.css  Responsive scrapbook-inspired interface
test/              Node's built-in test suite for scoring behavior
docs/              Design notes and implementation plans
```

## Current status

This is a working MVP and a deliberately bounded prototype. The live version proves the public-data loop and the source-conscious interface. It does not claim to be Offline's production product or a complete campaign operating system.

The next meaningful product step would be a consent-based workflow with real hosts: validate whether a host is interested, understand the room's norms and capacity, agree on what a brand can add, and measure the resulting experience without turning people into an opaque metric.

## Why this is useful

The tool makes an abstract campaign question concrete:

> Where are people already gathering, and what could we add that makes being there better?

That is a more honest starting point than pretending public event records can tell us who will convert. The planner gives a team a small set of evidence-backed places to investigate, then gets out of the way for the human work that follows.
