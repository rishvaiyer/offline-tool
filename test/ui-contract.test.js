import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const execFileAsync = promisify(execFile);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("keeps the browser entry module syntactically executable", async () => {
  await execFileAsync(process.execPath, ["--check", fileURLToPath(new URL("public/app.js", root))]);
});

test("offers the one-minute start flow and accessible output regions", async () => {
  const html = await source("public/index.html");

  assert.match(html, /Try a sample brief/);
  assert.match(html, /Build my own/);
  assert.match(html, /Sources \+ methodology/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="brief-output"/);

  for (const key of ["vertical", "goal", "audience", "borough", "energy", "scale"]) {
    assert.match(html, new RegExp(`name="${key}"`));
  }
});

test("links back to the scrapbook and labels the independent application", async () => {
  const html = await source("public/index.html");

  assert.match(html, /href="https:\/\/offline-scrapbook-production\.up\.railway\.app\/"[^>]*>back to scrapbook/);
  assert.match(html, /Built by Rishva Iyer for an Offline engineering application/);
  assert.match(html, /not affiliated with, endorsed by, or part of Offline or its products/);
});

test("keeps primary source and selection actions visible on three-card shortlist", async () => {
  const app = await source("public/app.js");
  const primaryTemplate = app.slice(
    app.indexOf("function primaryCard"),
    app.indexOf("function secondaryCard")
  );
  const disclosureEnd = primaryTemplate.indexOf("</details>");

  assert.notEqual(disclosureEnd, -1);
  assert.ok(primaryTemplate.indexOf("score-block") < disclosureEnd);
  assert.ok(primaryTemplate.indexOf("evidence-grid") < disclosureEnd);
  assert.ok(primaryTemplate.indexOf("score-block") > primaryTemplate.indexOf('<details class="event-details">'));
  assert.ok(primaryTemplate.indexOf("View source record") > disclosureEnd);
  assert.ok(primaryTemplate.indexOf("Build a brief around this") > disclosureEnd);
  assert.match(app, /shortlistPresentation\(events\)/);
});

test("defines mobile, touch-target, reduced-motion, and print contracts", async () => {
  const css = await source("public/styles.css");

  assert.match(css, /\.brand\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.method-note \.disclosure-content a\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*520px\)/);
  assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*\.card-actions \.button\s*\{[^}]*flex:\s*none/);
  assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*\.brief-actions \.button\s*\{[^}]*flex:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media print/);
});

test("keeps the guided form compact on current phone widths", async () => {
  const css = await source("public/styles.css");

  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.form-step:not\(\.is-current\)\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.step-actions\s*\{[^}]*display:\s*flex/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.desktop-submit\s*\{[^}]*display:\s*none/);
});

test("offers portable brief actions and safe shared-state restoration", async () => {
  const [app, html, css] = await Promise.all([
    source("public/app.js"),
    source("public/index.html"),
    source("public/styles.css")
  ]);

  for (const label of ["Copy brief", "Print or save PDF", "Copy share link", "Start over"]) {
    assert.match(html, new RegExp(`>${label}<`));
  }

  assert.match(app, /import\s*\{[\s\S]*generateBrief[\s\S]*\}\s*from\s*["']\.\/brief\.js["']/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /window\.print\(\)/);
  assert.match(app, /window\.history\.replaceState/);
  assert.match(app, /That public record is no longer in this window\. Here are the current best matches\./);
  assert.match(app, /function resetPlanner\(\)/);
  assert.doesNotMatch(app, /location\.reload/);
  assert.match(app, /requestTracker\.isCurrent\(requestId\)/);
  assert.match(css, /@media print[\s\S]*\.brief-details/);
});

test("keeps primary decision evidence readable at mobile sizes", async () => {
  const css = await source("public/styles.css");

  assert.match(css, /\.event-type\s*\{[^}]*font-size:\s*10px/);
  assert.match(css, /\.mini-label\s*\{[^}]*font-size:\s*10px/);
  assert.match(css, /\.component-list li\s*\{[^}]*font:\s*10px\/1\.4/);
  assert.match(css, /\.evidence-grid ul\s*\{[^}]*font:\s*11px\/1\.5/);
  assert.match(css, /\.event-details p\s*\{[^}]*font:\s*11px\/1\.5/);
});

test("raises decision-relevant mobile copy above tiny type", async () => {
  const css = await source("public/styles.css");

  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.filter-field small[\s\S]*font-size:\s*12px/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.stat span[\s\S]*font-size:\s*11px/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.event-meta[\s\S]*font-size:\s*12px/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*\.event-details p[\s\S]*font-size:\s*12px/);
});
