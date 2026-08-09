# Offline Signal Planner

A public-data prototype for finding relevant NYC event signals for a community-first campaign brief.

## What it does

- Fetches current public events from NYC Open Data on demand.
- Makes a transparent, heuristic rank using brand vertical, campaign goal, borough, and event type.
- Shows the public record source for every result.

## What it does not claim

This is not Offline's private host inventory. It does not infer attendance, host trust, pricing, or conversion outcomes from public records.

## Run locally

```bash
npm install
npm test
npm start
```

Then open `http://localhost:3000`.
