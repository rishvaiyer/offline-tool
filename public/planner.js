export function shortlistPresentation(events) {
  const primary = events.slice(0, 3);
  const additional = events.slice(3, 12);
  const count = primary.length;
  const numberWord = ["No", "One", "Two", "Three"][count];

  return {
    primary,
    additional,
    heading: `${numberWord} ${count === 1 ? "room" : "rooms"} to investigate`,
    summary: count === 3
      ? "3 primary signals"
      : `${count} qualified ${count === 1 ? "signal" : "signals"}`
  };
}

const utcDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});

export function formatUtcDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : utcDate.format(date);
}

export function statsRows(counts = {}) {
  return [
    [counts.reviewed ?? 0, "records reviewed"],
    [counts.qualified ?? 0, "qualified signals"],
    [counts.excluded ?? 0, "records excluded"],
    [counts.duplicates ?? 0, "duplicates removed"]
  ];
}

const filterKeys = ["vertical", "goal", "audience", "borough", "energy", "scale"];

export function resetCustomState(state, defaults) {
  state.mode = "custom";
  state.filters = { ...defaults };
  state.events = [];
  state.selectedEventId = null;
  state.brief = null;
  return state;
}

export function plannerUrl(currentUrl, filters, selectedEventId) {
  const url = new URL(currentUrl);
  filterKeys.forEach((key) => url.searchParams.set(key, filters[key]));
  if (selectedEventId) url.searchParams.set("event", selectedEventId);
  else url.searchParams.delete("event");
  return url.toString();
}

export function createRequestTracker() {
  let latest = 0;
  return {
    begin() {
      latest += 1;
      return latest;
    },
    isCurrent(requestId) {
      return requestId === latest;
    },
    commit(requestId, apply) {
      if (requestId !== latest) return false;
      apply();
      return true;
    }
  };
}

const fetchedDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
});

export function metadataText(data) {
  if (!data) return "Source details appear after a successful search.";
  const fetched = new Date(data.fetchedAt);
  const fetchedLabel = Number.isNaN(fetched.getTime()) ? "Fetch time unavailable" : `Fetched ${fetchedDateTime.format(fetched)}`;
  const start = formatUtcDate(data.queryWindow?.start);
  const end = formatUtcDate(data.queryWindow?.end);
  const windowLabel = start && end ? `Window ${start} to ${end}` : "Query window unavailable";
  const capLabel = data.capped
    ? "Source response reached its 1,000-record review cap."
    : "Source response did not reach its 1,000-record review cap.";
  return `${fetchedLabel}. ${windowLabel}. ${capLabel}`;
}

export function revealElement(element, { focus = false, reducedMotion = false } = {}) {
  if (!element) return false;
  if (focus) element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  return true;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

export function sourceUrl(id) {
  return `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${encodeURIComponent(id)}`;
}
