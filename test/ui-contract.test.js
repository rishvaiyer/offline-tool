import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

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

test("keeps primary source and selection actions visible on three-card shortlist", async () => {
  const app = await source("public/app.js");
  const primaryTemplate = app.slice(
    app.indexOf("function primaryCard"),
    app.indexOf("function secondaryCard")
  );
  const disclosureEnd = primaryTemplate.indexOf("</details>");

  assert.notEqual(disclosureEnd, -1);
  assert.ok(primaryTemplate.indexOf("View source record") > disclosureEnd);
  assert.ok(primaryTemplate.indexOf("Build a brief around this") > disclosureEnd);
  assert.match(app, /events\.slice\(0,\s*3\)/);
});

test("defines mobile, touch-target, reduced-motion, and print contracts", async () => {
  const css = await source("public/styles.css");

  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*390px\)/);
  assert.match(css, /@media \(max-width:\s*390px\)[\s\S]*\.card-actions \.button\s*\{[^}]*flex:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media print/);
});
