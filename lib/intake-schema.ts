// The 16-question hair & scalp intake, verbatim from the clinic's form. This
// file is the single source of truth: the patient flow, the review screen, the
// read-aloud text and the exported JSON all render from it. Question ids ARE the
// official schema keys (lib/intake-schema.json); `out` on an option is the exact
// string the clinic's schema expects when it differs from the patient-facing label.

import type { IconName } from "@/components/icons";

export type Section = "A" | "B" | "C" | "D" | "E";
export type Lang = "en" | "hi";

export const SECTIONS: Record<Section, { title: string; hi: string; icon: IconName }> = {
  A: { title: "Your hair loss story", hi: "आपके बालों की कहानी", icon: "hair" },
  B: { title: "Health & hormones", hi: "सेहत और हार्मोन", icon: "heart" },
  C: { title: "Life & habits", hi: "जीवनशैली और आदतें", icon: "leaf" },
  D: { title: "What you've tried", hi: "अब तक क्या आज़माया", icon: "flask" },
  E: { title: "Sample & consent", hi: "सैंपल और सहमति", icon: "check" },
};

export interface Option {
  value: string;
  label: string;
  hi?: string;
  /** Exact string in the clinic schema, when the patient label differs. */
  out?: string;
  /** Choosing this clears every other option ("none of these"). */
  exclusive?: boolean;
  /** Exists only to let the patient finish the screen; exported as nothing. */
  uiOnly?: boolean;
}

export interface Field {
  id: string;
  kind: "single" | "yesno" | "text";
  label: string;
  hi?: string;
  options?: Option[];
}

export interface HabitRow {
  id: string;
  kind: "yesno" | "single";
  label: string;
  hi?: string;
  hint?: string;
  hiHint?: string;
  options?: Option[];
  /** Asked only when the row is answered "yes". */
  followup?: Field;
}

export interface TableRow {
  id: string;
  /** The row's name in the clinic schema. */
  out: string;
  label: string;
  hi?: string;
}

export type QuestionKind = "number" | "single" | "multi" | "yesno" | "habits" | "table" | "yesno-text";

export interface Question {
  n: number;
  id: string;
  section: Section;
  kind: QuestionKind;
  prompt: string;
  hint?: string;
  /** Longer plain-language body (consent). */
  body?: string;
  hi?: { prompt: string; hint?: string; body?: string };
  options?: Option[];
  number?: { min: number; max: number };
  habits?: HabitRow[];
  /** table: one row per product/procedure … */
  rows?: TableRow[];
  /** … each first asked the gate (used? / done?) … */
  gate?: Field;
  /** … and, when the gate is "yes", these columns. */
  columns?: Field[];
  /** yes/no & single-selects advance on tap unless this is false. */
  autoAdvance?: boolean;
  /** Show the mic in normal (sighted) mode. Read-aloud mode shows it everywhere. */
  mic?: boolean;
}

export type YesNo = "yes" | "no";
export type Detail = { value: string; detail?: string };
/** gate + column values for one table row, e.g. { used: "yes", duration: "3-6mo", helped: "no" } */
export type RowAnswer = Record<string, string>;
export type AnswerValue =
  | number
  | string
  | string[]
  | Detail
  | Record<string, Detail>
  | Record<string, RowAnswer>;
export type Answers = Record<string, AnswerValue>;

const yesno = (id: string, label: string, hi?: string): Field => ({ id, kind: "yesno", label, hi });

export const QUESTIONS: Question[] = [
  // ── A · Personal and family hair loss history ─────────────────────────
  {
    n: 1,
    id: "age_hair_loss_began",
    section: "A",
    kind: "number",
    prompt: "Around what age did the hair loss begin?",
    hint: "A rough number is fine — andaaza chalega.",
    hi: { prompt: "किस उम्र में बाल झड़ना शुरू हुआ?", hint: "अंदाज़ा चलेगा — सही-सही याद न हो तो भी ठीक है।" },
    number: { min: 1, max: 90 },
    mic: true,
  },
  {
    n: 2,
    id: "duration",
    section: "A",
    kind: "single",
    prompt: "How long has it been going on?",
    hi: { prompt: "कब से हो रहा है?" },
    options: [
      { value: "under-6m", label: "Under 6 months", hi: "6 महीने से कम", out: "Less than 6 months" },
      { value: "6-12m", label: "6 to 12 months", hi: "6 से 12 महीने", out: "6-12 months" },
      { value: "over-1y", label: "Over a year", hi: "एक साल से ज़्यादा" },
    ],
  },
  {
    n: 3,
    id: "family_history",
    section: "A",
    kind: "multi",
    prompt: "Anyone in your family with thinning or baldness?",
    hint: "Pick everyone that applies.",
    hi: { prompt: "परिवार में किसी के बाल पतले या गंजापन?", hint: "जो-जो लागू हों सब चुनें।" },
    options: [
      { value: "father", label: "Father", hi: "पिता", out: "Father had hair loss" },
      { value: "mother", label: "Mother", hi: "माता", out: "Mother had hair loss" },
      { value: "siblings", label: "Siblings with thinning or baldness", hi: "भाई-बहन" },
      { value: "none", label: "No known family history", hi: "परिवार में किसी को नहीं", exclusive: true },
    ],
    mic: true,
  },
  {
    n: 4,
    id: "pattern",
    section: "A",
    kind: "multi",
    prompt: "What does the hair loss look like?",
    hint: "Pick everything that matches.",
    hi: { prompt: "बाल किस तरह झड़ रहे हैं?", hint: "जो-जो मिलता-जुलता हो सब चुनें।" },
    options: [
      { value: "receding", label: "Receding hairline", hi: "माथे से पीछे हटती हेयरलाइन" },
      { value: "crown", label: "Thinning at crown", hi: "सिर के ऊपर पतले बाल" },
      { value: "part", label: "Widening part line", hi: "माँग चौड़ी हो रही है" },
      { value: "diffuse", label: "Diffuse thinning", hi: "पूरे सिर में पतलापन" },
      { value: "patchy", label: "Patchy loss", hi: "जगह-जगह गोल पैच" },
      { value: "shedding", label: "Sudden excessive shedding", hi: "अचानक बहुत ज़्यादा झड़ना" },
    ],
    mic: true,
  },

  // ── B · Hormonal and health influences ────────────────────────────────
  {
    n: 5,
    id: "diagnosed_conditions",
    section: "B",
    kind: "multi",
    prompt: "Has a doctor diagnosed any of these?",
    hint: "Only what a doctor has told you — or tap None.",
    hi: { prompt: "क्या डॉक्टर ने इनमें से कुछ बताया है?", hint: "सिर्फ़ वही जो डॉक्टर ने बताया हो — या 'कोई नहीं' चुनें।" },
    options: [
      { value: "pcos", label: "PCOS / PCOD", hi: "PCOS / PCOD", out: "PCOS/PCOD" },
      { value: "thyroid", label: "Thyroid disorder", hi: "थायरॉइड" },
      { value: "diabetes", label: "Diabetes", hi: "डायबिटीज़ (शुगर)" },
      { value: "autoimmune", label: "Autoimmune disease", hi: "ऑटोइम्यून बीमारी" },
      { value: "anemia", label: "Anemia", hi: "खून की कमी (एनीमिया)" },
      { value: "none", label: "None of these", hi: "इनमें से कोई नहीं", out: "None", exclusive: true },
    ],
    mic: true,
  },
  {
    n: 6,
    id: "menstrual_cycle",
    section: "B",
    kind: "single",
    prompt: "Menstrual cycle — how is it these days?",
    hint: "If this doesn't apply to you, just tap Not applicable.",
    hi: { prompt: "मासिक धर्म — आजकल कैसा है?", hint: "अगर आप पर लागू नहीं होता, बस 'लागू नहीं' चुनें।" },
    options: [
      { value: "na", label: "Not applicable", hi: "लागू नहीं" },
      { value: "regular", label: "Regular", hi: "नियमित" },
      { value: "irregular", label: "Irregular", hi: "अनियमित" },
      { value: "menopausal", label: "Menopausal", hi: "रजोनिवृत्ति (मेनोपॉज़)" },
    ],
  },
  {
    n: 7,
    id: "pregnancy_related",
    section: "B",
    kind: "single",
    prompt: "Is the hair loss pregnancy-related?",
    hi: { prompt: "क्या बालों का झड़ना गर्भावस्था से जुड़ा है?" },
    options: [
      { value: "pregnant", label: "Currently pregnant", hi: "अभी गर्भवती हूँ" },
      { value: "postpartum", label: "Postpartum, under 1 year", hi: "डिलीवरी को एक साल से कम", out: "Postpartum <1 year" },
      { value: "na", label: "Not applicable", hi: "लागू नहीं" },
    ],
  },
  {
    n: 8,
    id: "adult_acne_oily_skin",
    section: "B",
    kind: "yesno",
    prompt: "Acne or oily skin as an adult?",
    hi: { prompt: "बड़े होने के बाद भी मुँहासे या तैलीय त्वचा?" },
  },
  {
    n: 9,
    id: "excess_body_facial_hair",
    section: "B",
    kind: "yesno",
    prompt: "Excess body or facial hair growth?",
    hint: "More than usual — for example on the chin, upper lip or jaw.",
    hi: { prompt: "शरीर या चेहरे पर ज़रूरत से ज़्यादा बाल?", hint: "सामान्य से ज़्यादा — जैसे ठोड़ी, ऊपरी होंठ या जबड़े पर।" },
  },

  // ── C · Lifestyle and environmental triggers ──────────────────────────
  {
    n: 10,
    id: "past_6_months",
    section: "C",
    kind: "multi",
    prompt: "In the past 6 months, did any of these happen?",
    hint: "Big changes often show up in hair a few months later.",
    hi: { prompt: "पिछले 6 महीनों में इनमें से कुछ हुआ?", hint: "बड़े बदलाव अक्सर कुछ महीने बाद बालों में दिखते हैं।" },
    options: [
      { value: "crash-diet", label: "Crash dieting or major weight loss", hi: "क्रैश डाइट या तेज़ी से वज़न कम" },
      { value: "stress", label: "High stress or emotional trauma", hi: "बहुत तनाव या सदमा" },
      { value: "fever", label: "Fever with illness (COVID, dengue, typhoid)", hi: "बुख़ार वाली बीमारी (कोविड, डेंगू, टाइफ़ॉइड)", out: "Fever with illness (COVID, Dengue, Typhoid)" },
      { value: "surgery", label: "Recent surgery", hi: "हाल में ऑपरेशन" },
      { value: "location", label: "Change in location, water or air quality", hi: "जगह, पानी या हवा में बदलाव", out: "Change in location/water/air quality" },
      { value: "none", label: "None of these", hi: "इनमें से कुछ नहीं", exclusive: true, uiOnly: true },
    ],
    mic: true,
  },
  {
    n: 11,
    id: "habits",
    section: "C",
    kind: "habits",
    prompt: "A few everyday habits.",
    hint: "One quick answer per line.",
    hi: { prompt: "रोज़मर्रा की कुछ आदतें।", hint: "हर लाइन का एक छोटा जवाब।" },
    habits: [
      {
        id: "smoking",
        kind: "yesno",
        label: "Do you smoke?",
        hi: "क्या आप धूम्रपान करते हैं?",
        followup: {
          id: "smoking_severity",
          kind: "single",
          label: "Roughly how many a day?",
          hi: "दिन में लगभग कितनी?",
          options: [
            { value: "under-5", label: "Under 5", hi: "5 से कम", out: "Mild <5/day" },
            { value: "5-10", label: "5 to 10", hi: "5 से 10", out: "Moderate 5-10/day" },
            { value: "over-10", label: "Over 10", hi: "10 से ज़्यादा", out: "Severe >10/day" },
          ],
        },
      },
      { id: "alcohol", kind: "yesno", label: "Alcohol?", hi: "शराब?" },
      {
        id: "hard_water",
        kind: "yesno",
        label: "Hard water for hair wash?",
        hi: "बाल धोने का पानी खारा (हार्ड) है?",
        hint: "Borewell or tanker water that leaves white marks counts.",
        hiHint: "बोरवेल या टैंकर का पानी जो सफ़ेद निशान छोड़े — वह भी गिनें।",
      },
      {
        id: "hair_wash_frequency",
        kind: "single",
        label: "How often do you wash your hair?",
        hi: "बाल कितनी बार धोते हैं?",
        options: [
          { value: "daily", label: "Daily", hi: "रोज़" },
          { value: "alternate", label: "Alternate days", hi: "एक दिन छोड़कर", out: "Alternate Days" },
          { value: "weekly", label: "Weekly", hi: "हफ़्ते में एक बार" },
        ],
      },
      {
        id: "heating_tools_styling_chemicals",
        kind: "yesno",
        label: "Heating tools or styling chemicals?",
        hi: "स्ट्रेटनर, ड्रायर या स्टाइलिंग केमिकल?",
      },
      {
        id: "salon_treatments",
        kind: "yesno",
        label: "Salon treatments like keratin, rebonding, smoothening?",
        hi: "सैलून ट्रीटमेंट — केराटिन, रीबॉन्डिंग, स्मूदनिंग?",
        followup: { id: "salon_treatment_detail", kind: "text", label: "Which one?", hi: "कौन सा?" },
      },
    ],
  },

  // ── D · Current hair care and treatments ──────────────────────────────
  {
    n: 12,
    id: "products",
    section: "D",
    kind: "table",
    prompt: "Which of these have you used for your hair?",
    hint: "Tap everything you've tried — or None.",
    hi: { prompt: "बालों के लिए इनमें से क्या इस्तेमाल किया है?", hint: "जो-जो आज़माया हो चुनें — या 'कुछ नहीं'।" },
    rows: [
      { id: "shampoos", out: "OTC/Medicated Shampoos", label: "Medicated shampoos", hi: "मेडिकेटेड शैम्पू" },
      { id: "oils", out: "Hair Oils/Serums", label: "Hair oils or serums", hi: "तेल या सीरम" },
      { id: "topical_minoxidil", out: "Topical Minoxidil", label: "Topical minoxidil", hi: "लगाने वाला मिनॉक्सिडिल" },
      { id: "oral_minoxidil", out: "Oral Minoxidil", label: "Oral minoxidil", hi: "खाने वाला मिनॉक्सिडिल" },
      { id: "supplements", out: "Supplements", label: "Supplements", hi: "सप्लीमेंट्स" },
    ],
    gate: yesno("used", "Used", "इस्तेमाल किया"),
    columns: [
      {
        id: "duration",
        kind: "single",
        label: "For how long?",
        hi: "कितने समय तक?",
        options: [
          { value: "<3mo", label: "Under 3 months", hi: "3 महीने से कम", out: "<3mo" },
          { value: "3-6mo", label: "3 to 6 months", hi: "3 से 6 महीने", out: "3-6mo" },
          { value: ">6mo", label: "Over 6 months", hi: "6 महीने से ज़्यादा", out: ">6mo" },
        ],
      },
      yesno("helped", "Did it help?", "फ़ायदा हुआ?"),
      yesno("side_effects", "Any side effects?", "कोई साइड इफ़ेक्ट?"),
    ],
    mic: true,
  },
  {
    n: 13,
    id: "procedures",
    section: "D",
    kind: "table",
    prompt: "Any in-clinic procedures so far?",
    hint: "Tap the ones you've had — or None.",
    hi: { prompt: "क्लिनिक में कोई प्रोसीजर करवाया है?", hint: "जो करवाए हों चुनें — या 'कोई नहीं'।" },
    rows: [
      { id: "prp", out: "PRP/GFC/iPRF", label: "PRP, GFC or iPRF", hi: "PRP, GFC या iPRF" },
      { id: "stem_cells", out: "Stem Cells/Exosomes", label: "Stem cells or exosomes", hi: "स्टेम सेल या एक्सोसोम" },
      { id: "transplant", out: "Hair Transplant", label: "Hair transplant", hi: "हेयर ट्रांसप्लांट" },
      { id: "other", out: "Other", label: "Other", hi: "कुछ और" },
    ],
    gate: yesno("done", "Done", "करवाया"),
    columns: [
      {
        id: "sessions",
        kind: "single",
        label: "How many sessions?",
        hi: "कितने सेशन?",
        options: [
          { value: "1-3", label: "1 to 3", hi: "1 से 3", out: "1-3" },
          { value: "4-6", label: "4 to 6", hi: "4 से 6", out: "4-6" },
          { value: ">6", label: "Over 6", hi: "6 से ज़्यादा", out: ">6" },
        ],
      },
      yesno("helped", "Did it help?", "फ़ायदा हुआ?"),
    ],
    mic: true,
  },
  {
    n: 14,
    id: "past_treatment_side_effects",
    section: "D",
    kind: "yesno-text",
    prompt: "Any side effects or poor response to a past treatment?",
    hint: "If yes, tell us in a few words — speak or type.",
    hi: { prompt: "किसी पुराने इलाज से साइड इफ़ेक्ट या फ़ायदा नहीं हुआ?", hint: "हाँ हो तो कुछ शब्दों में बताएँ — बोलकर या लिखकर।" },
    mic: true,
  },

  // ── E · Sample and consent ────────────────────────────────────────────
  {
    n: 15,
    id: "sample_type",
    section: "E",
    kind: "single",
    prompt: "For the test, which sample would you prefer to give?",
    hint: "Saliva is a simple swab; blood is a small draw. Either is fine.",
    hi: { prompt: "टेस्ट के लिए कौन सा सैंपल देना पसंद करेंगे?", hint: "लार (थूक) एक आसान स्वैब है; खून एक छोटी सी सुई। दोनों ठीक हैं।" },
    options: [
      { value: "saliva", label: "Saliva", hi: "लार (थूक)" },
      { value: "blood", label: "Blood", hi: "खून" },
      { value: "either", label: "Either", hi: "कोई भी" },
    ],
  },
  {
    n: 16,
    id: "consent",
    section: "E",
    kind: "yesno",
    autoAdvance: false,
    prompt: "One last thing — your consent.",
    body: "The clinic will collect your {sample} sample and run a genetic analysis on it. Do you consent to the sample collection and genetic analysis?",
    hi: {
      prompt: "आख़िरी बात — आपकी सहमति।",
      body: "क्लिनिक आपका {sample} सैंपल लेगा और उस पर जेनेटिक (DNA) जाँच करेगा। क्या आप सैंपल लेने और जेनेटिक जाँच के लिए सहमत हैं?",
    },
  },
];

/** Short doctor-facing labels for the review page. */
export const SHORT: Record<string, { en: string; hi: string }> = {
  age_hair_loss_began: { en: "Age when hair loss began", hi: "बाल झड़ना शुरू होने की उम्र" },
  duration: { en: "Duration", hi: "कब से" },
  family_history: { en: "Family history", hi: "पारिवारिक इतिहास" },
  pattern: { en: "Pattern", hi: "पैटर्न" },
  diagnosed_conditions: { en: "Diagnosed conditions", hi: "डायग्नोस की गई बीमारियाँ" },
  menstrual_cycle: { en: "Menstrual cycle", hi: "मासिक धर्म" },
  pregnancy_related: { en: "Pregnancy-related hair loss", hi: "गर्भावस्था से जुड़ा" },
  adult_acne_oily_skin: { en: "Acne or oily skin in adulthood", hi: "मुँहासे या तैलीय त्वचा" },
  excess_body_facial_hair: { en: "Excess body or facial hair", hi: "शरीर/चेहरे पर ज़्यादा बाल" },
  past_6_months: { en: "In the past 6 months", hi: "पिछले 6 महीनों में" },
  habits: { en: "Habits", hi: "आदतें" },
  products: { en: "Products used", hi: "इस्तेमाल किए प्रोडक्ट" },
  procedures: { en: "In-clinic procedures", hi: "क्लिनिक प्रोसीजर" },
  past_treatment_side_effects: { en: "Side effects or poor response", hi: "साइड इफ़ेक्ट / फ़ायदा नहीं" },
  sample_type: { en: "Preferred sample", hi: "पसंदीदा सैंपल" },
  consent: { en: "Consent to sample & genetic analysis", hi: "सैंपल और जेनेटिक जाँच की सहमति" },
};

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
export const TOTAL = QUESTIONS.length; // 16

/** Pick the Hindi string when the patient chose हिंदी and one exists. */
export const tx = (lang: Lang, en: string, hi?: string) => (lang === "hi" && hi ? hi : en);
export const optLabel = (o: Option, lang: Lang) => tx(lang, o.label, o.hi);

export const YESNO_OPTIONS: Option[] = [
  { value: "yes", label: "Yes", hi: "हाँ" },
  { value: "no", label: "No", hi: "नहीं" },
];
