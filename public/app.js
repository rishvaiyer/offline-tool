const form = document.querySelector("#filters");
const boroughSelect = document.querySelector("#borough");
const eventTypeSelect = document.querySelector("#eventType");
const stats = document.querySelector("#stats");
const results = document.querySelector("#results");
const freshness = document.querySelector("#freshness");
const resultSummary = document.querySelector("#result-summary");

const sourceFor = (id) => `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${encodeURIComponent(id)}`;
const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));

function setOptions(select, values, allLabel) {
  const prior = select.value;
  select.innerHTML = `<option value="All">${allLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  select.value = values.includes(prior) ? prior : "All";
}

function renderStats(events) {
  const boroughs = new Set(events.map(({ event }) => event.borough)).size;
  const types = new Set(events.map(({ event }) => event.type)).size;
  stats.innerHTML = [
    [events.length, "signals surfaced"],
    [boroughs, "boroughs represented"],
    [types, "event types"]
  ].map(([value, label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("");
}

function card({ event, value, reason }) {
  const date = new Date(event.start);
  const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  return `
    <article class="event-card">
      <div class="score" aria-label="${value} signal fit"><b>${value}</b><span>fit</span></div>
      <div class="event-copy">
        <p class="event-type">${escapeHtml(event.type)}</p>
        <h4>${escapeHtml(event.name)}</h4>
        <p class="event-meta">${escapeHtml(dateTime.format(date))} · ${escapeHtml(event.borough)}</p>
        <p class="event-location">${escapeHtml(event.location)}</p>
        <details class="event-details">
          <summary>Why this surfaced</summary>
          <p class="event-detail-copy"><strong>Public signal:</strong> ${escapeHtml(reason)}. This is a transparent planning heuristic, not a prediction of attendance, trust, pricing, or conversion.</p>
          <a class="source-link-inline" href="${sourceFor(event.id)}" target="_blank" rel="noreferrer">Open source record ↗</a>
        </details>
      </div>
      <div class="date-badge"><strong>${day}</strong>${month}</div>
    </article>
  `;
}

function renderEvents(events) {
  if (!events.length) {
    resultSummary.textContent = "No signals for this combination";
    results.innerHTML = `<div class="empty"><b>No public signals match this brief.</b><span>Widen the borough or event-type filter.</span></div>`;
    return;
  }
  const visible = events.slice(0, 3);
  const remaining = events.slice(3, 12);
  resultSummary.textContent = `${events.length} live signals · top 3 shown first`;
  results.innerHTML = visible.map(card).join("") + (remaining.length ? `
    <details class="more-results">
      <summary>Show ${remaining.length} more signals</summary>
      <div>${remaining.map(card).join("")}</div>
    </details>
  ` : "");
}

async function load() {
  const query = new URLSearchParams(new FormData(form));
  freshness.innerHTML = `<span class="status-dot" aria-hidden="true"></span> Refreshing public records...`;
  results.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`/api/events?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setOptions(boroughSelect, data.facets.boroughs, "All boroughs");
    setOptions(eventTypeSelect, data.facets.eventTypes, "All event types");
    renderStats(data.events);
    renderEvents(data.events);
    freshness.innerHTML = `<span class="status-dot" aria-hidden="true"></span> Updated ${escapeHtml(dateTime.format(new Date(data.fetchedAt)))}`;
  } catch (error) {
    stats.innerHTML = "";
    resultSummary.textContent = "Data unavailable";
    results.innerHTML = `<div class="empty error"><b>Could not load public records.</b><span>${escapeHtml(error.message)}</span></div>`;
    freshness.innerHTML = `<span class="status-dot" aria-hidden="true"></span> Data unavailable`;
  } finally {
    results.removeAttribute("aria-busy");
  }
}

form.addEventListener("change", load);
document.querySelector(".method-note")?.addEventListener("toggle", (event) => {
  const action = event.currentTarget.querySelector(".summary-action");
  if (action) action.textContent = event.currentTarget.open ? "fold back" : "unfold";
});
load();
