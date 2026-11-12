// Arabic help (backlog 8.1.8): every topic and flow has its Arabic, and each Arabic still has the shape of its English
// (same number of roles, tasks, steps, fields, statuses, rules and related links), so no text is shown against the
// wrong item after the English changes.
//   node scripts/check-help-arabic.cjs           → summary per module + problems
//   node scripts/check-help-arabic.cjs --strict  → exit 1 on any missing translation or problem
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const help = path.join(__dirname, "..", "src", "help");

// Just enough of a module loader for the help's plain-data TypeScript files
const cache = new Map();
const load = (file) => {
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  cache.set(file, module);
  const requireFrom = (request) => {
    if (!request.startsWith(".")) return {};
    const base = path.resolve(path.dirname(file), request);
    const resolved = [`${base}.ts`, path.join(base, "index.ts")].find((p) => fs.existsSync(p));
    if (!resolved) throw new Error(`${file}: cannot resolve ${request}`);
    return load(resolved);
  };
  vm.runInNewContext(js, { module, exports: module.exports, require: requireFrom });
  return module.exports;
};

const topics = Object.values(load(path.join(help, "index.ts"))).find((v) => Array.isArray(v) && v[0]?.route);
const flows = load(path.join(help, "flows.ts")).HELP_FLOWS;
const arFile = path.join(help, "ar", "index.ts");
const ar = fs.existsSync(arFile) ? load(arFile).AR_HELP : { topics: {}, flows: {} };

const ARABIC = /[؀-ۿ]/;
const problems = [];
const text = (where, english, arabic) => {
  if (english === undefined) return;
  if (typeof arabic !== "string" || !arabic.trim()) problems.push(`${where}: missing`);
  else if (!ARABIC.test(arabic)) problems.push(`${where}: not Arabic ("${arabic.slice(0, 40)}")`);
};
const list = (where, english = [], arabic, each) => {
  if (!english.length) {
    if (arabic && arabic.length) problems.push(`${where}: Arabic has ${arabic.length} item(s), English none`);
    return;
  }
  if (!Array.isArray(arabic)) return void problems.push(`${where}: missing`);
  if (arabic.length !== english.length) problems.push(`${where}: ${arabic.length} item(s) in Arabic, ${english.length} in English`);
  english.forEach((e, i) => arabic[i] !== undefined && each(`${where}[${i}]`, e, arabic[i]));
};

const byModule = {};
for (const topic of topics) {
  const entry = (byModule[topic.module] ??= { total: 0, done: 0 });
  entry.total++;
  const a = ar.topics[topic.id];
  if (!a) continue;
  entry.done++;
  const at = `topic ${topic.id}`;
  text(`${at}.title`, topic.title, a.title);
  text(`${at}.summary`, topic.summary, a.summary);
  list(`${at}.who`, topic.who, a.who, (w, e, x) => { text(`${w}.role`, e.role, x.role); text(`${w}.can`, e.can, x.can); });
  list(`${at}.tasks`, topic.tasks, a.tasks, (w, e, x) => {
    text(`${w}.title`, e.title, x.title);
    if (e.who !== undefined) text(`${w}.who`, e.who, x.who);
    else if (x.who) problems.push(`${w}.who: Arabic has a "who" the English hasn't`);
    list(`${w}.steps`, e.steps, x.steps, (s, es, xs) => text(s, es, xs));
  });
  for (const key of ["fields", "statuses"]) {
    list(`${at}.${key}`, topic[key], a[key], (w, e, x) => { text(`${w}.name`, e.name, x.name); text(`${w}.meaning`, e.meaning, x.meaning); });
  }
  list(`${at}.rules`, topic.rules, a.rules, (w, e, x) => text(w, e, x));
  list(`${at}.related`, topic.related, a.related, (w, e, x) => {
    text(`${w}.label`, e.label, x.label);
    if (e.why !== undefined) text(`${w}.why`, e.why, x.why);
  });
}
for (const id of Object.keys(ar.topics)) if (!topics.some((t) => t.id === id)) problems.push(`topic ${id}: in Arabic but not in English`);

let flowsDone = 0;
for (const flow of flows) {
  const a = ar.flows[flow.id];
  if (!a) continue;
  flowsDone++;
  const at = `flow ${flow.id}`;
  text(`${at}.title`, flow.title, a.title);
  text(`${at}.summary`, flow.summary, a.summary);
  list(`${at}.steps`, flow.steps, a.steps, (w, e, x) => {
    text(`${w}.title`, e.title, x.title);
    if (e.who !== undefined) text(`${w}.who`, e.who, x.who);
    text(`${w}.detail`, e.detail, x.detail);
  });
}
for (const id of Object.keys(ar.flows)) if (!flows.some((f) => f.id === id)) problems.push(`flow ${id}: in Arabic but not in English`);

// Examples with sample data (src/help/examples): every topic and flow has one; its Arabic has the story, one label per
// data row (values stay as they are) and the result; a flow's Arabic has one line per step
const examplesFile = path.join(help, "examples", "index.ts");
if (fs.existsSync(examplesFile)) {
  const { HELP_EXAMPLES: ex, FLOW_EXAMPLES: fx } = load(examplesFile);
  const arEx = ar.examples ?? {};
  const arFx = ar.flowExamples ?? {};
  let exDone = 0;
  for (const topic of topics) {
    const e = ex[topic.id];
    const at = `example ${topic.id}`;
    if (!e) { problems.push(`${at}: no English example`); continue; }
    const a = arEx[topic.id];
    if (!a) { problems.push(`${at}: no Arabic`); continue; }
    exDone++;
    text(`${at}.story`, e.story, a.story);
    if (e.result !== undefined) text(`${at}.result`, e.result, a.result);
    // A label that is itself data (a document number, a product or vendor name) is kept exactly as in the English
    list(`${at}.labels`, e.data, a.labels, (w, d, x) => (x === d.label ? undefined : text(w, d.label, x)));
  }
  for (const id of Object.keys(ex)) if (!topics.some((t) => t.id === id)) problems.push(`example ${id}: no topic with this id`);
  let fxDone = 0;
  for (const flow of flows) {
    const e = fx[flow.id];
    const at = `flow example ${flow.id}`;
    if (!e) { problems.push(`${at}: no English example`); continue; }
    if (e.steps.length !== flow.steps.length) problems.push(`${at}: ${e.steps.length} line(s) for ${flow.steps.length} step(s)`);
    const a = arFx[flow.id];
    if (!a) { problems.push(`${at}: no Arabic`); continue; }
    fxDone++;
    text(`${at}.story`, e.story, a.story);
    list(`${at}.steps`, e.steps, a.steps, (w, s, x) => text(w, s, x));
  }
  console.log(`${exDone === topics.length && fxDone === flows.length ? "✔" : " "} Examples: ${exDone}/${topics.length} pages, ${fxDone}/${flows.length} flows in Arabic`);
}

let missing = 0;
for (const [module, { total, done }] of Object.entries(byModule)) {
  missing += total - done;
  console.log(`${done === total ? "✔" : " "} ${module}: ${done}/${total}`);
}
missing += flows.length - flowsDone;
console.log(`${flowsDone === flows.length ? "✔" : " "} Flows: ${flowsDone}/${flows.length}`);
const doneTopics = topics.length - (missing - (flows.length - flowsDone));
console.log(`\n${doneTopics}/${topics.length} topics and ${flowsDone}/${flows.length} flows have Arabic.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.log(`  ${p}`);
  if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
}
if ((missing || problems.length) && process.argv.includes("--strict")) process.exit(1);
