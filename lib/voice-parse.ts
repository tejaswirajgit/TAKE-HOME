// Layer 1 of the voice verdict: free, instant, offline rules. Turns a romanized
// Hinglish/English transcript into a structured answer for the current step,
// or returns null so the UI can ask the LLM layer / fall back to tapping.
// Matching is token-based (never substring) so "hair" can't read as "haan".

import { AnswerValue, Detail, Option, Question, RowAnswer, YESNO_OPTIONS } from "./intake-schema";
import { Step } from "./flow";

export interface RuleResult {
  value: AnswerValue | null;
  /** Safe to pre-select as a confident single answer (still needs a tap). */
  confident: boolean;
  /** The rules are sure there is no answer here (a relative who is not an option,
   *  "pata nahi") — do not ask the LLM to guess one. */
  final?: boolean;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a an the at of or in with to and aur hai hain ka ki ke ko se mein me bhi tha thi ho hua hui he mera meri mere my i am is are was it its for on hi hun hoon toh to".split(" ")
);

// Strong yes-words stand on their own; weak ones ("hota", "karta") are just verbs and
// lose to any negation in the sentence ("nahi hota").
const YES = ["yes", "yeah", "yep", "yup", "haan", "han", "ha", "hanji", "haanji", "ji", "bilkul", "sahi", "correct", "right", "true", "sure", "agree", "okay", "ok", "manzoor", "manjoor"];
const YES_WEAK = ["karta", "karti", "hota", "hoti", "hun", "hoon", "kiya", "kiye"];
// Not "na" (a tag particle: "hota hai na" = it does, right?) and not "kabhi"
// ("kabhi kabhi" = sometimes) — both would flip a clear yes into a no.
const NO = ["no", "nope", "nah", "nahi", "nahin", "nai", "nhi", "never", "not", "kabhi nahi", "bilkul nahi", "nil", "galat", "wrong"];
// "Don't know" is not a "no": nothing to pre-select, the chips are right there.
const DUNNO = ["pata nahi", "pata nai", "nahi pata", "malum nahi", "maloom nahi", "yaad nahi", "samajh nahi", "dont know", "don t know", "not sure", "no idea", "unsure"];
// Things patients name that are NOT options on that question. "chacha" is not a
// sibling; "bp" is not on the list — the LLM was happy to guess, so the rules
// settle it first: no hit, no guess, the options get read back.
const OFF: Record<string, string[]> = {
  family_history: ["uncle", "aunt", "aunty", "chacha", "chachi", "tau", "tai", "mama", "mami", "mausi", "bua", "phupha", "cousin", "dada", "dadi", "nana", "nani", "grandfather", "grandmother", "grandpa", "grandma", "nephew", "niece", "bhatija", "bhanja", "husband", "wife", "pati", "patni", "beta", "beti", "son", "daughter"],
  diagnosed_conditions: ["bp", "blood pressure", "hypertension", "cholesterol", "asthma", "migraine", "arthritis", "gastric", "acidity", "kidney", "liver", "heart", "cancer", "tb", "hepatitis"],
};

/** Spoken synonyms per option value (label words are matched automatically). */
const SYN: Record<string, string[]> = {
  "under-6m": ["few months", "kuch mahine", "couple of months", "recently", "abhi abhi", "teen mahine", "do mahine", "char mahine", "paanch mahine", "less than six", "6 se kam", "chhe se kam", "kuch hafte", "weeks", "mahine se kam", "6 mahine se kam", "chhe mahine se kam", "six months se kam", "under six", "one month", "two months", "three months", "four months", "five months", "ek mahina", "ek mahine", "month", "mahina"],
  "6-12m": ["six months", "chhe mahine", "6 mahine", "aath mahine", "das mahine", "half year", "six to twelve", "saal se kam", "almost a year", "ek saal hone wala", "8 mahine", "9 mahine", "10 mahine", "11 mahine", "7 mahine", "saat mahine", "sat mahine", "nau mahine", "gyarah mahine", "seven months", "eight months", "nine months", "ten months", "eleven months", "7 months", "8 months", "9 months", "10 months", "11 months"],
  "over-1y": ["year", "years", "saal", "saalon", "sal", "long time", "kaafi time", "bahut time", "barso", "over a year", "more than a year", "ek saal se zyada", "do saal", "teen saal", "kai saal"],
  father: ["father", "dad", "papa", "pitaji", "pita", "daddy", "abbu", "baba"],
  mother: ["mother", "mom", "mum", "mummy", "maa", "ma", "amma", "ammi", "mata", "mataji"],
  siblings: ["sibling", "siblings", "brother", "sister", "brothers", "sisters", "bhai", "behen", "bahan", "bhaiya", "didi", "bhai behen"],
  none: ["none", "no one", "nobody", "koi nahi", "kisi ko nahi", "kuch nahi", "kisi ko bhi nahi", "nahi hai", "not really", "nothing", "kuch bhi nahi", "koi bhi nahi", "koi bimari nahi", "koi problem nahi", "aisa kuch nahi", "nothing like that"],
  receding: ["receding", "hairline", "forehead", "maatha", "maathe", "matha", "mathe", "aage se", "front", "samne se", "temples"],
  crown: ["crown", "top", "vertex", "upar se", "upar", "choti", "sir ke upar", "peeche se", "back of head"],
  part: ["parting", "partline", "maang", "mang", "middle", "beech se", "bich se", "part line"],
  diffuse: ["diffuse", "all over", "everywhere", "overall", "sab jagah", "poore sir", "pure sir", "har jagah", "thin all over", "patle", "pura"],
  patchy: ["patch", "patches", "patchy", "spots", "gol", "circle", "circles", "ek jagah", "chakatte", "bald spot"],
  // Only the *excessive / sudden* phrasings — "jhad rahe" alone is just "falling", said for every pattern.
  shedding: ["shedding", "hair fall", "bahut jhad", "zyada jhad", "bahut zyada", "achanak", "sudden", "suddenly", "clumps", "guchhe", "muthi", "excessive", "tut rahe", "bahut gir"],
  pcos: ["pcos", "pcod", "polycystic", "cyst", "cysts", "ovary"],
  thyroid: ["thyroid", "hypothyroid", "hyperthyroid"],
  diabetes: ["diabetes", "diabetic", "sugar", "cheeni", "shugar", "madhumeh"],
  autoimmune: ["autoimmune", "auto immune", "alopecia areata", "lupus", "vitiligo", "psoriasis"],
  anemia: ["anemia", "anaemia", "anemic", "khoon ki kami", "haemoglobin", "hemoglobin", "iron ki kami", "iron deficiency", "low iron", "khoon kam"],
  na: ["not applicable", "doesnt apply", "does not apply", "lagu nahi", "lagu nahi hota", "applicable nahi", "na", "skip", "mere liye nahi", "nahi hota", "nahi hai"],
  regular: ["regular", "normal", "time pe", "time par", "samay par", "theek", "thik", "on time", "sahi"],
  irregular: ["irregular", "not regular", "aage peeche", "late", "delayed", "miss", "missed", "kabhi kabhi", "aniyamit", "gadbad", "problem", "upar neeche"],
  menopausal: ["menopause", "menopausal", "band ho gaye", "band", "ruk gaye", "stopped", "bandh", "khatam"],
  pregnant: ["pregnant", "pregnancy", "expecting", "garbhvati", "garbhavati", "pet se", "umeed se"],
  postpartum: ["postpartum", "delivery", "delivered", "after delivery", "gave birth", "baby hua", "baccha hua", "bachha hua", "born", "janm", "nursing", "breastfeeding", "doodh pilati"],
  "crash-diet": ["diet", "dieting", "crash diet", "weight loss", "wazan", "vajan", "weight kam", "patla", "dubla", "fasting", "weight"],
  stress: ["stress", "tension", "tanav", "tanaav", "anxiety", "depression", "trauma", "sadma", "pareshan", "chinta", "emotional", "pareshani"],
  fever: ["fever", "bukhar", "bukhaar", "covid", "corona", "dengue", "typhoid", "malaria", "viral", "illness", "bimari", "bimaar", "beemar", "bimar"],
  surgery: ["surgery", "operation", "surgical", "operate", "oparation", "cesarean", "c section"],
  location: ["location", "shift", "shifted", "moved", "move", "city", "shehar", "sheher", "paani", "pani", "water", "hawa", "air", "pollution", "badla", "badal", "new place", "nayi jagah", "transfer"],
  "under-5": ["under 5", "less than 5", "less than five", "ek do", "do teen", "one or two", "two or three", "couple", "kam", "kabhi kabhi", "1", "2", "3", "4"],
  "5-10": ["5 to 10", "five to ten", "paanch das", "aadha packet", "half pack", "5", "6", "7", "8", "9", "10", "das", "paanch", "chhe", "saat", "aath", "nau"],
  "over-10": ["more than 10", "over 10", "das se zyada", "ek packet", "one pack", "pack", "packet", "15", "20", "bees", "pandrah", "lot", "bahut"],
  daily: ["daily", "every day", "everyday", "roz", "roj", "rozana", "har din", "har roz"],
  alternate: ["alternate", "every other day", "ek din chhod", "ek din chod", "chhod ke", "chod kar", "alternate din", "two days", "do din"],
  weekly: ["weekly", "once a week", "hafte", "hafta", "week", "saptah", "sunday", "ek baar"],
  shampoos: ["shampoo", "shampoos", "ketoconazole", "anti dandruff", "dandruff", "medicated"],
  oils: ["oil", "oils", "tel", "serum", "serums", "coconut", "nariyal", "onion", "pyaaz", "rosemary", "amla", "bhringraj"],
  topical_minoxidil: ["minoxidil", "topical", "foam", "solution", "liquid", "spray", "lotion", "rogaine", "tugain", "mintop", "morr"],
  oral_minoxidil: ["oral", "tablet", "goli", "tablets", "dawai", "dawa", "medicine", "khaane wala", "khane wala", "pill", "capsule", "finasteride", "khata", "khati"],
  supplements: ["supplement", "supplements", "biotin", "vitamin", "vitamins", "multivitamin", "zinc", "iron tablet", "protein", "gummies"],
  prp: ["prp", "gfc", "iprf", "plasma", "injection", "injections", "platelet"],
  stem_cells: ["stem", "stem cell", "stem cells", "exosome", "exosomes"],
  transplant: ["transplant", "hair transplant", "implant", "graft", "grafts", "fue", "fut"],
  other: ["other", "kuch aur", "something else", "laser", "microneedling", "derma roller", "mesotherapy", "meso", "qr678", "peptide"],
  saliva: ["saliva", "spit", "thook", "thuk", "laar", "lar", "swab", "mouth", "muh"],
  blood: ["blood", "khoon", "khun", "rakt", "needle"],
  either: ["either", "any", "koi bhi", "both", "dono", "kuch bhi", "whichever", "jo bhi", "chalega", "koi bhi chalega"],
};

const NUM_WORDS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  das: 10, gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19,
  bees: 20, ikkis: 21, bais: 22, teis: 23, chaubis: 24, pachees: 25, pachchis: 25, pachis: 25, chhabbis: 26, sattais: 27, atthais: 28, untis: 29,
  tees: 30, ikattis: 31, battis: 32, taintis: 33, chauntis: 34, paintis: 35, paintees: 35, chhattis: 36, saintis: 37, adtis: 38, untalis: 39,
  chalis: 40, chalees: 40, iktalis: 41, bayalis: 42, taintalis: 43, chauvalis: 44, paintalis: 45, chhiyalis: 46, saintalis: 47, adtalis: 48, unchas: 49,
  pachas: 50, pachaas: 50, ikyavan: 51, bavan: 52, tirpan: 53, chauvan: 54, pachpan: 55, chhappan: 56, sattavan: 57, atthavan: 58, unsath: 59,
  sattar: 70, assi: 80, nabbe: 90, // "saath" (60) is also "with" — left out on purpose
};
const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9,
};

export function parseNumber(text: string): number | null {
  const digits = text.match(/\b(\d{1,2})\b/);
  if (digits) return parseInt(digits[1], 10);
  const toks = text.split(" ");
  for (let i = 0; i < toks.length; i++) {
    const base = NUM_WORDS[toks[i]];
    if (base == null) continue;
    // "twenty five" — English tens take a following ones word.
    const next = toks[i + 1];
    if (base % 10 === 0 && base >= 20 && next && ONES[next] != null && /^[a-z]+$/.test(toks[i])) return base + ONES[next];
    return base;
  }
  return null;
}

const has = (text: string, toks: Set<string>, w: string) => (w.includes(" ") ? ` ${text} `.includes(` ${w} `) : toks.has(w));

/** Words that identify one option: its own label words (unique among the set) + synonyms. */
function wordsFor(opts: Option[]): Map<string, string[]> {
  const labelWords = opts.map((o) => normalize(o.label).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
  const counts = new Map<string, number>();
  for (const ws of labelWords) for (const w of new Set(ws)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const m = new Map<string, string[]>();
  opts.forEach((o, i) => m.set(o.value, [...labelWords[i].filter((w) => counts.get(w) === 1), ...(SYN[o.value] ?? [])]));
  return m;
}

function hits(opts: Option[], text: string, toks: Set<string>): string[] {
  const words = wordsFor(opts);
  let out = opts.filter((o) => (words.get(o.value) ?? []).some((w) => has(text, toks, w))).map((o) => o.value);
  // "oral minoxidil" mentions minoxidil too — only the oral row was meant.
  if (out.includes("oral_minoxidil") && out.includes("topical_minoxidil") && !["topical", "lagane wala", "lagaya", "lagata", "lagati", "foam", "solution", "liquid", "spray", "lotion"].some((w) => has(text, toks, w)))
    out = out.filter((v) => v !== "topical_minoxidil");
  return out;
}

function yesNo(text: string, toks: Set<string>): "yes" | "no" | null {
  // "bilkul nahi" must not read its "bilkul" as a yes: drop the no-phrases first.
  let t = ` ${text} `;
  for (const p of NO.filter((w) => w.includes(" "))) t = t.split(` ${p} `).join(" ");
  t = t.trim();
  const tk = new Set(t.split(" "));
  const n = NO.some((w) => has(text, toks, w));
  const strong = YES.some((w) => has(t, tk, w));
  const weak = YES_WEAK.some((w) => has(t, tk, w));
  if (!n) return strong || weak ? "yes" : null;
  if (!strong) return "no"; // "nahi hota", "hair fall nahi hai"
  // "haan, nahi hota" — the later of a strong yes and a negation wins.
  const yi = Math.min(...YES.filter((w) => has(t, tk, w)).map((w) => t.indexOf(w)));
  const ni = Math.min(...NO.filter((w) => has(text, toks, w)).map((w) => text.indexOf(w)));
  return ni > yi ? "no" : null;
}

/** Nothing but a "no" ("nahi", "no", "nahi hai", "bilkul nahi"). */
const bareNo = (text: string, toks: Set<string>) =>
  yesNo(text, toks) === "no" && text.split(" ").every((w) => NO.includes(w) || STOP.has(w) || ["kabhi", "bilkul", "ji", "abhi", "sir", "madam"].includes(w));

// ── "Option 2" ─────────────────────────────────────────────────────────────
// Read-aloud numbers every option; a patient may answer with the number, an
// ordinal ("teesra", "third"), or "last". Only two shapes count, so "do saal"
// (two years) can never become "option 2": the whole utterance is indexes
// ("2", "1 aur 3", "pehla aur teesra", "last one"), or an index sits next to a
// key word ("option 2", "number teen", "teesra wala").
const ORD: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  pehla: 1, pehli: 1, pahla: 1, pahli: 1, doosra: 2, dusra: 2, doosri: 2, dusri: 2, teesra: 3, tisra: 3, teesri: 3, tisri: 3,
  chautha: 4, chauthi: 4, chotha: 4, paanchva: 5, panchva: 5, paanchvi: 5, panchvi: 5, paanchwa: 5, panchwa: 5, paanchvaan: 5, panchvan: 5,
  chhata: 6, chhatha: 6, chatha: 6, chhathaa: 6,
};
const IDX_KEY = new Set(["option", "options", "choice", "number", "nambar", "numbar", "vikalp", "wala", "wali", "waala", "vala"]);
const LAST = new Set(["last", "aakhri", "akhri", "antim"]);
const JOIN = new Set(["aur", "and", "or", "ya", "the", "ka", "ki", "ke", "one", "wala", "wali", "please", "select", "choose"]);

export function indexPicks(text: string, count: number): number[] {
  const toks = text.split(" ");
  const idx = (w: string, before?: string): number | null => {
    if (LAST.has(w)) return count;
    if (ORD[w]) return ORD[w];
    if (/^[1-9]$/.test(w)) return +w;
    if (w === "one" && before && (ORD[before] || LAST.has(before))) return null; // "third one"
    if (ONES[w]) return ONES[w];
    return null;
  };
  const clean = toks.every((t, i) => JOIN.has(t) || IDX_KEY.has(t) || idx(t, toks[i - 1]) != null);
  const keyed = toks.some((t) => IDX_KEY.has(t));
  const out: number[] = [];
  toks.forEach((t, i) => {
    const n = idx(t, toks[i - 1]);
    if (n == null) return;
    const nearKey = IDX_KEY.has(toks[i - 1] ?? "") || IDX_KEY.has(toks[i + 1] ?? "");
    if (clean || (keyed && (nearKey || ORD[t] || LAST.has(t)))) out.push(n);
  });
  return [...new Set(out)].filter((n) => n >= 1 && n <= count);
}

/** The options in the order they are shown and read out (pickers end with "None of these"). */
export function visibleOptions(step: Step): Option[] {
  switch (step.kind) {
    case "single":
    case "multi":
      return step.q.options!;
    case "yesno":
    case "yesno-text":
      return YESNO_OPTIONS;
    case "picker":
      return [...step.q.rows!.map((r) => ({ value: r.id, label: r.label })), { value: "__none", label: "None of these" }];
    default:
      return [];
  }
}

const inOptionOrder = (q: Question, vals: string[]) => q.options!.map((o) => o.value).filter((v) => vals.includes(v));

/** Build a picker answer (all gates) from the row ids the patient named. */
export function pickerValue(q: Question, ids: string[], prev?: Record<string, RowAnswer>): Record<string, RowAnswer> {
  const gate = q.gate!.id;
  const next: Record<string, RowAnswer> = {};
  for (const r of q.rows!) next[r.id] = ids.includes(r.id) ? { ...(prev?.[r.id] ?? {}), [gate]: "yes" } : { [gate]: "no" };
  return next;
}

export function parseRules(step: Step, raw: string, prev?: AnswerValue): RuleResult {
  const text = normalize(raw);
  const none: RuleResult = { value: null, confident: false };
  if (!text) return none;
  const toks = new Set(text.split(" "));
  const q = step.q;

  const negated = NO.some((w) => has(text, toks, w));
  const final: RuleResult = { value: null, confident: false, final: true };
  if (DUNNO.some((w) => has(text, toks, w))) return final;
  const offOption = (OFF[q.id] ?? []).some((w) => has(text, toks, w));

  // "option 2", "teesra", "1 aur 3", "last" — the number the option was read out with.
  const opts = visibleOptions(step);
  const picks = opts.length ? indexPicks(text, opts.length) : [];
  if (picks.length) {
    const vals = picks.map((i) => opts[i - 1].value);
    switch (step.kind) {
      case "single":
      case "yesno":
        return vals.length === 1 ? { value: vals[0], confident: true } : none;
      case "yesno-text":
        if (vals.length !== 1) return none;
        return vals[0] === "no" ? { value: { value: "no" } as Detail, confident: true } : { value: { value: "yes", detail: "" } as Detail, confident: false };
      case "multi": {
        const ex = vals.find((v) => q.options!.find((o) => o.value === v)?.exclusive);
        const prevArr = Array.isArray(prev) ? (prev as string[]).filter((v) => !q.options!.find((o) => o.value === v)?.exclusive) : [];
        return { value: ex ? [ex] : inOptionOrder(q, [...prevArr, ...vals]), confident: false };
      }
      case "picker": {
        const prevRows = prev as Record<string, RowAnswer> | undefined;
        if (vals.includes("__none")) return { value: pickerValue(q, []), confident: false };
        const already = q.rows!.filter((r) => prevRows?.[r.id]?.[q.gate!.id] === "yes").map((r) => r.id);
        return { value: pickerValue(q, [...new Set([...already, ...vals])], prevRows), confident: false };
      }
    }
  }

  switch (step.kind) {
    case "number": {
      const n = parseNumber(text);
      const r = q.number!;
      return n == null || n < r.min || n > r.max ? none : { value: n, confident: true };
    }
    case "yesno": {
      const v = yesNo(text, toks);
      return v ? { value: v, confident: true } : none;
    }
    case "single": {
      let h = hits(q.options!, text, toks);
      // "6 mahine se kam" hits both duration chips — "kam"/"less" settles it.
      if (h.includes("under-6m") && h.includes("6-12m") && ["kam", "less", "under"].some((w) => toks.has(w))) h = ["under-6m"];
      // "almost a year" / "saal hone wala hai" hits the year chip too — "almost" settles it.
      if (h.includes("6-12m") && h.includes("over-1y") && ["almost", "nearly", "kam", "less", "under", "hone", "wala"].some((w) => toks.has(w))) h = ["6-12m"];
      // A bare "nahi" to a question that offers "Not applicable" means exactly that.
      if (!h.length && bareNo(text, toks) && q.options!.some((o) => o.value === "na")) return { value: "na", confident: true };
      if (!h.length && offOption) return final;
      if (h.length !== 1) return none;
      // "band nahi hue" (haven't stopped) must not read as Menopausal: a negated
      // single answer goes to the LLM — unless the option itself is "Not applicable".
      if (negated && h[0] !== "na") return none;
      return { value: h[0], confident: true };
    }
    case "multi": {
      const h = hits(q.options!, text, toks);
      const ex = h.find((v) => q.options!.find((o) => o.value === v)?.exclusive);
      // Speaking adds to what was already tapped ("mother bhi").
      const prevArr = Array.isArray(prev) ? (prev as string[]).filter((v) => !q.options!.find((o) => o.value === v)?.exclusive) : [];
      const value = ex ? [ex] : [...new Set([...prevArr, ...h])];
      if (h.length) return { value, confident: false };
      // A bare "nahi" to "anyone / any of these?" is the exclusive "none" chip.
      const noneOpt = q.options!.find((o) => o.exclusive);
      if (noneOpt && bareNo(text, toks)) return { value: [noneOpt.value], confident: false };
      return offOption ? final : none;
    }
    case "picker": {
      const rowOpts: Option[] = q.rows!.map((r) => ({ value: r.id, label: r.label }));
      const noneHit = SYN.none.some((w) => has(text, toks, w)) || yesNo(text, toks) === "no";
      const h = hits(rowOpts, text, toks);
      const prevRows = prev as Record<string, RowAnswer> | undefined;
      const already = q.rows!.filter((r) => prevRows?.[r.id]?.[q.gate!.id] === "yes").map((r) => r.id);
      if (h.length) return { value: pickerValue(q, [...new Set([...already, ...h])], prevRows), confident: false };
      if (noneHit) return { value: pickerValue(q, []), confident: false };
      return none;
    }
    case "yesno-text": {
      const v = yesNo(text, toks);
      if (v === "no") return { value: { value: "no" } as Detail, confident: true };
      if (v === "yes") {
        // Keep whatever followed the "yes" as the description.
        const detail = raw.replace(/^\s*(yes|yeah|haan|han|ha|ji|hanji)[,.\s]*/i, "").trim();
        return { value: { value: "yes", detail } as Detail, confident: false };
      }
      return none;
    }
    default:
      return none;
  }
}

export const YESNO_LABELS = YESNO_OPTIONS;

/** "haan" / "nahi" said to a Voice-mode read-back ("Heard: Father. Say yes to confirm"). */
export function spokenYesNo(raw: string): "yes" | "no" | null {
  const text = normalize(raw);
  return yesNo(text, new Set(text.split(/\s+/)));
}
