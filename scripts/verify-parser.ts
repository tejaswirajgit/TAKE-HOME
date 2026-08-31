// Every option of every voice-parsable question, with the ways patients actually
// say it — English, Hinglish, romanized Hindi, and "option 2" / "teesra" / "last"
// — plus the things that must NOT match ("uncle", "pata nahi"). Offline: this is
// the free rule layer only; what it returns null for goes to the LLM or to a tap.
//
//   corepack pnpm verify

import { steps } from "../lib/flow";
import { parseRules, spokenYesNo } from "../lib/voice-parse";
import type { AnswerValue, RowAnswer } from "../lib/intake-schema";

type Expected = number | string | string[] | null | { value: string; detail?: string } | { picked: string[] };
const step = (id: string) => steps({})!.find((s) => s.id === id)!;

// [step id, what the patient said, what the rules must return]
const T: [string, string, Expected][] = [
  // Q1 — age (a number, 1–90)
  ["age_hair_loss_began", "pachees saal ki umar mein", 25],
  ["age_hair_loss_began", "twenty two", 22],
  ["age_hair_loss_began", "around 34", 34],
  ["age_hair_loss_began", "25", 25],
  ["age_hair_loss_began", "lagbhag tees saal", 30],
  ["age_hair_loss_began", "chalis ke aas paas", 40],
  ["age_hair_loss_began", "when I was forty five", 45],
  ["age_hair_loss_began", "18 saal", 18],
  ["age_hair_loss_began", "chhabbis saal", 26],
  ["age_hair_loss_began", "chabbis", 26],
  ["age_hair_loss_began", "95 saal", null],
  ["age_hair_loss_began", "pata nahi", null],
  ["age_hair_loss_began", "bahut pehle", null],

  // Q2 — duration: Under 6 months · 6 to 12 months · Over a year
  ["duration", "kuch mahine se", "under-6m"],
  ["duration", "Kuchh mahine se", "under-6m"], // Sarvam spelling
  ["duration", "chhe mahine se kam", "under-6m"],
  ["duration", "che mahine", "6-12m"],
  ["duration", "teen mahine", "under-6m"],
  ["duration", "two months", "under-6m"],
  ["duration", "6 mahine se kam", "under-6m"],
  ["duration", "abhi abhi shuru hua", "under-6m"],
  ["duration", "few months", "under-6m"],
  ["duration", "option 1", "under-6m"],
  ["duration", "pehla", "under-6m"],
  ["duration", "1", "under-6m"],
  ["duration", "aath mahine", "6-12m"],
  ["duration", "six months", "6-12m"],
  ["duration", "8 months", "6-12m"],
  ["duration", "almost a year", "6-12m"],
  ["duration", "das mahine ho gaye", "6-12m"],
  ["duration", "shaadi ke baad se, koi aath mahine", "6-12m"],
  ["duration", "option 2", "6-12m"],
  ["duration", "doosra", "6-12m"],
  ["duration", "2", "6-12m"],
  ["duration", "do saal se", "over-1y"],
  ["duration", "ek saal se zyada", "over-1y"],
  ["duration", "many years", "over-1y"],
  ["duration", "kaafi time se", "over-1y"],
  ["duration", "over a year", "over-1y"],
  ["duration", "3", "over-1y"],
  ["duration", "teesra wala", "over-1y"],
  ["duration", "last", "over-1y"],
  ["duration", "pata nahi", null],
  ["duration", "band nahi hue abhi, do teen saal se chal raha hai", "over-1y"], // "teen saal" is arithmetic, not a phrase
  // number + unit, any spelling
  ["duration", "15 mahina", "over-1y"],
  ["duration", "pandrah mahine se", "over-1y"],
  ["duration", "pandra mahine", "over-1y"],
  ["duration", "fifteen months", "over-1y"],
  ["duration", "12 mahine", "6-12m"],
  ["duration", "6 mahine", "6-12m"],
  ["duration", "chhe mahine se zyada", "6-12m"],
  ["duration", "1 saal se kam", "6-12m"],
  ["duration", "aadha saal", "6-12m"],
  ["duration", "dedh saal", "over-1y"],
  ["duration", "sawa saal se", "over-1y"],
  ["duration", "1.5 years", "over-1y"],
  ["duration", "3 hafte", "under-6m"],
  ["duration", "do mahine se", "under-6m"],
  ["duration", "ek mahina", "under-6m"],
  ["duration", "20 din se", "under-6m"],
  ["duration", "5 mahine se", "under-6m"],
  ["duration", "twenty five saal", "over-1y"],

  // Q3 — family: Father · Mother · Siblings · none
  ["family_history", "haan papa ko bhi tha", ["father"]],
  ["family_history", "Haan, papa ko bhi tha aur bhai ko bhi.", ["father", "siblings"]], // real STT output
  ["family_history", "my father", ["father"]],
  ["family_history", "dad", ["father"]],
  ["family_history", "pitaji ko", ["father"]],
  ["family_history", "option 1", ["father"]],
  ["family_history", "1", ["father"]],
  ["family_history", "mummy ko", ["mother"]],
  ["family_history", "mother", ["mother"]],
  ["family_history", "maa ko bhi", ["mother"]],
  ["family_history", "2", ["mother"]],
  ["family_history", "doosra", ["mother"]],
  ["family_history", "bhai ko", ["siblings"]],
  ["family_history", "my sister", ["siblings"]],
  ["family_history", "behen ko bhi hai", ["siblings"]],
  ["family_history", "brother and sister", ["siblings"]],
  ["family_history", "teesra", ["siblings"]],
  ["family_history", "option 3", ["siblings"]],
  ["family_history", "papa aur bhai", ["father", "siblings"]],
  ["family_history", "mummy aur bhai dono", ["mother", "siblings"]],
  ["family_history", "mummy papa dono ko", ["father", "mother"]],
  ["family_history", "1 aur 2", ["father", "mother"]],
  ["family_history", "option 1 and 3", ["father", "siblings"]],
  ["family_history", "pehla aur teesra", ["father", "siblings"]],
  ["family_history", "kisi ko nahi", ["none"]],
  ["family_history", "nobody", ["none"]],
  ["family_history", "koi nahi", ["none"]],
  ["family_history", "no one", ["none"]],
  ["family_history", "nahi", ["none"]],
  ["family_history", "4", ["none"]],
  ["family_history", "last wala", ["none"]],
  ["family_history", "aakhri", ["none"]],
  ["family_history", "uncle ko tha", null],
  ["family_history", "chacha ko", null],
  ["family_history", "pata nahi", null],
  ["family_history", "mausam bahut garam hai aaj", null],

  // Q4 — pattern: Receding · Crown · Part · Diffuse · Patchy · Shedding
  ["pattern", "maathe se", ["receding"]],
  ["pattern", "Mathhe se", ["receding"]], // Sarvam spelling
  ["pattern", "hairline peeche ja rahi hai", ["receding"]],
  ["pattern", "front se", ["receding"]],
  ["pattern", "temples", ["receding"]],
  ["pattern", "1", ["receding"]],
  ["pattern", "upar se", ["crown"]],
  ["pattern", "crown", ["crown"]],
  ["pattern", "sir ke upar", ["crown"]],
  ["pattern", "top pe", ["crown"]],
  ["pattern", "2", ["crown"]],
  ["pattern", "maang chaudi ho gayi", ["part"]],
  ["pattern", "parting", ["part"]],
  ["pattern", "beech se", ["part"]],
  ["pattern", "3", ["part"]],
  ["pattern", "sab jagah se", ["diffuse"]],
  ["pattern", "all over", ["diffuse"]],
  ["pattern", "poore sir se", ["diffuse"]],
  ["pattern", "patle ho gaye", ["diffuse"]],
  ["pattern", "4", ["diffuse"]],
  ["pattern", "gol patch", ["patchy"]],
  ["pattern", "patches", ["patchy"]],
  ["pattern", "ek jagah se", ["patchy"]],
  ["pattern", "5", ["patchy"]],
  ["pattern", "bahut zyada jhad rahe hain", ["shedding"]],
  ["pattern", "hair fall bahut hai", ["shedding"]],
  ["pattern", "achanak", ["shedding"]],
  ["pattern", "clumps", ["shedding"]],
  ["pattern", "6", ["shedding"]],
  ["pattern", "last", ["shedding"]],
  ["pattern", "maathe se aur upar se", ["receding", "crown"]],
  ["pattern", "option 1 aur 4", ["receding", "diffuse"]],
  ["pattern", "pata nahi", null],

  // Q5 — conditions: PCOS · Thyroid · Diabetes · Autoimmune · Anemia · None
  ["diagnosed_conditions", "pcod hai", ["pcos"]],
  ["diagnosed_conditions", "pcos", ["pcos"]],
  ["diagnosed_conditions", "ovary mein cyst", ["pcos"]],
  ["diagnosed_conditions", "1", ["pcos"]],
  ["diagnosed_conditions", "thyroid hai", ["thyroid"]],
  ["diagnosed_conditions", "hypothyroid", ["thyroid"]],
  ["diagnosed_conditions", "2", ["thyroid"]],
  ["diagnosed_conditions", "sugar hai", ["diabetes"]],
  ["diagnosed_conditions", "diabetes", ["diabetes"]],
  ["diagnosed_conditions", "diabetic hoon", ["diabetes"]],
  ["diagnosed_conditions", "3", ["diabetes"]],
  ["diagnosed_conditions", "autoimmune", ["autoimmune"]],
  ["diagnosed_conditions", "psoriasis", ["autoimmune"]],
  ["diagnosed_conditions", "4", ["autoimmune"]],
  ["diagnosed_conditions", "khoon ki kami", ["anemia"]],
  ["diagnosed_conditions", "anemia", ["anemia"]],
  ["diagnosed_conditions", "low iron", ["anemia"]],
  ["diagnosed_conditions", "5", ["anemia"]],
  ["diagnosed_conditions", "kuch nahi", ["none"]],
  ["diagnosed_conditions", "Kuchh nahi.", ["none"]], // Sarvam spelling
  ["diagnosed_conditions", "none", ["none"]],
  ["diagnosed_conditions", "koi bimari nahi", ["none"]],
  ["diagnosed_conditions", "nahi", ["none"]],
  ["diagnosed_conditions", "6", ["none"]],
  ["diagnosed_conditions", "last one", ["none"]],
  ["diagnosed_conditions", "thyroid aur sugar", ["thyroid", "diabetes"]],
  ["diagnosed_conditions", "sugar aur thyroid hai", ["thyroid", "diabetes"]], // option order, not spoken order
  ["diagnosed_conditions", "pata nahi", null],
  ["diagnosed_conditions", "bp hai", null],

  // Q6 — cycle: Not applicable · Regular · Irregular · Menopausal
  ["menstrual_cycle", "lagu nahi hota", "na"],
  ["menstrual_cycle", "not applicable", "na"],
  ["menstrual_cycle", "mere liye nahi", "na"],
  ["menstrual_cycle", "skip", "na"],
  ["menstrual_cycle", "nahi", "na"],
  ["menstrual_cycle", "option 1", "na"],
  ["menstrual_cycle", "1", "na"],
  ["menstrual_cycle", "pehla", "na"],
  ["menstrual_cycle", "regular hai", "regular"],
  ["menstrual_cycle", "time pe aate hain", "regular"],
  ["menstrual_cycle", "normal", "regular"],
  ["menstrual_cycle", "theek hai", "regular"],
  ["menstrual_cycle", "2", "regular"],
  ["menstrual_cycle", "irregular", "irregular"],
  ["menstrual_cycle", "thoda aage peeche rehta hai", "irregular"],
  ["menstrual_cycle", "kabhi kabhi miss ho jate hain", "irregular"],
  ["menstrual_cycle", "late aate hain", "irregular"],
  ["menstrual_cycle", "3", "irregular"],
  ["menstrual_cycle", "menopause ho gaya", "menopausal"],
  ["menstrual_cycle", "band ho gaye", "menopausal"],
  ["menstrual_cycle", "stopped", "menopausal"],
  ["menstrual_cycle", "4", "menopausal"],
  ["menstrual_cycle", "last", "menopausal"],
  ["menstrual_cycle", "band nahi hue abhi", null], // negated → LLM decides
  ["menstrual_cycle", "pata nahi", null],

  // Q7 — pregnancy-related: Pregnant · Postpartum · Not applicable
  ["pregnancy_related", "pregnant hoon", "pregnant"],
  ["pregnancy_related", "expecting", "pregnant"],
  ["pregnancy_related", "pet se hoon", "pregnant"],
  ["pregnancy_related", "1", "pregnant"],
  ["pregnancy_related", "delivery hui thi", "postpartum"],
  ["pregnancy_related", "baccha hua hai 6 mahine pehle", "postpartum"],
  ["pregnancy_related", "breastfeeding", "postpartum"],
  ["pregnancy_related", "abhi abhi delivery hui", "postpartum"],
  ["pregnancy_related", "2", "postpartum"],
  ["pregnancy_related", "nahi", "na"],
  ["pregnancy_related", "no", "na"],
  ["pregnancy_related", "nahi hai", "na"],
  ["pregnancy_related", "not applicable", "na"],
  ["pregnancy_related", "lagu nahi", "na"],
  ["pregnancy_related", "3", "na"],
  ["pregnancy_related", "teesra", "na"],
  ["pregnancy_related", "last", "na"],
  ["pregnancy_related", "pata nahi", null],

  // Q8 / Q9 — yes / no
  ["adult_acne_oily_skin", "haan", "yes"],
  ["adult_acne_oily_skin", "yes", "yes"],
  ["adult_acne_oily_skin", "haan hai", "yes"],
  ["adult_acne_oily_skin", "thoda hota hai", "yes"],
  ["adult_acne_oily_skin", "ji haan", "yes"],
  ["adult_acne_oily_skin", "haan, kabhi kabhi", "yes"],
  ["adult_acne_oily_skin", "kabhi kabhi hota hai", "yes"],
  ["adult_acne_oily_skin", "haan na hota hai", "yes"], // "na" as a tag particle is not a "no"
  ["adult_acne_oily_skin", "1", "yes"],
  ["adult_acne_oily_skin", "option 1", "yes"],
  ["adult_acne_oily_skin", "nahi", "no"],
  ["adult_acne_oily_skin", "no", "no"],
  ["adult_acne_oily_skin", "bilkul nahi", "no"],
  ["adult_acne_oily_skin", "nahi hota", "no"],
  ["adult_acne_oily_skin", "nahi hai", "no"],
  ["adult_acne_oily_skin", "kabhi nahi", "no"],
  ["adult_acne_oily_skin", "hair fall nahi hai", "no"],
  ["adult_acne_oily_skin", "haan, nahi hota", "no"], // the later word wins
  ["adult_acne_oily_skin", "2", "no"],
  ["adult_acne_oily_skin", "option 2", "no"],
  ["adult_acne_oily_skin", "pata nahi", null],
  ["adult_acne_oily_skin", "hair", null], // never "haan"
  ["adult_acne_oily_skin", "thoda bahut pimple aa jaate hain kabhi kabhi", null], // no yes-word → LLM (says yes)
  ["excess_body_facial_hair", "haan thoda", "yes"],
  ["excess_body_facial_hair", "nahi bilkul nahi", "no"],

  // Q10 — past 6 months: Crash diet · Stress · Fever/illness · Surgery · Location/water · None
  ["past_6_months", "dieting ki thi", ["crash-diet"]],
  ["past_6_months", "weight loss hua", ["crash-diet"]],
  ["past_6_months", "crash diet", ["crash-diet"]],
  ["past_6_months", "1", ["crash-diet"]],
  ["past_6_months", "bahut tension thi", ["stress"]],
  ["past_6_months", "stress", ["stress"]],
  ["past_6_months", "depression", ["stress"]],
  ["past_6_months", "2", ["stress"]],
  ["past_6_months", "bukhar aaya tha", ["fever"]],
  ["past_6_months", "covid hua tha", ["fever"]],
  ["past_6_months", "typhoid", ["fever"]],
  ["past_6_months", "3", ["fever"]],
  ["past_6_months", "operation hua tha", ["surgery"]],
  ["past_6_months", "surgery", ["surgery"]],
  ["past_6_months", "4", ["surgery"]],
  ["past_6_months", "shehar badla", ["location"]],
  ["past_6_months", "moved to a new city", ["location"]],
  ["past_6_months", "paani badal gaya", ["location"]],
  ["past_6_months", "shifted", ["location"]],
  ["past_6_months", "5", ["location"]],
  ["past_6_months", "kuch nahi", ["none"]],
  ["past_6_months", "Kuchh nahi.", ["none"]],
  ["past_6_months", "nothing", ["none"]],
  ["past_6_months", "none of these", ["none"]],
  ["past_6_months", "nahi", ["none"]],
  ["past_6_months", "6", ["none"]],
  ["past_6_months", "last", ["none"]],
  ["past_6_months", "covid aur stress", ["stress", "fever"]],
  ["past_6_months", "bahut tension thi aur dengue hua tha", ["stress", "fever"]],
  ["past_6_months", "uncle", null],
  ["past_6_months", "pata nahi", null],

  // Q12 — products picker: Shampoos · Oils · Topical minoxidil · Oral minoxidil · Supplements · None
  ["products.pick", "shampoo use kiya", { picked: ["shampoos"] }],
  ["products.pick", "tel lagaya", { picked: ["oils"] }],
  ["products.pick", "minoxidil lagaya", { picked: ["topical_minoxidil"] }],
  ["products.pick", "minoxidil ki goli", { picked: ["oral_minoxidil"] }],
  ["products.pick", "biotin li thi", { picked: ["supplements"] }],
  ["products.pick", "tel aur goli li thi", { picked: ["oils", "oral_minoxidil"] }],
  ["products.pick", "coconut oil aur biotin", { picked: ["oils", "supplements"] }],
  ["products.pick", "1 aur 2", { picked: ["shampoos", "oils"] }],
  ["products.pick", "option 4", { picked: ["oral_minoxidil"] }],
  ["products.pick", "kuch nahi", { picked: [] }],
  ["products.pick", "nahi", { picked: [] }],
  ["products.pick", "6", { picked: [] }],
  ["products.pick", "last", { picked: [] }],
  ["products.pick", "pata nahi", null],

  // Q13 — procedures picker: PRP · Stem cells · Transplant · Other · None
  ["procedures.pick", "prp karwaya tha", { picked: ["prp"] }],
  ["procedures.pick", "stem cell therapy", { picked: ["stem_cells"] }],
  ["procedures.pick", "transplant hua tha", { picked: ["transplant"] }],
  ["procedures.pick", "laser treatment", { picked: ["other"] }],
  ["procedures.pick", "prp aur laser", { picked: ["prp", "other"] }],
  ["procedures.pick", "2", { picked: ["stem_cells"] }],
  ["procedures.pick", "kuch nahi kiya", { picked: [] }],
  ["procedures.pick", "nahi", { picked: [] }],
  ["procedures.pick", "5", { picked: [] }],

  // Q14 — side effects / poor response, with a description
  ["past_treatment_side_effects", "nahi", { value: "no" }],
  ["past_treatment_side_effects", "no side effects", { value: "no" }],
  ["past_treatment_side_effects", "haan, oil se khujli hoti thi", { value: "yes", detail: "oil se khujli hoti thi" }],
  ["past_treatment_side_effects", "yes it caused itching", { value: "yes", detail: "it caused itching" }],
  ["past_treatment_side_effects", "1", { value: "yes", detail: "" }],
  ["past_treatment_side_effects", "2", { value: "no" }],
  ["past_treatment_side_effects", "pata nahi", null],

  // Q15 — sample: Saliva · Blood · Either
  ["sample_type", "thook", "saliva"],
  ["sample_type", "saliva", "saliva"],
  ["sample_type", "spit wala", "saliva"],
  ["sample_type", "thook wala theek hai", "saliva"],
  ["sample_type", "1", "saliva"],
  ["sample_type", "khoon", "blood"],
  ["sample_type", "blood test", "blood"],
  ["sample_type", "2", "blood"],
  ["sample_type", "koi bhi", "either"],
  ["sample_type", "dono chalega", "either"],
  ["sample_type", "either", "either"],
  ["sample_type", "jo bhi", "either"],
  ["sample_type", "3", "either"],
  ["sample_type", "last", "either"],
  ["sample_type", "pata nahi", null],

  // Q16 — consent
  ["consent", "haan", "yes"],
  ["consent", "yes I agree", "yes"],
  ["consent", "manzoor hai", "yes"],
  ["consent", "1", "yes"],
  ["consent", "nahi", "no"],
  ["consent", "no", "no"],
  ["consent", "2", "no"],
  ["consent", "pata nahi", null],
];

// The Voice-mode read-back: "Heard: Father. Say yes to confirm."
const YN: [string, "yes" | "no" | null][] = [
  ["haan", "yes"],
  ["sahi hai", "yes"],
  ["bilkul", "yes"],
  ["ji", "yes"],
  ["nahi", "no"],
  ["galat hai", "no"],
  ["bilkul nahi", "no"],
  ["wrong", "no"],
  ["papa aur bhai", null],
];

// Not an option, and the rules know it: these must never be sent to the LLM to guess.
const FINAL: [string, string][] = [
  ["family_history", "uncle ko tha"],
  ["family_history", "chacha ko"],
  ["family_history", "mere dada ji ko tha"],
  ["family_history", "pata nahi"],
  ["diagnosed_conditions", "bp hai"],
  ["diagnosed_conditions", "cholesterol"],
  ["duration", "pata nahi"],
];
// ...while a real option next to an off-option word still counts.
const MIXED: [string, string, Expected][] = [
  ["family_history", "papa aur chacha dono ko", ["father"]],
  ["diagnosed_conditions", "sugar aur bp dono", ["diabetes"]],
];

const gateOf = (id: string) => (id.startsWith("products") ? "used" : "done");
const shape = (id: string, v: AnswerValue | null): unknown => {
  if (v && typeof v === "object" && !Array.isArray(v) && !("value" in v))
    return { picked: Object.entries(v as Record<string, RowAnswer>).filter(([, r]) => r[gateOf(id)] === "yes").map(([k]) => k) };
  return v;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const failures: string[] = [];
let n = 0;
for (const [id, said, expected] of T) {
  n++;
  const got = shape(id, parseRules(step(id), said).value);
  if (!same(got, expected)) failures.push(`${id.padEnd(28)} "${said}" → ${JSON.stringify(got)}   (expected ${JSON.stringify(expected)})`);
}
for (const [id, said] of FINAL) {
  n++;
  const r = parseRules(step(id), said);
  if (r.value !== null || !r.final) failures.push(`${id.padEnd(28)} "${said}" → ${JSON.stringify(r)}   (expected a final null: no LLM call)`);
}
for (const [id, said, expected] of MIXED) {
  n++;
  const got = shape(id, parseRules(step(id), said).value);
  if (!same(got, expected)) failures.push(`${id.padEnd(28)} "${said}" → ${JSON.stringify(got)}   (expected ${JSON.stringify(expected)})`);
}
for (const [said, expected] of YN) {
  n++;
  const got = spokenYesNo(said);
  if (got !== expected) failures.push(`${"read-back".padEnd(28)} "${said}" → ${JSON.stringify(got)}   (expected ${JSON.stringify(expected)})`);
}

if (failures.length) {
  console.error(`verify-parser: ${failures.length} of ${n} failed\n` + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(`verify-parser: ${n} utterances parsed as expected — every option of every voice question, in English, Hinglish and by number.`);
