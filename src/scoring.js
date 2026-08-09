const verticalSignals = {
  athletic: [/sport/i, /soccer/i, /run/i, /rugby/i, /cricket/i],
  beverage: [/market/i, /food/i, /open street/i],
  wellness: [/sport/i, /park/i, /open street/i],
  beauty: [/street/i, /market/i, /festival/i],
  fintech: [/open street/i, /street event/i, /festival/i],
  fashion: [/street/i, /market/i, /festival/i],
  apps: [/open street/i, /street event/i, /festival/i]
};

const goalSignals = {
  sampling: [/market/i, /sport/i],
  awareness: [/street event/i, /open street/i, /festival/i],
  signups: [/open street/i, /street event/i, /festival/i],
  content: [/street event/i, /market/i, /festival/i]
};

export function normaliseEvent(record) {
  return {
    id: record.event_id,
    name: record.event_name,
    start: record.start_date_time,
    end: record.end_date_time,
    agency: record.event_agency,
    type: record.event_type,
    borough: record.event_borough,
    location: record.event_location
  };
}

function matches(signalSet, event) {
  const text = `${event.name} ${event.type} ${event.location}`;
  return signalSet.some((pattern) => pattern.test(text));
}

function score(event, filters) {
  const verticalFit = matches(verticalSignals[filters.vertical] ?? [], event);
  const goalFit = matches(goalSignals[filters.goal] ?? [], event);
  const coreMarket = ["Manhattan", "Brooklyn"].includes(event.borough);
  const scoreValue = Math.round((verticalFit ? 46 : 15) + (goalFit ? 37 : 10) + (coreMarket ? 17 : 8));
  const reasons = [];

  if (verticalFit) reasons.push("vertical fit");
  if (goalFit) reasons.push("goal fit");
  if (coreMarket) reasons.push("NYC core market");

  return { value: scoreValue, reason: reasons.length ? reasons.join(" · ") : "broad public-event signal" };
}

export function rankEvents(events, filters) {
  return events
    .filter((event) => filters.borough === "All" || event.borough === filters.borough)
    .filter((event) => filters.eventType === "All" || event.type === filters.eventType)
    .map((event) => ({ event, ...score(event, filters) }))
    .sort((a, b) => b.value - a.value || a.event.start.localeCompare(b.event.start));
}
