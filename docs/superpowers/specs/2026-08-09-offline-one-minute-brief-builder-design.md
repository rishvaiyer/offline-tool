# Offline One-Minute Brief Builder Design

## Goal

Turn the existing public-event signal explorer into a fast, credible campaign brief builder that demonstrates the first minute of an Offline planning workflow.

The shipped experience must let a user move from campaign intent to one sourced room, one activation direction, and one portable brief without implying access to Offline's private Host inventory or inventing campaign outcomes.

## Product promise

The user answers a small set of questions, reviews three transparent public signals, selects one, and receives a concise campaign brief with sources, reasoning, Host questions, measurement suggestions, and explicit limitations.

Target interaction time: under one minute for the included sample path and under two minutes for a custom brief.

## User flow

### 1. Start quickly

The opening screen uses a compact hero that leaves the planner entry point visible within the first mobile viewport.

Two primary actions are available:

- `Try a sample brief`
- `Build my own`

The sample path preloads a clearly labelled fictional brand brief. It does not preload invented event results or outcomes.

### 2. Define the brief

The user selects:

- Brand vertical
- Campaign goal
- Intended audience
- Borough
- Desired energy
- Activation scale

Inputs are touch-friendly, keyboard accessible, and compact enough to avoid a long form on mobile. No pricing question appears because the public dataset does not provide Host or activation costs.

### 3. Review three public signals

The tool shows three recommended rooms first. Each recommendation includes:

- Event name, date, event type, borough, and location
- A `public signal score`, not a prediction
- A visible score breakdown
- Evidence present in the public record
- Evidence that remains unknown
- A persistent `View source record` action
- A `Build a brief around this` action

The remaining qualified records may stay behind an optional expansion.

### 4. Generate the campaign brief

Selecting a signal creates a compact one-screen brief with:

- Campaign intent
- Selected public gathering signal
- Why the signal fits the brief
- A Host-first activation concept
- The value the brand could add to the room

One clearly labelled `Open details` control reveals the Host questions, proposed measurement plan, known limitations, public source, and methodology. The collapsed mobile state should be skimmable without a long scroll.

The brief is deterministic and template-based. It must not use hidden AI reasoning or present generated copy as verified fact.

### 5. Carry the brief forward

The user can:

- Copy the brief as plain text
- Print or save it as PDF through the browser
- Copy a shareable URL containing the selected filters and public event identifier
- Start over without reloading the page

No account is required.

## Data quality

### Query window

Fetch a bounded upcoming event window instead of an unqualified first 250 future records. The API returns the query window, fetched timestamp, records reviewed, records excluded, and whether the source response was capped.

### Relevance filtering

Exclude obvious administrative or non-attendee records from the default candidate pool, including production load-ins and load-outs. Youth events remain excluded unless the selected audience explicitly allows them.

### Deduplication

Remove exact duplicate occurrences using normalized event name, location, type, and start date. Repeated events that occur on different dates remain valid but may be labelled as recurring.

### Truthful counts

Do not call a source API limit `live signals`. Display the number of records reviewed, qualified signals, and exclusions separately.

## Transparent ranking

Replace the current coarse 100-point score with a maximum 90-point `public signal score`:

- Event-language and vertical fit: 30
- Campaign-goal fit: 25
- Audience suitability: 15
- Geographic fit: 10
- Timing fit: 10

The missing final ten points are intentional. Host trust, willingness, pricing, capacity, and relationship fit cannot be derived from the public dataset and are never scored.

Every result returns structured score components rather than one reason string. The interface shows what matched, what did not match, and what remains unknown.

Ties are broken by start time and stable event identifier. Tests cover every scoring component, exclusions, deduplication, and stable ordering.

## Activation concepts

Activation concepts are bounded templates based on the selected vertical, goal, audience, energy, scale, and event type.

Examples include a recovery table, sampling ritual, useful post-event resource, community portrait station, or opt-in follow-up. The concepts must emphasize contribution to the gathering rather than interruption of it.

Every concept is labelled `starting direction` and includes Host questions before it could become a real plan.

## Measurement plan

The brief proposes measurement mechanics without projecting results:

- Consented check-in or attendance confirmation
- Invitation or referral path
- Opt-in brand action
- Repeat participation
- Host renewal or willingness to collaborate again

The interface explicitly states that these fields require consent, operational design, and a real pilot. No attendance, conversion, lift, reach, price, or return figure is estimated.

## Sources and methodology

Sources must be visible at three levels:

### Result level

Every recommendation has an always-visible source action linked to the underlying NYC Open Data record or dataset query.

### Planner level

A `Sources + methodology` control sits near the planner title. It contains:

- NYC Open Data dataset and fetch timestamp
- Query window and source cap
- Scoring component definitions
- Exclusion and deduplication rules
- Unmeasured factors

### Research context

A compact research section links to sources supporting the product hypothesis while labelling source quality:

- Public health: WHO and the U.S. Surgeon General on social connection
- Industry survey: Eventbrite on online interests becoming in-person gatherings
- Industry research: IAB on creator measurement fragmentation
- Industry survey: CreatorIQ on declining reliance on follower count
- Company and press examples: Offline's public campaign material and Rothy's creator-hosted IRL activations

Research context supports the product direction. It does not influence event scores.

## Responsive design

- The sample action or first planner control is visible within the first 844px on a 390px-wide viewport.
- The brief form uses one compact step at a time at 390px and below.
- Recommended signals use one card per row with no horizontal scrolling.
- Score reasons, source actions, and the selection button remain visible without opening a disclosure.
- Supporting methodology and long research context may use native disclosures.
- All actionable controls have a 44px minimum touch target.

## Accessibility

- Native form controls and semantic buttons remain the foundation.
- Each step has a visible label and programmatically associated help text.
- Loading, empty, error, selection, and brief-ready states use polite live regions.
- Keyboard users can complete the full flow and operate copy, print, source, and reset actions.
- Focus remains visible and moves to the next meaningful heading after step changes.
- Reduced-motion preferences disable nonessential transitions.

## Error handling

- If NYC Open Data is unavailable, preserve the user's brief inputs and show a clear retry action.
- Never substitute stale or invented event records without an explicit stale-data label.
- Copy and share failures display a manual fallback rather than silently failing.
- A missing or no-longer-returned shared event falls back to the ranked shortlist and explains the change.

## Verification

- Unit tests for normalization, exclusions, deduplication, every score component, stable ordering, and brief generation
- API tests for query metadata and error boundaries
- UI tests for sample and custom paths, source visibility, share-state restoration, copy, reset, and mobile target floors
- Visual QA at 320x568, 390x844, 721x900, 1024x768, and 1440x900
- Live verification of the Railway API, public sources, console, responsive behavior, and deployed artifact revision

## Non-goals for today's ship

- Authentication or saved user accounts
- Private Offline Host inventory
- Host pricing or campaign budgeting
- Predicted attendance, conversion, lift, reach, or return
- AI-generated recommendations with hidden reasoning
- Claims about Offline's current internal measurement capabilities
- Production analytics or outreach tracking
