const FILTER_KEYS = ["vertical", "goal", "audience", "borough", "energy", "scale"];
const DEFAULT_FILTERS = {
  vertical: "athletic",
  goal: "sampling",
  audience: "adults",
  borough: "All",
  energy: "active",
  scale: "small"
};
const SAMPLE_FILTERS = {
  vertical: "beverage",
  goal: "awareness",
  audience: "adults",
  borough: "All",
  energy: "social",
  scale: "small"
};

const state = {
  mode: "start",
  filters: { ...DEFAULT_FILTERS },
  events: [],
  selectedEventId: null,
  brief: null
};

const form = document.querySelector("#filters");
const boroughSelect = document.querySelector("#borough");
const resultsSection = document.querySelector("#results-section");
const results = document.querySelector("#results");
const stats = document.querySelector("#stats");
const resultSummary = document.querySelector("#result-summary");
const workflowStatus = document.querySelector("#workflow-status");
const stepNumber = document.querySelector("#step-number");
const sampleBadge = document.querySelector("#sample-badge");
const sourceMeta = document.querySelector("#source-meta");
const briefOutput = document.querySelector("#brief-output");

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
});
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const componentLabels = {
  vertical: "Event language",
  goal: "Campaign goal",
  audience: "Audience",
  geography: "Geography",
  timing: "Timing"
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[character]));

const sourceFor = (id) => `https://data.cityofnewyork.us/resource/tvpp-9vvx.json?event_id=${encodeURIComponent(id)}`;

function formatDate(value, fallback = "Date not listed") {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateTime.format(date);
}

function readFilters() {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, form.elements[key].value]));
}

function setFilters(filters) {
  FILTER_KEYS.forEach((key) => {
    form.elements[key].value = filters[key];
  });
  state.filters = readFilters();
}

function syncUrl() {
  const url = new URL(window.location.href);
  FILTER_KEYS.forEach((key) => url.searchParams.set(key, state.filters[key]));
  if (state.selectedEventId) url.searchParams.set("event", state.selectedEventId);
  else url.searchParams.delete("event");
  window.history.replaceState({}, "", url);
}

function setOptions(select, values, allLabel) {
  const selected = select.value;
  select.replaceChildren(new Option(allLabel, "All"));
  values.forEach((value) => select.add(new Option(value, value)));
  select.value = values.includes(selected) ? selected : "All";
}

function showStep(number, moveFocus = false) {
  document.querySelectorAll(".form-step").forEach((step) => {
    step.classList.toggle("is-current", Number(step.dataset.step) === number);
  });
  stepNumber.textContent = String(number);
  if (moveFocus) {
    document.querySelector(`.form-step[data-step="${number}"] select`)?.focus({ preventScroll: true });
  }
}

function openForm(mode) {
  state.mode = mode;
  form.hidden = false;
  sampleBadge.hidden = mode !== "sample";
  if (mode === "sample") {
    setFilters(SAMPLE_FILTERS);
    showStep(3);
    workflowStatus.textContent = "Fictional sample loaded. Finding current public signals now.";
    loadEvents();
    return;
  }

  setFilters(DEFAULT_FILTERS);
  showStep(1, true);
  workflowStatus.textContent = "Custom brief started. Six choices are grouped into three quick steps on mobile.";
  document.querySelector("#planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function componentList(components = {}) {
  return Object.entries(componentLabels).map(([key, label]) => `
    <li><span>${escapeHtml(label)}</span><strong>${Number(components[key] ?? 0)}</strong></li>
  `).join("");
}

function evidenceList(values = [], labels = {}) {
  if (!values.length) return "<li>None established by this public record</li>";
  return values.map((value) => `<li>${escapeHtml(labels[value] ?? value)}</li>`).join("");
}

function primaryCard(result, index) {
  const { event, score, components, matched, unknown } = result;
  return `
    <article class="signal-card" aria-labelledby="signal-${index}-title">
      <div class="card-topline">
        <p class="event-type">${escapeHtml(event.type || "Public gathering")}</p>
        <div class="score" aria-label="Public signal score ${score} out of 90"><strong>${score}</strong><span>/ 90</span></div>
      </div>
      <h4 id="signal-${index}-title">${escapeHtml(event.name)}</h4>
      <p class="event-meta">${escapeHtml(formatDate(event.start))} · ${escapeHtml(event.borough || "Borough not listed")}</p>
      <p class="event-location">${escapeHtml(event.location || "Location not listed")}</p>

      <div class="score-block" aria-label="Score breakdown">
        <p class="mini-label">VISIBLE SCORE COMPONENTS</p>
        <ul class="component-list">${componentList(components)}</ul>
      </div>
      <div class="evidence-grid">
        <div><p class="mini-label">MATCHED EVIDENCE</p><ul>${evidenceList(matched, componentLabels)}</ul></div>
        <div><p class="mini-label">STILL UNKNOWN</p><ul>${evidenceList(unknown)}</ul></div>
      </div>

      <details class="event-details">
        <summary>Public record context</summary>
        <p>Listed by ${escapeHtml(event.agency || "the source agency")}. This record can support a planning direction, not a claim about attendance, Host interest, pricing, or campaign results.</p>
      </details>

      <div class="card-actions">
        <a class="button button-quiet source-action" href="${sourceFor(event.id)}" target="_blank" rel="noreferrer"><span class="source-type">Government data</span> View source record</a>
        <button class="button button-primary select-action" type="button" data-select-event="${escapeHtml(event.id)}">Build a brief around this</button>
      </div>
    </article>
  `;
}

function secondaryCard(result) {
  const { event, score } = result;
  return `
    <article class="secondary-signal">
      <div><p class="event-type">${escapeHtml(event.type || "Public gathering")}</p><h4>${escapeHtml(event.name)}</h4><p>${escapeHtml(formatDate(event.start))} · ${escapeHtml(event.borough || "Borough not listed")}</p></div>
      <span class="secondary-score">${score} / 90</span>
      <div class="secondary-actions">
        <a href="${sourceFor(event.id)}" target="_blank" rel="noreferrer">View source record</a>
        <button type="button" data-select-event="${escapeHtml(event.id)}">Select</button>
      </div>
    </article>
  `;
}

function renderStats(counts = {}) {
  stats.innerHTML = [
    [counts.reviewed ?? 0, "records reviewed"],
    [counts.qualified ?? 0, "qualified signals"],
    [(counts.excluded ?? 0) + (counts.duplicates ?? 0), "excluded or duplicate"]
  ].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function renderEvents(events) {
  if (!events.length) {
    resultSummary.textContent = "No qualified signals";
    results.innerHTML = `
      <div class="state-card empty-state">
        <strong>No public signals fit this combination.</strong>
        <p>Try all boroughs, families, or a broader brand direction.</p>
        <button class="button button-quiet" type="button" data-edit-brief>Edit my choices</button>
      </div>`;
    return;
  }

  const primary = events.slice(0, 3);
  const additional = events.slice(3, 12);
  resultSummary.textContent = primary.length === 3
    ? "3 primary signals"
    : `${primary.length} qualified ${primary.length === 1 ? "signal" : "signals"}`;
  results.innerHTML = `
    <div class="primary-results">${primary.map(primaryCard).join("")}</div>
    ${additional.length ? `
      <details class="more-results">
        <summary>See ${additional.length} additional qualified ${additional.length === 1 ? "record" : "records"}</summary>
        <div class="secondary-results">${additional.map(secondaryCard).join("")}</div>
      </details>` : ""}
  `;
}

function renderMetadata(data) {
  const fetched = new Date(data.fetchedAt);
  const start = new Date(data.queryWindow?.start);
  const end = new Date(data.queryWindow?.end);
  const fetchedLabel = Number.isNaN(fetched.getTime()) ? "Fetch time unavailable" : `Fetched ${dateTime.format(fetched)}`;
  const windowLabel = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? "Query window unavailable"
    : `Window ${shortDate.format(start)} to ${shortDate.format(end)}`;
  const capLabel = data.capped ? "Source response reached its 1,000-record review cap." : "Source response did not reach its 1,000-record review cap.";
  sourceMeta.textContent = `${fetchedLabel}. ${windowLabel}. ${capLabel}`;
}

function renderLoading() {
  resultsSection.hidden = false;
  resultSummary.textContent = "Loading public records";
  stats.innerHTML = "";
  results.setAttribute("aria-busy", "true");
  results.innerHTML = `<div class="primary-results loading-grid" aria-hidden="true">${Array.from({ length: 3 }, () => `
    <div class="signal-card skeleton-card"><span></span><span></span><span></span><span></span></div>
  `).join("")}</div>`;
}

function renderError(message) {
  resultSummary.textContent = "Data unavailable";
  stats.innerHTML = "";
  results.innerHTML = `
    <div class="state-card error-state" role="alert">
      <strong>Public records did not load.</strong>
      <p>${escapeHtml(message)}</p>
      <button class="button button-primary" type="button" data-retry>Retry public records</button>
    </div>`;
}

async function loadEvents() {
  state.filters = readFilters();
  state.selectedEventId = null;
  state.brief = null;
  briefOutput.hidden = true;
  syncUrl();
  renderLoading();
  workflowStatus.textContent = "Loading current NYC public records and ranking transparent compatibility.";

  try {
    const query = new URLSearchParams(state.filters);
    const response = await fetch(`/api/events?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Public-event data is unavailable right now.");

    state.events = Array.isArray(data.events) ? data.events : [];
    setOptions(boroughSelect, data.facets?.boroughs ?? [], "All boroughs");
    renderStats(data.counts);
    renderEvents(state.events);
    renderMetadata(data);
    resultsSection.hidden = false;
    workflowStatus.textContent = state.events.length
      ? "Shortlist ready. Compare the evidence, open a source, then choose one signal."
      : "No qualified signals were found. Your brief choices are preserved.";
    document.querySelector("#results-title")?.focus({ preventScroll: true });
  } catch (error) {
    state.events = [];
    renderError(error instanceof Error ? error.message : "Public-event data is unavailable right now.");
    workflowStatus.textContent = "Public records are unavailable. Your choices are preserved and retry is ready.";
  } finally {
    results.removeAttribute("aria-busy");
  }
}

function renderBrief(selected) {
  state.brief = { eventId: selected.event.id };
  briefOutput.hidden = false;
  briefOutput.innerHTML = `
    <p class="eyebrow">STEP 3 / SIGNAL SELECTED</p>
    <h3 id="brief-title" tabindex="-1">Ready to build around ${escapeHtml(selected.event.name)}</h3>
    <p>This public signal is attached to your six choices. The next brief step can propose a direction without adding attendance, pricing, or outcome claims.</p>
    <a class="button button-quiet" href="${sourceFor(selected.event.id)}" target="_blank" rel="noreferrer"><span class="source-type">Government data</span> Reopen source record</a>
  `;
  document.querySelector("#brief-title")?.focus({ preventScroll: true });
  workflowStatus.textContent = `${selected.event.name} selected. The public source remains attached.`;
}

function selectEvent(eventId) {
  const selected = state.events.find(({ event }) => String(event.id) === String(eventId));
  if (!selected) return;
  state.selectedEventId = selected.event.id;
  syncUrl();
  renderBrief(selected);
}

document.querySelector("#sample-start").addEventListener("click", () => openForm("sample"));
document.querySelector("#custom-start").addEventListener("click", () => openForm("custom"));
document.querySelector("#edit-from-start").addEventListener("click", () => showStep(1, true));

form.addEventListener("change", () => {
  state.filters = readFilters();
  if (state.mode === "sample") {
    state.mode = "custom";
    sampleBadge.hidden = true;
    workflowStatus.textContent = "Sample adjusted. Submit the form to refresh public signals.";
  }
});

form.addEventListener("click", (event) => {
  const next = event.target.closest("[data-next]");
  const back = event.target.closest("[data-back]");
  if (next) showStep(Number(next.dataset.next), true);
  if (back) showStep(Number(back.dataset.back), true);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  state.mode = "custom";
  sampleBadge.hidden = true;
  loadEvents();
});

results.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-select-event]");
  if (selectButton) selectEvent(selectButton.dataset.selectEvent);
  if (event.target.closest("[data-retry]")) loadEvents();
  if (event.target.closest("[data-edit-brief]")) {
    showStep(1, true);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

document.querySelectorAll(".disclosure").forEach((disclosure) => {
  disclosure.addEventListener("toggle", () => {
    const action = disclosure.querySelector(".summary-action");
    if (action) action.textContent = disclosure.open ? "fold back" : "unfold";
  });
});
