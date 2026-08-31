// pnpm verify — proves the form actually gets filled.
//
// Two made-up patients are pushed through the SAME pure functions the app uses
// (lib/flow.ts): every step must be answered, the exported JSON must cover every
// key / row / column of the clinic's official schema (lib/intake-schema.json)
// with values from its option lists, the inference must fire where expected,
// and the Hinglish rule parser must read a table of spoken phrases correctly.
// Exits non-zero on the first failure. `--update` rewrites the JSON snapshots.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Answers, QUESTIONS } from "../lib/intake-schema";
import { buildFilledForm, isAnswered, steps, suggest, toSchemaJson, Step } from "../lib/flow";
import { parseNumber, parseRules } from "../lib/voice-parse";
import official from "../lib/intake-schema.json";

type Json = Record<string, any>;
const FIX = join(__dirname, "fixtures");
const update = process.argv.includes("--update");
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  assert.ok(cond, msg);
  checks++;
};

// ── The official schema, indexed for lookups ───────────────────────────────
const byKey: Record<string, Json> = {};
for (const sec of official.sections) for (const q of sec.questions) byKey[q.key] = q;
ok(Object.keys(byKey).length === 16, "official schema has 16 questions");

function assertInOptions(value: unknown, options: string[] | undefined, where: string) {
  if (!options) return;
  if (Array.isArray(value)) value.forEach((v) => ok(options.includes(v), `${where}: "${v}" not in ${JSON.stringify(options)}`));
  else if (value === "yes" || value === "no") return;
  else ok(options.includes(value as string), `${where}: "${value}" not in ${JSON.stringify(options)}`);
}

function verifyPatient(name: string, a: Answers) {
  const all = steps(a);
  ok(all.every((s: Step) => isAnswered(s, a)), `${name}: every step answered`);
  const rows = buildFilledForm(a, "en");
  ok(rows.length === 16 && rows.every((r) => r.answered), `${name}: 16 review rows, all answered`);
  ok(new Set(rows.map((r) => r.q.section)).size === 5, `${name}: sections A–E all present`);

  const out = toSchemaJson(a, "en") as Json;
  for (const [key, q] of Object.entries(byKey)) {
    ok(key in out && out[key] !== null, `${name}: official key "${key}" present`);
    const v = out[key];
    if (q.type === "number") ok(typeof v === "number", `${name}: ${key} is a number`);
    if (q.type === "single" || q.type === "multi") assertInOptions(v, q.options, `${name}.${key}`);
    if (q.type === "yesno") {
      ok(v === "yes" || v === "no", `${name}: ${key} is yes/no`);
      if (q.followup) ok((q.followup.key in out) === (v === "yes"), `${name}: ${q.followup.key} present iff ${key}=yes`);
    }
    if (q.type === "table" && q.columns) {
      for (const row of q.rows as string[]) {
        ok(row in v, `${name}: ${key} row "${row}" present`);
        const cell = v[row];
        ok(typeof cell[q.columns[0].key] === "boolean", `${name}: ${key}.${row}.${q.columns[0].key} is boolean`);
        for (const col of q.columns.slice(1)) {
          if (cell[q.columns[0].key]) {
            ok(col.key in cell && cell[col.key] !== null, `${name}: ${key}.${row}.${col.key} filled`);
            assertInOptions(cell[col.key], col.options, `${name}.${key}.${row}.${col.key}`);
          } else ok(!(col.key in cell), `${name}: ${key}.${row}.${col.key} omitted when not used`);
        }
      }
    }
    if (q.type === "table" && !q.columns) {
      // habits: one key per row, follow-ups only when triggered
      for (const row of q.rows as Json[]) {
        ok(row.key in v && v[row.key] !== null, `${name}: habits.${row.key} present`);
        assertInOptions(v[row.key], row.options, `${name}.habits.${row.key}`);
        if (row.followup) {
          const on = v[row.key] === "yes";
          ok((row.followup.key in v) === on, `${name}: habits.${row.followup.key} present iff ${row.key}=yes`);
          if (on) assertInOptions(v[row.followup.key], row.followup.options, `${name}.habits.${row.followup.key}`);
        }
      }
    }
  }
  return out;
}

// ── Patient 1: Priya, 34F ──────────────────────────────────────────────────
const priya = JSON.parse(readFileSync(join(FIX, "priya-34f.json"), "utf8")) as Answers;
delete (priya as Json)._about;
const priyaOut = verifyPatient("priya", priya);
ok(priyaOut.menstrual_cycle === "Irregular", "priya: Q6 is a real answer");
ok(priyaOut.pregnancy_related === "Not applicable", "priya: Q7 answered");
ok(priyaOut.diagnosed_conditions.includes("PCOS/PCOD"), "priya: PCOS exported with the official label");
ok(priyaOut.habits.smoking === "yes" && priyaOut.habits.smoking_severity === "Moderate 5-10/day", "priya: smoking severity on yes");
ok(priyaOut.habits.salon_treatment_detail === "Keratin", "priya: salon detail is free text");
ok(priyaOut.describe.includes("did not help"), "priya: describe carries the seeded text");
const priyaQ14 = suggest(steps(priya).find((s) => s.id === "past_treatment_side_effects")!, priya);
ok(priyaQ14 && (priyaQ14.value as Json).value === "yes", "priya: Q14 suggested YES from Q12 (helped: no)");
assert.deepEqual(priyaOut._meta.inferred, ["past_treatment_side_effects"], "priya: only Q14 was inferred");

// ── Patient 2: Rajesh, 58M ─────────────────────────────────────────────────
const rajesh = JSON.parse(readFileSync(join(FIX, "rajesh-58m.json"), "utf8")) as Answers;
delete (rajesh as Json)._about;
const rajeshOut = verifyPatient("rajesh", rajesh);
ok(rajeshOut.menstrual_cycle === "Not applicable" && rajeshOut.pregnancy_related === "Not applicable", "rajesh: Q6/Q7 Not applicable");
ok(!("smoking_severity" in rajeshOut.habits), "rajesh: no smoking severity when smoking = no");
assert.deepEqual(rajeshOut.past_6_months, [], "rajesh: 'none of these' exports as an empty list");
ok(rajeshOut.procedures["Hair Transplant"].done === true && rajeshOut.procedures["Hair Transplant"].sessions === "1-3", "rajesh: transplant row complete");
const rajeshQ7 = suggest(steps(rajesh).find((s) => s.id === "pregnancy_related")!, rajesh);
ok(rajeshQ7 === undefined, "rajesh: Q6 'Not applicable' must NOT pre-fill Q7 (a pregnant patient has no periods either)");
const meno = suggest(steps({ menstrual_cycle: "menopausal" }).find((s) => s.id === "pregnancy_related")!, { menstrual_cycle: "menopausal" });
ok(meno?.value === "na", "menopausal → Q7 suggested Not applicable");
assert.deepEqual(rajeshOut._meta.inferred, ["past_treatment_side_effects"], "rajesh: only Q14 inferred");

// ── Inference for a patient who has tried nothing ──────────────────────────
const fresh: Answers = { ...rajesh, products: Object.fromEntries(Object.keys(rajesh.products as Json).map((k) => [k, { used: "no" }])), procedures: Object.fromEntries(Object.keys(rajesh.procedures as Json).map((k) => [k, { done: "no" }])) };
delete fresh.past_treatment_side_effects;
const freshQ14 = suggest(steps(fresh).find((s) => s.id === "past_treatment_side_effects")!, fresh);
ok(freshQ14 && (freshQ14.value as Json).value === "no", "nothing tried → Q14 suggested NO");
ok(steps(fresh).filter((s) => s.kind === "card").length === 0, "nothing picked → no card steps");
ok(steps(rajesh).filter((s) => s.kind === "card").length === 3, "rajesh: 2 product cards + 1 procedure card");

// ── Every question visible for everyone: 16 numbers, nothing skipped ────────
ok(new Set(steps({}).map((s) => s.n)).size === 16, "empty intake still has all 16 questions");
ok(QUESTIONS.every((q) => q.id in byKey), "every app question id is an official key");

// ── Every option list in the app equals the official one, string for string ─
const exportSet = (opts: { label: string; out?: string; uiOnly?: boolean }[]) =>
  opts.filter((o) => !o.uiOnly).map((o) => o.out ?? o.label).sort();
const same = (a: string[], b: string[], where: string) =>
  assert.deepEqual(a, [...b].sort(), `${where}: option lists differ`);
for (const q of QUESTIONS) {
  const off = byKey[q.id];
  if (q.options) same(exportSet(q.options), off.options, q.id), checks++;
  if (q.habits)
    for (const r of q.habits) {
      const row = (off.rows as Json[]).find((x) => x.key === r.id)!;
      ok(row, `habits row ${r.id} exists officially`);
      if (r.options) same(exportSet(r.options), row.options, `habits.${r.id}`), checks++;
      if (r.followup?.options) same(exportSet(r.followup.options), row.followup.options, `habits.${r.followup.id}`), checks++;
    }
  if (q.rows && q.columns) {
    same(q.rows.map((r) => r.out).sort(), off.rows, `${q.id} rows`), checks++;
    for (const c of q.columns) {
      const col = (off.columns as Json[]).find((x) => x.key === c.id)!;
      ok(col, `${q.id} column ${c.id} exists officially`);
      if (c.options) same(exportSet(c.options), col.options, `${q.id}.${c.id}`), checks++;
    }
  }
}

// ── The Hinglish rule parser ───────────────────────────────────────────────
const step = (id: string, a: Answers = {}) => steps(a).find((s) => s.id === id)!;
const cases: [string, string, unknown][] = [
  ["age_hair_loss_began", "pachees saal ki umar mein", 25],
  ["age_hair_loss_began", "twenty two", 22],
  ["age_hair_loss_began", "around 34", 34],
  ["family_history", "haan papa ko bhi tha", ["father"]],
  ["family_history", "mummy aur bhai dono", ["mother", "siblings"]],
  ["family_history", "kisi ko nahi", ["none"]],
  ["diagnosed_conditions", "sugar aur thyroid hai", ["thyroid", "diabetes"]], // option order, not spoken order
  ["adult_acne_oily_skin", "hair fall nahi hai", "no"],
  ["adult_acne_oily_skin", "haan hota hai", "yes"],
  ["menstrual_cycle", "lagu nahi hota", "na"],
  ["menstrual_cycle", "thoda aage peeche rehta hai", "irregular"],
  ["duration", "do saal se", "over-1y"],
  ["sample_type", "thook wala theek hai", "saliva"],
  ["past_6_months", "bahut tension thi aur dengue hua tha", ["stress", "fever"]],
  ["duration", "6 mahine se kam", "under-6m"],
  ["menstrual_cycle", "band nahi hue abhi", null], // negated → not a confident Menopausal; LLM decides
  ["adult_acne_oily_skin", "haan na hota hai", "yes"], // "na" as a tag particle is not a "no"
  ["age_hair_loss_began", "95 saal", null], // outside the 1–90 range → no suggestion
  ["family_history", "mummy bhi", ["mother"]],
];
// Speaking adds to what was already tapped.
assert.deepEqual(parseRules(step("family_history"), "mummy bhi", ["father"]).value, ["father", "mother"], "parser: multi merges with tapped");
checks++;
for (const [id, said, expected] of cases) {
  const r = parseRules(step(id), said);
  assert.deepEqual(r.value, expected, `parser: "${said}" → ${JSON.stringify(expected)} (got ${JSON.stringify(r.value)})`);
  checks++;
}
ok(parseRules(step("adult_acne_oily_skin"), "hair").value === null, 'parser: "hair" is not "haan"');
ok(parseNumber("pachaas saal ki umar") === 50 && parseNumber("thirty five") === 35, "parser: Hindi + English number words");
ok(parseNumber("papa ke saath") === null, 'parser: "saath" (with) is not sixty');
const pick = parseRules(step("products.pick"), "tel aur goli li thi").value as Json;
ok(pick.oils.used === "yes" && pick.oral_minoxidil.used === "yes" && pick.topical_minoxidil.used === "no", "parser: picker fills every gate");

// ── Snapshots of the exported JSON ─────────────────────────────────────────
for (const [name, out] of [
  ["priya-34f", priyaOut],
  ["rajesh-58m", rajeshOut],
] as const) {
  const file = join(FIX, `expected-${name}.json`);
  const text = JSON.stringify(out, null, 2) + "\n";
  if (update || !existsSync(file)) writeFileSync(file, text);
  else assert.equal(readFileSync(file, "utf8"), text, `${name}: exported JSON matches expected-${name}.json (run with --update to accept)`);
  checks++;
}

console.log(`verify-fill: ${checks} checks passed — both patients fill all 16 questions against the official schema.`);
