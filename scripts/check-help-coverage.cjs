// Which menu pages have help yet (backlog 8.1). Reads the sidebar's pages and the help topics' routes.
//   node scripts/check-help-coverage.cjs          → summary per menu group + the pages still missing
//   node scripts/check-help-coverage.cjs --strict → exit 1 when any menu page has no help
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "src");
const sidebar = fs.readFileSync(path.join(src, "layout", "AppSidebar.tsx"), "utf8");

// Menu pages, with the group (top-level menu entry) each sits under
const pages = [];
let group = "";
for (const m of sidebar.matchAll(/name:\s*"([^"]+)",\s*path:\s*"([^"]+)"|name:\s*"([^"]+)",\s*\r?\n\s*(?:icon|subItems)/g)) {
  if (m[3]) { group = m[3]; continue; }
  pages.push({ group: group || "Top", name: m[1], route: m[2] });
}

// Help routes: each topic's own `route: "..."` and `aliases: [...]` (a line of its own, not the inline related links)
const topicsDir = path.join(src, "help", "topics");
const helped = new Set();
for (const file of fs.readdirSync(topicsDir).filter((f) => f.endsWith(".ts"))) {
  const text = fs.readFileSync(path.join(topicsDir, file), "utf8");
  for (const m of text.matchAll(/^\s*route:\s*"([^"]+)",?\s*$/gm)) helped.add(m[1]);
  for (const m of text.matchAll(/aliases:\s*\[([^\]]*)\]/g)) for (const a of m[1].matchAll(/"([^"]+)"/g)) helped.add(a[1]);
}
// The Help Center itself needs no help topic
const has = (route) => route === "/help" || helped.has(route);

const groups = {};
for (const p of pages) (groups[p.group] ??= []).push(p);
let missing = 0;
for (const [g, list] of Object.entries(groups)) {
  const done = list.filter((p) => has(p.route)).length;
  missing += list.length - done;
  console.log(`${done === list.length ? "✔" : " "} ${g}: ${done}/${list.length}`);
}
const total = pages.length;
console.log(`\n${total - missing}/${total} menu pages have help.`);
if (missing && process.argv.includes("--list")) {
  console.log("\nStill missing:");
  for (const p of pages.filter((x) => !has(x.route))) console.log(`  ${p.group} → ${p.name} (${p.route})`);
}
if (missing && process.argv.includes("--strict")) process.exit(1);
