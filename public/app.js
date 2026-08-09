const form = document.querySelector("#filters");
const boroughSelect = document.querySelector("#borough");
const eventTypeSelect = document.querySelector("#eventType");
const stats = document.querySelector("#stats");
const results = document.querySelector("#results");
const freshness = document.querySelector("#freshness");

const sourceFor = (id) => `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${encodeURIComponent(id)}`;
const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" });

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
    [boroughs, "boroughs"],
    [types, "event types"]
  ].map(([value, label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("");
}

function renderEvents(events) {
  if (!events.length) {
    results.innerHTML = `<div class="empty"><b>No public signals match this brief.</b><span>Widen the borough or event-type filter.</span></div>`;
    return;
  }
  results.innerHTML = events.slice(0, 24).map(({ event, value, reason }) => `
    <article class="event-card">
      <div class="score"><b>${value}</b><span>signal</span></div>
      <div class="event-copy">
        <p class="event-type">${event.type}</p>
        <h3>${event.name}</h3>
        <p>${dateTime.format(new Date(event.start))} · ${event.borough}</p>
        <p class="location">${event.location}</p>
        <p class="reason"><b>Why it surfaced:</b> ${reason}</p>
      </div>
      <a href="${sourceFor(event.id)}" target="_blank" rel="noreferrer">View record ↗</a>
    </article>
  `).join("");
}

async function load() {
  const query = new URLSearchParams(new FormData(form));
  freshness.textContent = "Refreshing public records...";
  results.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(`/api/events?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setOptions(boroughSelect, data.facets.boroughs, "All boroughs");
    setOptions(eventTypeSelect, data.facets.eventTypes, "All event types");
    renderStats(data.events);
    renderEvents(data.events);
    freshness.textContent = `Updated ${dateTime.format(new Date(data.fetchedAt))}`;
  } catch (error) {
    stats.innerHTML = "";
    results.innerHTML = `<div class="empty error"><b>Could not load public records.</b><span>${error.message}</span></div>`;
    freshness.textContent = "Data unavailable";
  } finally {
    results.removeAttribute("aria-busy");
  }
}

form.addEventListener("change", load);
load();
