import {
  createRequestTracker,
  escapeHtml,
  metadataText,
  plannerUrl,
  resetCustomState,
  revealElement,
  shortlistPresentation,
  sourceUrl,
  statsRows
} from "./planner.js";
import { generateBrief } from "./brief.js";

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
const briefContent = document.querySelector("#brief-content");
const briefActionStatus = document.querySelector("#brief-action-status");
const resultsTitle = document.querySelector("#results-title");
const requestTracker = createRequestTracker();

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
});
const componentLabels = {
  vertical: "Event language",
  goal: "Campaign goal",
  audience: "Audience",
  geography: "Geography",
  timing: "Timing"
};

function formatDate(value, fallback = "Date not listed") {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateTime.format(date);
}

function readFilters() {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, form.elements[key].value]));
}

function setFilters(filters) {
  FILTER_KEYS.forEach((key) => {
    if (Array.from(form.elements[key].options).some((option) => option.value === filters[key])) {
      form.elements[key].value = filters[key];
    }
  });
  state.filters = { ...DEFAULT_FILTERS, ...filters };
}

function syncUrl() {
  window.history.replaceState({}, "", plannerUrl(window.location.href, state.filters, state.selectedEventId));
}

function reducedMotionRequested() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function clearPriorOutput() {
  requestTracker.begin();
  resultsSection.hidden = true;
  results.innerHTML = "";
  stats.innerHTML = "";
  resultSummary.textContent = "";
  briefOutput.hidden = true;
  briefContent.innerHTML = "";
  briefActionStatus.textContent = "";
  sourceMeta.textContent = metadataText(null);
}

function setOptions(select, values, allLabel) {
  const selected = state.filters[select.name] ?? select.value;
  select.replaceChildren(new Option(allLabel, "All"));
  values.forEach((value) => select.add(new Option(value, value)));
  select.value = values.includes(selected) ? selected : "All";
  state.filters[select.name] = select.value;
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
  form.hidden = false;
  sampleBadge.hidden = mode !== "sample";
  if (mode === "sample") {
    state.mode = "sample";
    setFilters(SAMPLE_FILTERS);
    showStep(3);
    workflowStatus.textContent = "Fictional sample loaded. Finding current public signals now.";
    loadEvents({ autoSelectFirst: true });
    return;
  }

  resetCustomState(state, DEFAULT_FILTERS);
  setFilters(DEFAULT_FILTERS);
  clearPriorOutput();
  syncUrl();
  showStep(1, true);
  workflowStatus.textContent = "Custom brief started. Six choices are grouped into three quick steps on mobile.";
  revealElement(document.querySelector("#planner"), { reducedMotion: reducedMotionRequested() });
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

      <details class="event-details">
        <summary>Why this match + unknowns</summary>
        <div class="event-details-content">
          <div class="score-block" aria-label="Score breakdown">
            <p class="mini-label">VISIBLE SCORE COMPONENTS</p>
            <ul class="component-list">${componentList(components)}</ul>
          </div>
          <div class="evidence-grid">
            <div><p class="mini-label">MATCHED EVIDENCE</p><ul>${evidenceList(matched, componentLabels)}</ul></div>
            <div><p class="mini-label">STILL UNKNOWN</p><ul>${evidenceList(unknown)}</ul></div>
          </div>
          <p>Listed by ${escapeHtml(event.agency || "the source agency")}. This record can support a planning direction, not a claim about attendance, Host interest, pricing, or campaign results.</p>
        </div>
      </details>

      <div class="card-actions">
        <a class="button button-quiet source-action" href="${sourceUrl(event.id)}" target="_blank" rel="noreferrer"><span class="source-type">Government data</span> View source record</a>
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
        <a href="${sourceUrl(event.id)}" target="_blank" rel="noreferrer">View source record</a>
        <button type="button" data-select-event="${escapeHtml(event.id)}">Select</button>
      </div>
    </article>
  `;
}

function renderStats(counts = {}) {
  stats.innerHTML = statsRows(counts)
    .map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
}

function renderEvents(events) {
  const presentation = shortlistPresentation(events);
  resultsTitle.textContent = presentation.heading;
  resultSummary.textContent = presentation.summary;

  if (!presentation.primary.length) {
    results.innerHTML = `
      <div class="state-card empty-state">
        <strong>No public signals fit this combination.</strong>
        <p>Try all boroughs, families, or a broader brand direction.</p>
        <button class="button button-quiet" type="button" data-edit-brief>Edit my choices</button>
      </div>`;
    return;
  }

  results.innerHTML = `
    <div class="primary-results">${presentation.primary.map(primaryCard).join("")}</div>
    ${presentation.additional.length ? `
      <details class="more-results">
        <summary>See ${presentation.additional.length} additional qualified ${presentation.additional.length === 1 ? "record" : "records"}</summary>
        <div class="secondary-results">${presentation.additional.map(secondaryCard).join("")}</div>
      </details>` : ""}
  `;
}

function renderMetadata(data) {
  sourceMeta.textContent = metadataText(data);
}

function renderLoading() {
  resultsSection.hidden = false;
  resultsTitle.textContent = "Finding public signals";
  resultSummary.textContent = "Loading public records";
  stats.innerHTML = "";
  sourceMeta.textContent = metadataText(null);
  results.setAttribute("aria-busy", "true");
  results.innerHTML = `<div class="primary-results loading-grid" aria-hidden="true">${Array.from({ length: 3 }, () => `
    <div class="signal-card skeleton-card"><span></span><span></span><span></span><span></span></div>
  `).join("")}</div>`;
}

function renderError(message) {
  resultsTitle.textContent = "Public signals unavailable";
  resultSummary.textContent = "Data unavailable";
  stats.innerHTML = "";
  sourceMeta.textContent = metadataText(null);
  results.innerHTML = `
    <div class="state-card error-state" role="alert">
      <strong>Public records did not load.</strong>
      <p>${escapeHtml(message)}</p>
      <button class="button button-primary" type="button" data-retry>Retry public records</button>
    </div>`;
}

async function loadEvents({ sharedEventId = null, autoSelectFirst = false } = {}) {
  const requestId = requestTracker.begin();
  state.selectedEventId = sharedEventId;
  state.brief = null;
  briefOutput.hidden = true;
  briefContent.innerHTML = "";
  briefActionStatus.textContent = "";
  syncUrl();
  renderLoading();
  workflowStatus.textContent = "Loading current NYC public records and ranking transparent compatibility.";

  try {
    const query = new URLSearchParams(state.filters);
    const response = await fetch(`/api/events?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Public-event data is unavailable right now.");

    if (!requestTracker.commit(requestId, () => {
      state.events = Array.isArray(data.events) ? data.events : [];
      setOptions(boroughSelect, data.facets?.boroughs ?? [], "All boroughs");
      renderStats(data.counts);
      renderEvents(state.events);
      renderMetadata(data);
      resultsSection.hidden = false;
      if (autoSelectFirst && state.events[0]) {
        selectEvent(state.events[0].event.id);
        return;
      }
      const sharedEvent = sharedEventId && state.events.find(({ event }) => String(event.id) === String(sharedEventId));
      if (sharedEvent) {
        renderBrief(sharedEvent);
        return;
      }
      if (sharedEventId) {
        state.selectedEventId = null;
        syncUrl();
        workflowStatus.textContent = "That public record is no longer in this window. Here are the current best matches.";
        revealElement(resultsTitle, { focus: true, reducedMotion: reducedMotionRequested() });
        return;
      }
      workflowStatus.textContent = state.events.length
        ? "Shortlist ready. Compare the evidence, open a source, then choose one signal."
        : "No qualified signals were found. Your brief choices are preserved.";
      revealElement(resultsTitle, { focus: true, reducedMotion: reducedMotionRequested() });
    })) return;
  } catch (error) {
    if (!requestTracker.commit(requestId, () => {
      state.events = [];
      renderError(error instanceof Error ? error.message : "Public-event data is unavailable right now.");
      workflowStatus.textContent = "Public records are unavailable. Your choices are preserved and retry is ready.";
    })) return;
  } finally {
    if (requestTracker.isCurrent(requestId)) results.removeAttribute("aria-busy");
  }
}

function renderBrief(selected) {
  const brief = generateBrief(state.filters, selected);
  state.brief = brief;
  briefOutput.hidden = false;
  briefActionStatus.textContent = "";
  briefContent.innerHTML = `
    <p class="eyebrow">STEP 3 / SIGNAL SELECTED</p>
    <h3 id="brief-title" tabindex="-1">${escapeHtml(brief.title)}</h3>
    <div class="brief-summary">
      <div><strong>Intent</strong><p>${escapeHtml(brief.intent)}</p></div>
      <div><strong>Gathering</strong><p>${escapeHtml(brief.gathering)}</p></div>
      <div><strong>Fit</strong><p>${escapeHtml(brief.fit)}</p></div>
      <div><strong>Activation</strong><p>${escapeHtml(brief.activation)}</p></div>
      <div><strong>Value add</strong><p>${escapeHtml(brief.valueAdd)}</p></div>
    </div>
    <details class="brief-details">
      <summary>Open details</summary>
      <div class="brief-details-content">
        <section><h4>Host questions</h4><ul>${brief.hostQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></section>
        <section><h4>Measurement</h4><ul>${brief.measurement.map((item) => `<li><strong>${escapeHtml(item.label)}</strong> ${escapeHtml(item.method)}</li>`).join("")}</ul></section>
        <section><h4>Limitations</h4><ul>${brief.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul></section>
        <section><h4>Source</h4><a href="${escapeHtml(brief.sourceUrl)}" target="_blank" rel="noreferrer">NYC Open Data public record</a><p class="brief-source-url">${escapeHtml(brief.sourceUrl)}</p></section>
        <section><h4>Methodology</h4><p class="brief-methodology">Compatibility uses public event language, campaign goal, audience, geography, and timing. It does not score Host trust, willingness, pricing, capacity, or relationship fit.</p></section>
      </div>
    </details>
  `;
  revealElement(document.querySelector("#brief-title"), { focus: true, reducedMotion: reducedMotionRequested() });
  workflowStatus.textContent = `${selected.event.name} selected. The public source remains attached.`;
}

function selectEvent(eventId) {
  const selected = state.events.find(({ event }) => String(event.id) === String(eventId));
  if (!selected) return;
  state.selectedEventId = selected.event.id;
  syncUrl();
  renderBrief(selected);
}

function briefText(brief) {
  return [
    brief.title,
    "",
    `Intent: ${brief.intent}`,
    `Gathering: ${brief.gathering}`,
    `Fit: ${brief.fit}`,
    `Activation: ${brief.activation}`,
    `Value add: ${brief.valueAdd}`,
    "",
    "Host questions:",
    ...brief.hostQuestions.map((question) => `- ${question}`),
    "",
    "Measurement:",
    ...brief.measurement.map((item) => `- ${item.label}: ${item.method}`),
    "",
    "Limitations:",
    ...brief.limitations.map((limitation) => `- ${limitation}`),
    "",
    `Source: ${brief.sourceUrl}`,
    "Methodology: Compatibility uses public event language, campaign goal, audience, geography, and timing. It does not score Host trust, willingness, pricing, capacity, or relationship fit."
  ].join("\n");
}

function showManualCopy(text) {
  briefContent.querySelector(".manual-copy")?.remove();
  const textarea = document.createElement("textarea");
  textarea.className = "manual-copy";
  textarea.readOnly = true;
  textarea.value = text;
  textarea.setAttribute("aria-label", "Manual copy text");
  briefContent.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  briefActionStatus.textContent = "Copy did not finish automatically. Select the highlighted text and copy it manually.";
}

async function copyText(text, successMessage) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
    await navigator.clipboard.writeText(text);
    briefContent.querySelector(".manual-copy")?.remove();
    briefActionStatus.textContent = successMessage;
  } catch {
    showManualCopy(text);
  }
}

function resetPlanner() {
  requestTracker.begin();
  resetCustomState(state, DEFAULT_FILTERS);
  state.mode = "start";
  setFilters(DEFAULT_FILTERS);
  form.hidden = true;
  sampleBadge.hidden = true;
  showStep(1);
  clearPriorOutput();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
  workflowStatus.textContent = "Choose a sample or build your own brief to start.";
  document.querySelector("#custom-start").focus({ preventScroll: true });
}

function restoreSharedState() {
  const url = new URL(window.location.href);
  const restored = { ...DEFAULT_FILTERS };
  let hasFilters = false;

  FILTER_KEYS.forEach((key) => {
    const value = url.searchParams.get(key);
    const options = Array.from(form.elements[key].options);
    if (value && (key === "borough" || options.some((option) => option.value === value))) {
      restored[key] = value;
      hasFilters = true;
    }
  });

  const sharedEventId = url.searchParams.get("event");
  if (!hasFilters && !sharedEventId) return;

  state.mode = "custom";
  form.hidden = false;
  setFilters(restored);
  showStep(1);
  workflowStatus.textContent = "Restoring shared brief choices and current public records.";
  loadEvents({ sharedEventId });
}

document.querySelector("#sample-start").addEventListener("click", () => openForm("sample"));
document.querySelector("#custom-start").addEventListener("click", () => openForm("custom"));
document.querySelector("#edit-from-start").addEventListener("click", () => showStep(1, true));

form.addEventListener("change", () => {
  state.filters = readFilters();
  state.selectedEventId = null;
  state.brief = null;
  clearPriorOutput();
  syncUrl();
  if (state.mode === "sample") {
    state.mode = "custom";
    sampleBadge.hidden = true;
  }
  workflowStatus.textContent = "Choices changed. Submit to refresh public signals.";
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
  state.filters = readFilters();
  sampleBadge.hidden = true;
  loadEvents();
});

document.querySelector("#copy-brief").addEventListener("click", () => {
  if (state.brief) copyText(briefText(state.brief), "Brief copied.");
});

document.querySelector("#print-brief").addEventListener("click", () => {
  if (state.brief) window.print();
});

document.querySelector("#copy-share-link").addEventListener("click", () => {
  if (!state.brief) return;
  syncUrl();
  copyText(window.location.href, "Share link copied.");
});

document.querySelector("#reset-brief").addEventListener("click", resetPlanner);

results.addEventListener("click", (event) => {
  const selectButton = event.target.closest("[data-select-event]");
  if (selectButton) selectEvent(selectButton.dataset.selectEvent);
  if (event.target.closest("[data-retry]")) loadEvents();
  if (event.target.closest("[data-edit-brief]")) {
    showStep(1, true);
    revealElement(form, { reducedMotion: reducedMotionRequested() });
  }
});

document.querySelectorAll(".disclosure").forEach((disclosure) => {
  disclosure.addEventListener("toggle", () => {
    const action = disclosure.querySelector(".summary-action");
    if (action) action.textContent = disclosure.open ? "fold back" : "unfold";
  });
});

restoreSharedState();
