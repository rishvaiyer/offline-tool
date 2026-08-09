import test from "node:test";
import assert from "node:assert/strict";

import { generateBrief } from "../public/brief.js";

const inputs = {
  vertical: "beverage",
  goal: "sampling",
  audience: "adults",
  borough: "Brooklyn",
  energy: "social",
  scale: "small"
};

const rankedResult = {
  event: {
    id: "market-1",
    name: "Saturday Market",
    start: "2026-08-15T15:00:00Z",
    end: "2026-08-15T17:00:00Z",
    agency: "Public Markets",
    type: "Market",
    borough: "Brooklyn",
    location: "Grand Army Plaza"
  },
  score: 80,
  components: {
    vertical: 30,
    goal: 25,
    audience: 15,
    geography: 10,
    timing: 10
  },
  matched: ["vertical", "goal", "audience", "geography", "timing"],
  unknown: ["Host trust", "willingness", "pricing", "capacity", "relationship fit"]
};

test("generates a compact, honest brief from a ranked public signal", () => {
  const brief = generateBrief(inputs, rankedResult);

  assert.match(brief.activation, /starting direction/i);
  assert.equal(brief.hostQuestions.length >= 3, true);
  assert.deepEqual(brief.measurement.map((item) => item.key), [
    "attendance", "referral", "optIn", "repeat", "hostRenewal"
  ]);
  assert.match(brief.limitations.join(" "), /public record/i);
  assert.doesNotMatch(JSON.stringify(brief), /projected|estimated ROI|guaranteed/i);
});

test("uses the selected event source and produces repeatable plain-text fields", () => {
  const first = generateBrief(inputs, rankedResult);
  const second = generateBrief(inputs, rankedResult);

  assert.deepEqual(first, second);
  assert.equal(first.sourceUrl, "https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=market-1");
  assert.equal(first.title, "Beverage sampling at Saturday Market");
  assert.equal(first.gathering, "Saturday Market at Grand Army Plaza in Brooklyn");
  assert.equal(first.activation.includes("—"), false);
  assert.equal(first.valueAdd.includes("—"), false);
});

