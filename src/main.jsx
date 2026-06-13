import React from 'react'
import ReactDOM from 'react-dom/client'
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Storage ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "regenOS_v2";
const defaultData = {
  workoutGoal: 200,
  workouts: [],
  cycles: { peptideStartDate: null, senolyticLastDate: null },
  checkins: [],
  biomarkers: [],
  setupComplete: false,
  protocolActions: {},
  suppLogs: {},
  suppActive: {},
  proteinGoal: 180,
  nutritionLogs: {}, // { "YYYY-MM-DD": { slotId: true, ... } }
};

// ─── Constants ─────────────────────────────────────────────────────────────
const PEPTIDE_ON = 56, PEPTIDE_OFF = 28, SENOLYTIC_INTERVAL = 56;

// ─── Helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ─── Theme ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#070b14", surface: "#0d1220", border: "#1a2038", accent: "#00e5a0",
  accentB: "#3d9eff", purple: "#a78bfa", pink: "#f472b6", orange: "#f0a500",
  red: "#ff6b6b", text: "#e2e8f0", muted: "#7a8ba8", subtle: "#a8b4c4",
};

// ─── Supplement Stack ──────────────────────────────────────────────────────
const SUPPLEMENTS = [
  // MORNING
  { id: "nmn", time: "morning", phase: 3, label: "NMN", dose: "250–500mg", form: "Capsule", status: "pending", source: "protocol",
    why: "Addresses PPARGC1A AA mitochondrial biogenesis impairment upstream. NAD+ activates SIRT1 → PGC-1 alpha — the exact signaling pathway your variant reduces. Works upstream of CoQ10 and PQQ already in your OwnIt stack.",
    target: "Energy Expenditure · Mitochondrial Function · Adipogenesis",
    note: "Take on empty stomach or light meal. Morning timing supports circadian NAD+ rhythm. Phase 3 first-in — start NMN alone before the other cognitive/energy compounds, since NAD+ boosting can affect sleep and energy. Keep to 250–500mg given your FOXO3 TT longevity variant." },
  { id: "alphagpc", time: "morning", phase: 3, label: "Alpha-GPC", dose: "300–600mg", form: "Capsule", status: "pending", source: "protocol",
    why: "Choline is a named HIGH-impact nutrient pathway in your report — you have a genetically increased dietary choline requirement (PEMT GC variant reduces endogenous choline synthesis). Layered on APOE E4's accelerated neural choline use, this is a documented need, not an inference. Alpha-GPC crosses the blood-brain barrier and directly supports acetylcholine synthesis — better CNS delivery than choline bitartrate in your OwnIt stack.",
    target: "APOE E4 · Memory & Brain · Mood & Behavior",
    note: "Start at 300mg. COMT GA means you clear neuroactive compounds slowly — introduce this a week after NMN, on its own, and watch for headache or overstimulation before increasing." },
  { id: "lionsmane", time: "morning", phase: 3, label: "Lion's Mane Extract", dose: "500–1000mg", form: "Capsule (fruiting body)", status: "pending", source: "protocol",
    why: "Stimulates NGF (Nerve Growth Factor), promoting neuronal maintenance and plasticity. Directly relevant for memory & brain VERY HIGH + APOE E4 status.",
    target: "Memory & Brain · APOE E4 · Cognitive Function",
    note: "Must be fruiting body extract — not mycelium on grain. Brands: Host Defense, Real Mushrooms." },
  { id: "glutathione", time: "morning", phase: 2, label: "S-Acetyl Glutathione", dose: "200mg", form: "Capsule", status: "pending", source: "protocol",
    why: "GSTM1 + GSTT1 both deleted — your glutathione system carries more load with less enzymatic backup. S-acetyl form survives digestion and enters cells intact, unlike reduced glutathione in OwnIt which is largely destroyed before absorption.",
    target: "Oxidative Stress · Detoxification · Recovery",
    note: "Add alongside OwnIt — NAC in your stack still contributes to endogenous glutathione. These work together. Phase 2 anchor for your GST-null status." },
  { id: "glycine", time: "evening", phase: 2, label: "Glycine", dose: "3–5g", form: "Powder", status: "pending", source: "protocol",
    why: "Glycine is the rate-limiting amino acid for glutathione synthesis (cysteine, covered by your NAC, is the other). With GSTM1 + GSTT1 both deleted, supporting endogenous glutathione production is high-value. Glycine also improves sleep quality and supports collagen synthesis — hitting three of your VERY HIGH pathways at once.",
    target: "Oxidative Stress · Sleep · Collagen & Joints · Detoxification",
    note: "Take at night — glycine lowers core body temperature slightly and improves sleep onset, supporting your APOE E4 glymphatic clearance window. Low cost, well tolerated. Pairs naturally with magnesium glycinate." },
  // WITH MEALS
  { id: "ownit", time: "meals", phase: 0, label: "OwnIt Stack", dose: "Per label", form: "Capsule blend", status: "active", source: "ownit",
    why: "Core cellular nutrition stack based on Cellular Micronutrient Analysis. Contains 5-MTHF and methylcobalamin in active forms required by MTHFR 677 TT homozygous genotype. Also includes CoQ10, PQQ, curcumin, boswellia, EGCG, zinc, selenium, NAC, alpha-lipoic acid, and B vitamins in active forms.",
    target: "Methylation · Oxidative Stress · Inflammation · Mitochondrial Function",
    note: "Already active — your foundation. Formulated specifically off your cell composition; not something to drop or substitute. Take with food — fat-soluble components require dietary fat for absorption." },
  { id: "omega3", time: "meals", phase: 1, label: "EPA+DHA Omega-3", dose: "2–3g EPA+DHA combined", form: "Softgel (triglyceride form)", status: "pending", source: "protocol",
    why: "FADS1 GT + FADS2 CG variants mean you convert plant-based ALA to EPA/DHA poorly. Combined with APOE E4 neuroinflammation risk, marine-source omega-3 is essential — not optional. E4 carriers show greater cognitive benefit from omega-3 specifically.",
    target: "Inflammation · APOE E4 · Vascular Health · Mood & Behavior",
    note: "Triglyceride form (rTG) has ~70% better bioavailability. Do not rely on flaxseed — FADS variants impair ALA conversion. Phase 1 foundation — nothing stimulating, safe to start first." },
  { id: "resveratrol", time: "meals", phase: 3, label: "Trans-Resveratrol", dose: "250–500mg", form: "Capsule", status: "pending", source: "protocol",
    why: "Activates SIRT1, upregulates BDNF, reduces amyloid aggregation (APOE E4 mechanism), and activates eNOS for vascular health (ENOS GT variant). One compound addressing both APOE E4 and vascular VERY HIGH simultaneously.",
    target: "APOE E4 · Vascular Health · Memory & Brain · Longevity",
    note: "Must take with food containing fat. Verify product specifies trans-resveratrol isomer. Keep to 250–500mg — your FOXO3 TT longevity variant is partly governed by sirtuin/AMPK signaling, and megadoses aren't better here." },
  { id: "citrulline", time: "meals", phase: 3, label: "Citrulline Malate", dose: "3–6g", form: "Powder", status: "pending", source: "protocol",
    why: "ENOS GT variant reduces nitric oxide synthase efficiency. Citrulline uses the dietary nitrate → nitrite → NO pathway which completely bypasses the eNOS enzyme — your genetic variant is irrelevant to this route.",
    target: "Vascular Health · Blood Pressure · Exercise Response",
    note: "Best 30–60 min pre-exercise for performance. Can also be taken with any meal for daily vascular support. Avoid antibacterial mouthwash." },
  { id: "d3k2", time: "meals", phase: 1, label: "Vitamin D3 + K2-MK7", dose: "4000–5000 IU D3 + 100mcg K2", form: "Softgel", status: "pending", source: "protocol",
    why: "VDR triple variant (Fok1 TT, Bsm1 GA, Taq1 TC) impairs Vitamin D receptor function at three points. The 3000 IU in OwnIt is insufficient. K2-MK7 (MenaQ7) directs calcium into bone rather than soft tissue.",
    target: "Bone Health · Memory & Brain · Vascular Health · Hormone Balance",
    note: "Take with largest meal. In addition to D3 in OwnIt, not instead. K2 form must be MenaQ7 specifically. Phase 1 foundation — documented-gap correction." },
  { id: "collagen", time: "meals", phase: 0, label: "Hydrolyzed Collagen + Vit C", dose: "10–15g collagen + 250–500mg Vit C", form: "Powder", status: "pending", source: "protocol",
    why: "GDF5 TT, VEGFA AA, and COL12A1 AA create a connective tissue repair deficit (all VERY HIGH in your report). Timed collagen + Vit C 30–60 min before exercise increases tendon collagen synthesis by ~20% (2019 study).",
    target: "Collagen & Joints · Injury · Bone Health · Recovery",
    note: "TIMING CRITICAL — 30–60 min before exercise specifically. Vitamin C is a required cofactor — take it every time. No sequencing sensitivity — can start anytime alongside training." },
  { id: "creatine", time: "meals", phase: 0, label: "Creatine Monohydrate", dose: "5g", form: "Powder", status: "active", source: "standalone",
    why: "Well-indicated for PPARGC1A AA variant. Creatine supports ATP regeneration in cells with fewer mitochondria — directly compensating for reduced mitochondrial density your genotype creates. Also supports ACTN3 RR power expression.",
    target: "Energy Expenditure · Exercise Response · Power",
    note: "Timing flexible — consistency matters more than timing. No loading phase required at 5g/day. No sequencing sensitivity." },
  { id: "taurine", time: "meals", phase: 0, label: "Taurine", dose: "1–2g", form: "Powder or capsule", status: "active", source: "standalone",
    why: "Supports cardiovascular function (vascular health VERY HIGH), bile acid conjugation, and mitochondrial membrane integrity. Synergistic with CoQ10 and PQQ for PPARGC1A AA pathway. Emerging longevity data on taurine decline with age.",
    target: "Vascular Health · Mitochondrial Function · Longevity",
    note: "Can be taken with any meal. Well tolerated. No sequencing sensitivity." },
  // EVENING
  { id: "magnesium", time: "evening", phase: 1, label: "Magnesium Glycinate", dose: "300–400mg elemental", form: "Capsule", status: "pending", source: "protocol",
    why: "The 30mg in OwnIt is a fraction of therapeutic dose. Magnesium is a cofactor in 300+ reactions including MTHFR enzyme function, COMT catecholamine clearance, bone matrix, and slow-wave sleep. Evening timing supports APOE E4 glymphatic clearance.",
    target: "Mood & Behavior · Methylation · Blood Pressure · Bone Health · Sleep",
    note: "Pre-bed timing supports slow-wave sleep — your primary APOE E4 glymphatic amyloid clearance window. Glycinate preferred for sleep and tolerability. Phase 1 foundation." },
];

const TIME_GROUPS = [
  { id: "morning", label: "Morning", icon: "☀", sublabel: "Empty stomach or light meal", color: C.orange },
  { id: "meals", label: "With Meals", icon: "◎", sublabel: "Take with food for absorption", color: C.accent },
  { id: "evening", label: "Evening", icon: "◑", sublabel: "Pre-bed — supports sleep quality", color: C.purple },
];

const PHASES = [
  { id: 0, label: "Active Foundation", icon: "●", color: C.accent,
    sublabel: "Already running — your locked-in base", desc: "OwnIt stack (cell-composition formulated) plus standalones with no sequencing sensitivity. These are your foundation — already active and not changing." },
  { id: 1, label: "Phase 1 · Foundation", icon: "①", color: C.accentB,
    sublabel: "Weeks 1–4 · documented-gap correction", desc: "Pure correction of gaps your report names directly — FADS, VDR, methylation. Nothing stimulating, so a clean base to build on. Start these together." },
  { id: 2, label: "Phase 2 · Clearance", icon: "②", color: C.purple,
    sublabel: "Weeks 5–8 · GST-null support", desc: "Glutathione system support for your GSTM1 + GSTT1 dual deletion. Added after foundation so you can isolate any GI response. Introduce one at a time." },
  { id: 3, label: "Phase 3 · Energy & Cognitive", icon: "③", color: C.orange,
    sublabel: "Weeks 9+ · introduce one at a time", desc: "The compounds most likely to affect sleep or stimulation given your COMT GA slow-clearance. Add one per week, watch your Oura data. Suggested order: NMN → Alpha-GPC → Resveratrol → Citrulline → Lion's Mane." },
];

// ─── Nutrition / Protein Schedule ────────────────────────────────────────────
// Day types map to the weekly training split:
//   Lift days  → Tue / Thu / Sun   (weight lifting 11am)
//   Cardio days→ Mon / Wed / Fri   (fasted Zone 2, electrolytes only)
//   Rest day   → Sat
// Aligned to OwnIt playbook: 7am breakfast (within 1hr waking, cortisol support),
// 11am training, 1pm lunch (post-workout nutrient density), 3:30pm light bridge,
// 6pm dinner (anchor, completed early for 4.5hr digestive window before 10:30 bed).
// getDayType() resolves the current weekday to one of these.
const PROTEIN_GOAL_DEFAULT = 180; // 1g per lb bodyweight (180lb)
const CARB_CEILING = 200; // staying under 200g/day

const NUTRITION_PLANS = {
  lift: {
    id: "lift", label: "Lifting Day", icon: "🏋", color: C.pink,
    sublabel: "Tue · Thu · Sun — weights 11am",
    note: "Training day is where MRE earns its place — the carbs fuel glycogen for your 11am block and post-workout recovery, where they're actually useful rather than a tax. Protein lands within an hour of waking to support your cortisol awakening response.",
    slots: [
      { id: "l1", time: "7:00am", label: "Breakfast", detail: "Redcon1 MRE (optional swap for eggs + Greek yogurt)", source: "mre", protein: 47, carbs: 47 },
      { id: "l2", time: "11:00am", label: "Training Block", detail: "Weights — fuel within 60min after", source: "none", protein: 0, carbs: 0 },
      { id: "l3", time: "1:00pm", label: "Lunch (post-workout)", detail: "Lean protein + whole food", source: "whole", protein: 53, carbs: 45 },
      { id: "l4", time: "3:30pm", label: "Bridge Snack", detail: "ISO100 (1 scoop) or low-carb bar", source: "iso100", protein: 25, carbs: 2 },
      { id: "l5", time: "6:00pm", label: "Dinner (anchor)", detail: "Whole food — biggest meal", source: "whole", protein: 60, carbs: 55 },
    ],
  },
  cardio: {
    id: "cardio", label: "Cardio Day", icon: "🏃", color: C.accentB,
    sublabel: "Mon · Wed · Fri — fasted Zone 2 6am",
    note: "Fasted Zone 2 with LMNT electrolytes only — no pre-cardio protein. First protein lands at 7am breakfast within an hour of waking, which is exactly what supports your blunted cortisol awakening response. ISO100 keeps breakfast lean on a non-training day.",
    slots: [
      { id: "c1", time: "6:00am", label: "Fasted Cardio", detail: "LMNT electrolytes only", source: "none", protein: 0, carbs: 0 },
      { id: "c2", time: "7:30am", label: "Breakfast", detail: "ISO100 + eggs / Greek yogurt", source: "iso100", protein: 50, carbs: 15 },
      { id: "c3", time: "1:00pm", label: "Lunch", detail: "Whole food", source: "whole", protein: 55, carbs: 45 },
      { id: "c4", time: "3:30pm", label: "Bridge Snack", detail: "½ scoop ISO100 or low-carb bar", source: "iso100", protein: 15, carbs: 1 },
      { id: "c5", time: "6:00pm", label: "Dinner (anchor)", detail: "Whole food — biggest meal", source: "whole", protein: 65, carbs: 50 },
    ],
  },
  rest: {
    id: "rest", label: "Rest Day", icon: "🛌", color: C.purple,
    sublabel: "Sat — recovery",
    note: "No training to fuel, so protein leans on whole-food meals for micronutrient density — better aligned with the cellular work than a powder-heavy day. Still protein at breakfast for the cortisol response.",
    slots: [
      { id: "r1", time: "7:30am", label: "Breakfast", detail: "Eggs · Greek yogurt · whole food", source: "whole", protein: 50, carbs: 25 },
      { id: "r2", time: "1:00pm", label: "Lunch", detail: "Whole food", source: "whole", protein: 50, carbs: 45 },
      { id: "r3", time: "3:30pm", label: "Bridge Snack", detail: "ISO100 (1 scoop) or whole-food snack", source: "iso100", protein: 25, carbs: 2 },
      { id: "r4", time: "6:00pm", label: "Dinner (anchor)", detail: "Whole food — biggest meal", source: "whole", protein: 60, carbs: 55 },
    ],
  },
};

// JS getDay(): 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const DAY_TYPE_BY_WEEKDAY = ["lift", "cardio", "lift", "cardio", "lift", "cardio", "rest"];
const getDayType = (dateStr) => {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  return DAY_TYPE_BY_WEEKDAY[d.getDay()];
};

const PROTEIN_SOURCE_META = {
  iso100: { label: "ISO100", color: C.accent },
  mre: { label: "MRE", color: C.orange },
  whole: { label: "Whole food", color: C.subtle },
  none: { label: "—", color: C.muted },
};


// ─── Protocol Actions Data ──────────────────────────────────────────────────
const PROTOCOL_CATEGORIES = [
  {
    id: "supplements",
    icon: "◈",
    label: "Supplements",
    color: C.accent,
    actions: [
      {
        id: "d3k2",
        title: "Add Vitamin D3 + K2-MK7",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "Standalone supplement — your VDR triple variant makes this critical",
        why: "Your VDR triple variant (Fok1 TT, Bsm1 GA, Taq1 TC) impairs Vitamin D at three distinct points: absorption, conversion, and receptor binding. The 3000 IU already in your OwnIt stack is likely insufficient for cellular utilization — even if serum levels look adequate, your cells may not be responding to the signal. This affects your bone health (VERY HIGH), brain health via APOE E4, and vascular function simultaneously. This is the single highest-leverage supplement change you can make right now.",
        what: "4000–5000 IU Vitamin D3 + 100mcg K2-MK7 (MenaQ7 form specifically). Take with your largest meal — fat significantly increases absorption. Use a softgel form rather than tablet for D3.",
        brands: "Thorne D3/K2, Pure Encapsulations D3/K2, or any product specifying MenaQ7-form K2",
        timing: "With largest meal, daily",
        note: "Take in addition to the D3 already in OwnIt — not instead of it. K2-MK7 directs calcium into bone rather than soft tissue, critical given your bone health VERY HIGH rating.",
        pathways: ["Bone Health", "Memory & Brain", "Vascular Health", "Hormone Balance"],
      },
      {
        id: "omega3",
        title: "Add EPA+DHA Omega-3",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "FADS1/FADS2 variants mean you can't convert plant omega-3 — marine source essential",
        why: "Your FADS1 GT + FADS2 CG variants mean you convert plant-based ALA omega-3 to EPA/DHA poorly. This matters because EPA and DHA are the active forms your body needs for reducing neuroinflammation, building neuronal membranes, and resolving inflammatory cascades. Combined with APOE E3/E4 neuroinflammation risk, this moves omega-3 from 'recommended' to essential. E4 carriers specifically show greater cognitive benefit from omega-3 than E3/E3 individuals in multiple studies.",
        what: "2–3g combined EPA+DHA per day. Triglyceride form (look for 'rTG' or 'natural triglyceride' on the label) — significantly higher bioavailability than ethyl ester form.",
        brands: "Nordic Naturals Ultimate Omega, Carlson Elite Omega-3, or algae-based DHA if fish-free preferred",
        timing: "With a meal containing fat",
        note: "Do not use flaxseed oil as your primary omega-3 — your FADS1/FADS2 variants mean ALA-to-EPA conversion is impaired. You need preformed EPA/DHA from marine sources directly.",
        pathways: ["Inflammation", "APOE E4", "Vascular Health", "Mood & Behavior", "Recovery"],
      },
      {
        id: "magnesium",
        title: "Add Magnesium Glycinate — therapeutic dose",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "30mg in OwnIt stack is a fraction of what your genetic profile requires",
        why: "Magnesium is a cofactor in over 300 enzymatic reactions directly implicated in your findings: MTHFR enzyme function requires magnesium, your mood & behavior VERY HIGH pathway (COMT GA) is stabilized by magnesium, your glucose & insulin HIGH pathway needs it for insulin receptor signaling, and it's a structural component of bone matrix. The 30mg glycinate in your OwnIt stack is doing almost nothing therapeutically — it is present but not at a meaningful dose.",
        what: "300–400mg elemental magnesium at night. Glycinate form for best sleep, mood, and bioavailability. Malate is a good alternative if glycinate causes loose stools.",
        brands: "Pure Encapsulations Magnesium Glycinate, Thorne Magnesium Bisglycinate, Doctor's Best High Absorption Magnesium",
        timing: "60–90 minutes before sleep — also directly supports sleep quality relevant to APOE E4 glymphatic clearance",
        note: "The sleep timing is not arbitrary — magnesium taken before bed supports slow-wave sleep, which is your primary glymphatic clearance window given APOE E4 status.",
        pathways: ["Mood & Behavior", "Methylation", "Blood Pressure", "Bone Health", "Sleep Quality"],
      },
      {
        id: "glutathione",
        title: "Upgrade Glutathione Form",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "Reduced glutathione in your stack has poor oral bioavailability — GSTM1 DEL requires better delivery",
        why: "You have a complete deletion of GSTM1 — you produce zero of this enzyme, which normally conjugates glutathione to toxins for removal. This is binary and permanent. The reduced glutathione in your OwnIt stack is the right idea but the wrong form — standard reduced glutathione is largely destroyed in the digestive tract before reaching cells. Given the complete GSTM1 absence, upgrading the delivery form makes a meaningful real-world difference to your antioxidant defense.",
        what: "S-Acetyl Glutathione 200mg (acetylated form survives digestion and enters cells intact) OR Liposomal Glutathione 250–500mg (lipid encapsulation protects from gastric degradation).",
        brands: "Jarrow Formulas S-Acetyl Glutathione, Quicksilver Scientific Liposomal Glutathione",
        timing: "Morning, away from food for best absorption",
        note: "Add as a separate supplement alongside your OwnIt stack — the NAC already in your stack remains valuable as an endogenous glutathione precursor. These work together, not as replacements.",
        pathways: ["Oxidative Stress", "Detoxification", "Recovery"],
      },
      {
        id: "nmn",
        title: "Add NMN or NR — NAD+ Precursor",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "PPARGC1A AA homozygous variant depletes mitochondrial signaling upstream — CoQ10 alone isn't enough",
        why: "Your PPARGC1A AA (homozygous) variant significantly impairs mitochondrial biogenesis — your cells make fewer new mitochondria in response to exercise and caloric stress than average. Your OwnIt stack already contains CoQ10 (300mg) and PQQ (10mg) which work downstream of this impairment, supporting the mitochondria you have. But NMN works upstream: NAD+ is the primary substrate that activates SIRT1, which in turn activates PGC-1 alpha — the exact protein your variant reduces. You need both the upstream signal (NMN) and the downstream support (CoQ10, PQQ) for full coverage.",
        what: "NMN 250–500mg/day or NR (Nicotinamide Riboside) 300mg/day. Both are effective NAD+ precursors — NMN is the more direct pathway, NR has more clinical trial data.",
        brands: "Tru Niagen (NR), ProHealth Longevity NMN, Alive by Science NMN",
        timing: "Morning, on an empty stomach or with a light meal",
        note: "This also addresses your energy expenditure, weight management, and vascular health pathways simultaneously — NMN is one of the highest-leverage single additions for your genetic profile.",
        pathways: ["Energy Expenditure", "Mitochondrial Function", "Adipogenesis", "Longevity"],
      },
      {
        id: "apoe_layer",
        title: "Build APOE E4 Neuroprotective Layer",
        urgency: "60 DAYS",
        urgencyColor: C.purple,
        shortDesc: "Three targeted compounds for E4-specific mechanisms — none currently in your stack",
        why: "APOE E4 impairs three specific mechanisms: amyloid clearance from brain tissue, cholesterol redistribution within neurons, and microglial (brain immune cell) activation leading to neuroinflammation. Your current stack addresses systemic inflammation broadly but has no compounds specifically targeting these neural mechanisms. These three additions work on the E4-specific pathways and have the strongest evidence base for E4 carriers specifically.",
        what: "1. Alpha-GPC 300–600mg/day OR Citicoline (CDP-Choline) 250–500mg/day — crosses blood-brain barrier, supports acetylcholine synthesis. Choline is a named HIGH-impact nutrient pathway for you (PEMT GC reduces endogenous choline synthesis) and APOE E4 accelerates neural choline use — this is a documented dietary requirement, not just brain support.\n\n2. Lion's Mane Mushroom Extract 500–1000mg/day (fruiting body, not mycelium) — stimulates NGF (Nerve Growth Factor), promotes neuronal maintenance and plasticity. Strong evidence for memory & brain VERY HIGH + APOE E4.\n\n3. Trans-Resveratrol 250–500mg/day — activates SIRT1, upregulates BDNF, reduces amyloid aggregation, AND activates eNOS for vascular health. One compound addressing both APOE E4 and your vascular pathway simultaneously.",
        brands: "Alpha-GPC: Jarrow Formulas, NOW Foods. Lion's Mane: Host Defense, Real Mushrooms (fruiting body only). Resveratrol: Thorne ResveraCel, Tru Niagen with Resveratrol",
        timing: "Alpha-GPC and Lion's Mane — morning with food. Resveratrol — with a meal containing fat (significantly improves absorption)",
        note: "These can be added one at a time over 60 days rather than all at once. Suggested order: Alpha-GPC first (highest immediate cognitive relevance), then Resveratrol (dual vascular + brain benefit), then Lion's Mane.",
        pathways: ["APOE E4", "Memory & Brain", "Vascular Health", "Mood & Behavior"],
      },
      {
        id: "citrulline",
        title: "Add Citrulline Malate or Beetroot Extract",
        urgency: "60 DAYS",
        urgencyColor: C.purple,
        shortDesc: "ENOS GT variant reduces nitric oxide — these bypass your genetic impairment entirely",
        why: "Your ENOS GT (Glu298Asp) variant reduces the efficiency of endothelial nitric oxide synthase — the enzyme that keeps your blood vessels flexible and resistant to damage. Less nitric oxide means reduced vascular flexibility, harder blood pressure regulation, and increased endothelial vulnerability. The key insight: dietary nitrates from beetroot and citrulline are converted to nitric oxide via a completely different pathway (salivary bacteria → nitrite → NO) that completely bypasses the eNOS enzyme. Your genetic variant is irrelevant to this pathway.",
        what: "Option A: Citrulline Malate 3–6g/day, best taken pre-exercise. Option B: Concentrated beetroot extract equivalent to 500ml beetroot juice, daily.",
        brands: "NOW Foods Citrulline Malate, Kala Health Citrulline. Beetroot: HumanN SuperBeets, Purely Inspired Beets",
        timing: "Citrulline: 30–60 min pre-exercise. Beetroot: any time with food",
        note: "Important: avoid antiseptic/antibacterial mouthwash — it kills the oral bacteria required for nitrate-to-nitrite conversion, negating the effect of dietary nitrates.",
        pathways: ["Vascular Health", "Blood Pressure", "Exercise Response"],
      },
    ],
  },
  {
    id: "testing",
    icon: "◎",
    label: "Testing",
    color: C.accentB,
    actions: [
      {
        id: "hormone_redraw",
        title: "Hormone Redraw — 48–72hrs Post-Injection",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "Prior draw captured peak timing — no protocol decisions until steady-state reading",
        why: "Your most recent hormone draw was taken the day after an hCG injection, which means it captured a peak value rather than steady-state. This significantly distorts the results — elevated readings in this context don't reflect your actual baseline and should not be used to make protocol decisions (such as adding anastrozole). A properly timed redraw at 48–72 hours post-injection gives you the steady-state picture your protocol decisions should be based on.",
        what: "Expanded panel at 48–72 hours post-injection: Total testosterone, Free testosterone, Estradiol (sensitive assay — not standard), SHBG, LH, FSH, Serum copper, Ceruloplasmin, B12 (serum), RBC Folate, Homocysteine, 25-OH-D, 1,25-OH-D (active Vitamin D — critical given VDR variants), hsCRP, ApoB",
        brands: "Dynacare or LifeLabs in Canada — most of these are standard requisition items",
        timing: "Exactly 48–72 hours after your most recent hCG injection — not before, not significantly after",
        note: "Request both 25-OH-D (circulating Vitamin D) AND 1,25-OH-D (active hormone form). Your VDR triple variant means your receptors may respond poorly even when serum levels look normal. Both values together tell the full story.",
        pathways: ["Hormone Balance", "Methylation", "Vitamin D", "Vascular Health"],
      },
      {
        id: "truage",
        title: "Book TruAge Epigenetic Baseline",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "Establish cellular age before protocol changes — clean baseline before peptides and Epithalon",
        why: "TruAge measures DNA methylation patterns across multiple aging clocks to give you biological age vs chronological age. The critical reason to do this now — before adding NMN, before starting peptides, before the first Epithalon cycle — is that you need a clean baseline that reflects your current state. If you run Epithalon first and then test, you won't know what your starting point was. This baseline is the foundational data point for measuring whether your entire protocol is working over time.",
        what: "TruDiagnostic TruAge test — DNA methylation analysis via blood spot or saliva. Confirmed accessible in Canada. Tests multiple aging clocks including GrimAge, PhenoAge, and telomere length estimates.",
        brands: "TruDiagnostic (trudiagnostic.com) — order directly, self-collection kit mailed to you",
        timing: "Before starting peptide cycle and before first Epithalon cycle — as soon as possible",
        note: "Repeat annually to track protocol impact. Pair with GlycanAge every 6 months for faster-feedback biological age data between annual TruAge tests.",
        pathways: ["Longevity Tracking", "Telomere Health", "Protocol Validation"],
      },
      {
        id: "apob",
        title: "Add ApoB to Next Lipid Panel",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "Standard LDL-C is inadequate for APOE E4 carriers — particle number is what matters",
        why: "Two independent genetic mechanisms make ApoB the right cardiovascular marker for you. First, APOE E4 impairs LDL particle clearance from circulation. Second, your CETP GA variants (×2) alter the exchange of cholesterol between HDL and LDL particles. Standard lipid panels measure LDL cholesterol content (LDL-C), but it is the number of LDL particles (measured by ApoB) that determines cardiovascular risk — a particle can cause damage regardless of how much cholesterol it carries. With your cholesterol pathway scored HIGH, you may have normal LDL-C but elevated particle number. ApoB is now considered the most predictive cardiovascular risk marker by longevity medicine practitioners.",
        what: "Request ApoB, ApoA1, and hsCRP alongside standard lipid panel (total cholesterol, LDL-C, HDL-C, triglycerides). These are standard lab requisition items at Dynacare.",
        brands: "Dynacare or LifeLabs — standard requisition",
        timing: "Fasted (12 hours) for accurate triglyceride and LDL readings",
        note: "Longevity medicine target for ApoB is below 80 mg/dL. Standard 'normal' ranges on lab reports are population-average, not longevity-optimized. hsCRP tracks your systemic inflammation load — a direct readout of your IL-6 and TNF-alpha genetic activity.",
        pathways: ["APOE E4", "Cholesterol", "Vascular Health"],
      },
      {
        id: "glycanage",
        title: "Book GlycanAge — Faster Feedback Biological Age",
        urgency: "60 DAYS",
        urgencyColor: C.purple,
        shortDesc: "Inflammation-sensitive biological age marker — changes visible in months, not years",
        why: "TruAge gives deep epigenetic data but responds slowly to interventions. GlycanAge measures IgG glycosylation — a marker of biological age that is highly sensitive to inflammatory status and changes meaningfully within 3–6 months of protocol changes. Given your inflammation VERY HIGH genetic profile, this marker will be particularly informative for tracking whether your anti-inflammatory interventions (curcumin, omega-3, EGCG, diet) are actually moving the needle on your biological inflammatory burden.",
        what: "GlycanAge blood spot test. Confirmed accessible in Canada. Measures N-glycan patterns on immunoglobulin G as a proxy for biological age and inflammatory burden.",
        brands: "GlycanAge (glycanage.com) — direct order, self-collection kit",
        timing: "After your TruAge baseline is established — gives faster-changing feedback between annual TruAge tests",
        note: "Repeat every 6 months. Gives you a meaningful signal about protocol effectiveness between annual TruAge tests. Particularly valuable in the first year when you are adding multiple interventions and want feedback on what's working.",
        pathways: ["Inflammation Tracking", "Biological Age", "Protocol Validation"],
      },
    ],
  },
  {
    id: "peptides",
    icon: "↻",
    label: "Peptides",
    color: C.purple,
    actions: [
      {
        id: "bpc_tb500",
        title: "Begin BPC-157 + TB-500 Foundation Cycle",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "Your genetic profile specifically validates this stack — VEGFA AA is a direct target",
        why: "BPC-157's primary mechanism — upregulating VEGF receptor expression and promoting angiogenesis in tendons — directly compensates for your VEGFA AA variant which reduces native tendon vascularization (VEGFA AA is starred VERY HIGH in your report). TB-500 promotes structural tissue repair and cell migration, supporting the GDF5 TT and COL12A1 AA connective-tissue drivers behind your collagen pathway. Your injury pathway is VERY HIGH, recovery is VERY HIGH, and collagen & joints is VERY HIGH — this stack addresses all three. This is one of the clearest genetic-to-peptide alignments in your entire profile.",
        what: "BPC-157: 250–300mcg/day subcutaneous or oral for first 2 weeks, then 500mcg if well tolerated. TB-500: 2.5mg twice weekly subcutaneous. Run together for 8-week on-cycle.",
        brands: "Quality-tested peptides from your existing sourcing approach — verify purity certificates (HPLC analysis) before use",
        timing: "BPC-157: morning on empty stomach if oral, anytime if subcutaneous. TB-500: consistent day and time each week (e.g. Monday and Thursday)",
        note: "Monitor HRV on Oura as primary recovery feedback signal during the cycle. Also watch sleep quality — BPC-157 can affect dopaminergic tone in COMT GA individuals, which may show up as altered sleep architecture in the first 1–2 weeks.",
        pathways: ["Collagen & Joints", "Injury", "Recovery", "Vascular Health"],
      },
      {
        id: "ipamorelin",
        title: "Add Ipamorelin — Pre-Sleep GH Secretagogue",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "GH support addresses energy metabolism, collagen synthesis, and recovery simultaneously",
        why: "Ipamorelin stimulates GH release via the ghrelin receptor, which downstream supports IGF-1, fat oxidation, collagen synthesis, and recovery. Given your PPARGC1A AA (reduced mitochondrial biogenesis) and the multiple energy pathway VERY HIGH ratings, GH-mediated metabolic support is well-aligned. Pre-sleep timing aligns with the natural GH secretion peak during first deep sleep cycle and — importantly for APOE E4 — does not compete with the glymphatic amyloid clearance window that also occurs during deep sleep.",
        what: "100–200mcg subcutaneous, 30–60 minutes before sleep. Start at 100mcg for first 2 weeks.",
        brands: "Quality-tested peptides — same sourcing as BPC-157/TB-500",
        timing: "30–60 min before sleep, after a 2–3 hour fast. Insulin from recent eating blunts GH response significantly.",
        note: "Two reasons to keep dosing physiological (100–200mcg), not aggressive: (1) APOE E4 — Ipamorelin produces physiological GH pulses, not supraphysiological levels. (2) Your FOXO3 TT longevity variant — FOXO3's protective, stress-resistance and autophagy benefits are partly suppressed by chronically elevated GH/IGF-1 signaling. Keeping GH in the physiological range preserves this genetic asset rather than working against it. Do not escalate beyond 200mcg without knowing your IGF-1 response. Monitor slow-wave sleep % on Oura as a proxy for GH secretion quality.",
        pathways: ["Energy Expenditure", "Recovery", "Collagen & Joints", "APOE E4"],
      },
      {
        id: "epithalon",
        title: "Schedule Epithalon — First Off-Cycle Month",
        urgency: "60 DAYS",
        urgencyColor: C.purple,
        shortDesc: "Telomerase activation particularly well-indicated given your oxidative stress genetic burden",
        why: "High oxidative stress accelerates telomere attrition — each oxidative insult causes small amounts of telomere damage. Your genetic profile (GSTM1 DEL, GSTT1 DEL, GPX1 TT) means your oxidative burden is higher than average and your clearance is lower, meaning your telomeres are likely under greater-than-average stress. Epithalon's telomerase-activating mechanism directly addresses this. Running it twice yearly during peptide off-months is the correct timing — the off-month creates metabolic space for a different intervention type.",
        what: "10mg total over 10 days (1mg/day subcutaneous) OR 20mg over 20 days. Twice yearly — coordinate with your existing plan.",
        brands: "Quality-tested peptides — verify purity",
        timing: "During 4-week peptide off-cycle. Do not run concurrently with BPC-157/TB-500/Ipamorelin.",
        note: "CRITICAL: Complete your TruAge baseline test BEFORE the first Epithalon cycle. You need pre-intervention data to measure impact. Also coordinate senolytic pulse (Fisetin + Quercetin) during the same off-month — space them at least 1 week apart within the month.",
        pathways: ["Telomere Health", "Oxidative Stress", "Longevity"],
      },
      {
        id: "semax_selank",
        title: "Semax + Selank — Start After Baseline Established",
        urgency: "60 DAYS",
        urgencyColor: C.purple,
        shortDesc: "Well-indicated for your profile but COMT GA + attention prescription requires careful entry",
        why: "Semax upregulates BDNF — directly compensatory for your BDNF GA (Val66Met) variant which reduces activity-dependent BDNF secretion by ~30%. Selank is GABAergic and anxiolytic, well-matched to your HTR1A serotonin receptor variant. However, your COMT GA variant means dopamine clears more slowly from your prefrontal cortex than average — Semax's dopaminergic modulation may be more pronounced in your neurochemical context. Starting after your BPC-157 cycle is established gives you clean baseline sleep and HRV data to compare against.",
        what: "Selank first: 300–600mcg intranasal, on-demand for lower performance days. Add Semax second: 300–600mcg intranasal, on-demand. Monitor mood and sleep for 24–48hrs after each Semax use given COMT GA slow clearance.",
        brands: "Quality-tested peptides — intranasal preparation requires sterile mixing",
        timing: "On-demand, morning use. Do not use Semax on same days as stimulant attention medication initially — assess your individual response first.",
        note: "Your attention prescription operates on dopaminergic and noradrenergic pathways — the same ones COMT GA modulates. Do not combine until you understand your individual Semax response. Start with Selank alone for 2–3 uses before adding Semax.",
        pathways: ["Mood & Behavior", "Memory & Brain", "APOE E4", "COMT GA"],
      },
    ],
  },
  {
    id: "lifestyle",
    icon: "◉",
    label: "Diet & Lifestyle",
    color: C.pink,
    actions: [
      {
        id: "collagen",
        title: "Add Hydrolyzed Collagen — Timed Around Exercise",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "Timing is critical — 30–60 min before exercise is 20% more effective for tendon synthesis",
        why: "Your collagen & joints pathway is VERY HIGH driven by GDF5 TT (reduced cartilage resilience), VEGFA AA (impaired tendon vascularization), and COL12A1 AA (altered collagen fibril organization) — all three starred or VERY HIGH in your report. Hydrolyzed collagen peptides provide the amino acid substrate — glycine, proline, hydroxyproline — that fibroblasts need to synthesize new collagen. A 2019 study specifically showed that taking collagen peptides with Vitamin C 30–60 minutes before exercise increased collagen synthesis markers in tendons by approximately 20% compared to other timing. For your genotype this is not a marginal optimization.",
        what: "10–15g hydrolyzed collagen peptides + 250–500mg Vitamin C taken 30–60 minutes before exercise. Type I + III collagen blend is most relevant for tendons and ligaments.",
        brands: "Great Lakes Wellness, Vital Proteins, Further Food. Any unflavored hydrolyzed collagen is appropriate — avoid gelatin (different processing).",
        timing: "30–60 min before exercise — this is not arbitrary, this is the specific window when fibroblasts are primed to incorporate collagen substrate",
        note: "BPC-157 in your peptide stack and collagen timing work synergistically — BPC-157 upregulates VEGF receptors for vascularization while timed collagen provides the structural substrate. Run both when peptide cycle is active.",
        pathways: ["Collagen & Joints", "Injury", "Bone Health", "Recovery"],
      },
      {
        id: "meal_timing",
        title: "Formalize Eating Window — Earlier Cutoff",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "APOE E4 + PPARGC1A AA make an earlier eating window genuinely high-leverage for you",
        why: "Your earlier eating window is driven by APOE E4 and your energy genes — NOT CLOCK (your CLOCK 3111 is TT, scored NO IMPACT in your report, so ignore any 'circadian variant' rationale). The real basis: APOE E4 carriers get outsized benefit from intermittent fasting, which upregulates autophagy (cellular cleanup including amyloid precursor clearance), increases BDNF, and activates glymphatic drainage during sleep. Layer that on PPARGC1A AA (fewer mitochondria, slower fuel-burning) and ADRB2 GG×2 (less efficient fat mobilization, both VERY HIGH), and a compressed earlier window helps your weight-loss-resistance and adipogenesis pathways. Note: your UCP2 AA and UCP3 CT are actually PROTECTIVE — working in your favor — so don't treat thermogenesis as a deficit to fight.",
        what: "16:8 intermittent fasting with eating window ending by 7–8pm. Front-load calories toward earlier in the day.",
        brands: "N/A — dietary practice",
        timing: "Consistent daily eating window. The Ipamorelin pre-sleep injection requires a 2–3 hour food-free window anyway — an earlier eating cutoff supports this automatically.",
        note: "Your existing lower-carbohydrate whole food approach is already well-matched to your biology. This adds timing precision to an already good dietary foundation rather than requiring dietary overhaul.",
        pathways: ["Adipogenesis", "Energy Expenditure", "APOE E4", "Inflammation"],
      },
      {
        id: "zone2",
        title: "Add Consistent Zone 2 Cardio",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "PPARGC1A AA requires Zone 2 to drive mitochondrial adaptation — HIIT alone is insufficient",
        why: "Your ACTN3 RR power genotype may pull you naturally toward strength training. But your PPARGC1A AA variant has a specific requirement: prolonged sub-threshold (Zone 2) cardio is the primary stimulus for PGC-1 alpha expression in skeletal muscle — the exact pathway your variant impairs. HIIT also helps but cannot fully replace Zone 2 for mitochondrial density. Aerobic exercise is also the most powerful natural eNOS upregulator that exists — it increases shear stress on vessel walls which directly stimulates nitric oxide production, compensating for your ENOS GT variant regardless of genetics.",
        what: "2–3 sessions per week of Zone 2 cardio, 30–45 minutes each. Zone 2 = conversational pace, roughly 60–70% of max heart rate. Add 1 HIIT session per week (4–6 x 30-second maximal efforts with full recovery).",
        brands: "N/A — training practice. Use Oura heart rate data or a heart rate monitor to confirm Zone 2 range.",
        timing: "Separate from heavy strength sessions — not immediately after high-intensity lifting",
        note: "Track resting heart rate trend on Oura over weeks as a proxy for mitochondrial adaptation progress. A downward RHR trend is a positive signal that Zone 2 is working.",
        pathways: ["Energy Expenditure", "Exercise Response", "Vascular Health", "APOE E4"],
      },
      {
        id: "toxin_reduction",
        title: "Reduce Environmental Toxin Exposure",
        urgency: "SOON",
        urgencyColor: C.orange,
        shortDesc: "GSTM1 + GSTT1 deletions mean toxin avoidance has uniquely high ROI for your genotype",
        why: "With both GSTM1 and GSTT1 completely deleted, your detoxification capacity for environmental toxins is materially reduced compared to most people. These two enzymes normally conjugate glutathione to a wide range of environmental chemicals, heavy metals, and metabolic byproducts for safe elimination. Without them, these compounds accumulate more readily. This means toxin avoidance has a much higher ROI for you than for someone with intact detox enzymes — it's not generic wellness advice, it's genetically specific priority.",
        what: "Priority changes: (1) Replace plastic food storage with glass or stainless (BPA/phthalates processed by GSTM1). (2) Install a quality water filter — carbon block or reverse osmosis. (3) Replace non-stick Teflon cookware with cast iron, stainless, or ceramic. (4) Choose organic produce for the dirty dozen (strawberries, spinach, apples, grapes, peppers, cherries, peaches, pears, celery, tomatoes, nectarines, blueberries). (5) Minimize alcohol — heavily burdens the glutathione system your GSTM1 deletion already compromises.",
        brands: "Water filter: Berkey, Brita pitcher (basic but better than nothing), or under-sink carbon block system",
        timing: "Start with water and cookware — highest daily exposure items",
        note: "You don't need to do all of these simultaneously. Prioritize by daily exposure: water and cooking vessels are the most impactful changes because they affect every meal every day.",
        pathways: ["Detoxification", "Oxidative Stress", "Inflammation"],
      },
    ],
  },
  {
    id: "monitoring",
    icon: "⬡",
    label: "Monitoring",
    color: C.orange,
    actions: [
      {
        id: "hrv_protocol",
        title: "Use Oura HRV as Training Green-Light — Not Fixed Schedule",
        urgency: "NOW",
        urgencyColor: C.red,
        shortDesc: "Recovery VERY HIGH + slower inflammatory resolution means HRV-guided training is genuinely important for your genotype",
        why: "Your recovery pathway is VERY HIGH driven by IL-6 CC, IL-1+, MNSOD TT, GPX1 TT, and CRP GA. These variants mean you generate a more robust inflammatory response to training stress and resolve it more slowly than average. Training hard before your inflammatory response from the previous session has fully resolved does not make you fitter faster — for your genotype it compounds tissue stress and increases injury risk. HRV is the most practical proxy for autonomic recovery, which correlates strongly with inflammatory resolution.",
        what: "HRV at or above your 7-day average → green light for hard training. HRV 10–15% below average → reduce intensity, active recovery only. HRV 20%+ below average → rest day, prioritize sleep and nutrition.",
        brands: "Oura ring already in use — use the Readiness score and HRV trend in the app",
        timing: "Check each morning before planning training intensity",
        note: "Also track: Slow-wave sleep percentage (reflects GH secretion quality from Ipamorelin and glymphatic clearance relevant to APOE E4), and resting heart rate trend over weeks as a proxy for improving mitochondrial efficiency from Zone 2 training.",
        pathways: ["Recovery", "Injury", "APOE E4", "Training Response"],
      },
      {
        id: "homocysteine",
        title: "Annual Homocysteine Test",
        urgency: "ONGOING",
        urgencyColor: C.accent,
        shortDesc: "MTHFR 677 TT homozygous — homocysteine is your most direct methylation and vascular risk proxy",
        why: "Homocysteine is the direct downstream marker of MTHFR enzyme function. Elevated homocysteine is directly toxic to endothelial cells — it damages vessel lining, reduces nitric oxide bioavailability, and accelerates atherosclerosis. Your MTHFR 677 TT homozygous status means your methylation cycle can tip toward homocysteine accumulation if B vitamins are suboptimal. Your last result (~9 umol/L) was reassuring and indicates your current methylfolate + methyl-B12 is working. But this must stay on annual rotation without exception — it is your most sensitive early warning system for both methylation and vascular health.",
        what: "Serum homocysteine annually. Request alongside RBC folate and serum B12 for the full methylation picture.",
        brands: "Dynacare or LifeLabs — standard requisition",
        timing: "Annual — ideally at the same time each year for consistent comparison. Fasted preferred.",
        note: "Longevity target is below 8 umol/L (tighter than the standard lab 'normal' of below 15). If homocysteine rises above 10: increase methylfolate dose, check B12, and consider adding Trimethylglycine (TMG/betaine) 500–1000mg/day as an alternative methylation donor.",
        pathways: ["Methylation", "Vascular Health", "Brain Health"],
      },
      {
        id: "dexa",
        title: "Annual DEXA with Bone Mineral Density",
        urgency: "ONGOING",
        urgencyColor: C.accent,
        shortDesc: "VDR triple variant + COL1A1 GG makes bone health monitoring more important for your genotype than average",
        why: "Your bone health pathway is VERY HIGH. Your VDR triple variant affects bone mineral density regulation, and your COL1A1 GG variant affects bone quality (collagen matrix structure) independently of mineral density. This means standard DEXA T-scores may actually underestimate your bone fragility risk — T-score measures mineral density, not the collagen scaffold quality that COL1A1 affects. Annual monitoring with a note to your clinician about COL1A1 GG allows you to track actual bone health trajectory as your D3 + K2 + magnesium + resistance training protocol takes effect.",
        what: "Annual DEXA scan including bone mineral density at lumbar spine and femoral neck — the two sites most affected by VDR variants. Track T-score and Z-score at each site.",
        brands: "Same facility as your existing DEXA baseline for consistent measurement methodology",
        timing: "Annual, consistent timing",
        note: "If your existing DEXA baseline did not include bone mineral density (some body composition DEXAs skip it), request it specifically at your next scan. Also worth noting for your clinician: COL1A1 GG affects bone quality independent of T-score — this is a specific finding worth raising if you ever discuss bone health formally.",
        pathways: ["Bone Health", "Collagen & Joints"],
      },
      {
        id: "senolytics_ongoing",
        title: "Senolytic Pulse — Every 8 Weeks",
        urgency: "ONGOING",
        urgencyColor: C.accent,
        shortDesc: "Already in your protocol — coordinate timing with peptide cycles and Epithalon",
        why: "Senescent cells — old, damaged cells that refuse to die but secrete inflammatory signals — accumulate faster in individuals with higher oxidative stress burden. Your GSTM1 DEL, GSTT1 DEL, and GPX1 TT variants mean you accumulate oxidative damage more readily, which accelerates senescent cell burden. Fisetin and Quercetin clear senescent cells without harming healthy ones. The 8-week pulse schedule is the most evidence-backed timing for senolytic protocols. Quercetin also provides direct anti-inflammatory benefit via mast cell stabilization, giving it dual function for your profile.",
        what: "Fisetin 1000–1500mg + Quercetin 1000mg over 2 consecutive days, every 8 weeks. Take with a fatty meal — both are fat-soluble.",
        brands: "Fisetin: Swanson, NOW Foods. Quercetin: Thorne, Pure Encapsulations",
        timing: "During peptide off-weeks when possible. If running Epithalon in the same off-month, space senolytic pulse at least 1 week apart from Epithalon protocol.",
        note: "You already have this in your protocol — the main action here is coordinating timing. Log your senolytic pulse in the Cycles tab to keep the countdown accurate.",
        pathways: ["Senescence", "Inflammation", "Oxidative Stress", "Longevity"],
      },
    ],
  },
];

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [toast, setToast] = useState(null);

  // Setup state
  const [sGoal, setSGoal] = useState("200");
  const [sPepStart, setSPepStart] = useState(todayStr());
  const [sSenLast, setSSenLast] = useState(todayStr());

  // Workout form
  const [wDate, setWDate] = useState(todayStr());
  const [wType, setWType] = useState("");
  const [wNotes, setWNotes] = useState("");

  // Check-in form
  const [ciEnergy, setCiEnergy] = useState(3);
  const [ciNotes, setCiNotes] = useState("");

  // Biomarker form
  const [bType, setBType] = useState("GlycanAge");
  const [bValue, setBValue] = useState("");
  const [bDate, setBDate] = useState(todayStr());
  const [bNotes, setBNotes] = useState("");

  // PDF upload
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);
  const fileRef = useRef();

  // Protocol tab state
  const [activeCategory, setActiveCategory] = useState("supplements");
  const [expandedAction, setExpandedAction] = useState(null);
  const [expandedSupp, setExpandedSupp] = useState(null);
  const [suppViewDate, setSuppViewDate] = useState(todayStr());
  const [suppView, setSuppView] = useState("phase");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.protocolActions) parsed.protocolActions = {};
        if (!parsed.suppLogs) parsed.suppLogs = {};
        if (!parsed.suppActive) parsed.suppActive = {};
        if (!parsed.nutritionLogs) parsed.nutritionLogs = {};
        if (!parsed.proteinGoal) parsed.proteinGoal = PROTEIN_GOAL_DEFAULT;
        setData(parsed);
      }
    } catch {}
    setLoading(false);
  }, []);

  const persist = useCallback(d => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
  }, []);

  const update = fn => setData(prev => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    persist(next);
    return next;
  });

  const toast$ = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const toggleActionComplete = (actionId) => {
    update(d => {
      if (!d.protocolActions) d.protocolActions = {};
      d.protocolActions[actionId] = !d.protocolActions[actionId];
    });
  };

  const isSuppActive = (supp) => supp.status === "active" || !!data.suppActive?.[supp.id];
  const isSuppLogged = (suppId, dateStr) => !!data.suppLogs?.[dateStr]?.[suppId];
  const toggleSuppLog = (suppId, dateStr) => update(d => {
    if (!d.suppLogs) d.suppLogs = {};
    if (!d.suppLogs[dateStr]) d.suppLogs[dateStr] = {};
    d.suppLogs[dateStr][suppId] = !d.suppLogs[dateStr][suppId];
  });
  const activateSupp = (suppId) => { update(d => { if (!d.suppActive) d.suppActive = {}; d.suppActive[suppId] = true; }); toast$("Activated — tracking started!"); };
  const deactivateSupp = (suppId) => { update(d => { if (d.suppActive) delete d.suppActive[suppId]; }); toast$("Set back to pending"); };
  const getSuppStreak = (suppId) => {
    let streak = 0; let d = new Date();
    while (true) { const ds = d.toISOString().split("T")[0]; if (data.suppLogs?.[ds]?.[suppId]) { streak++; d.setDate(d.getDate() - 1); } else break; }
    return streak;
  };
  const activeSuppIds = SUPPLEMENTS.filter(s => isSuppActive(s)).map(s => s.id);
  const todayLoggedCount = activeSuppIds.filter(id => isSuppLogged(id, suppViewDate)).length;
  const todayAdherence = activeSuppIds.length > 0 ? Math.round((todayLoggedCount / activeSuppIds.length) * 100) : 0;

  // ── Cycle calcs ──
  const getPS = () => {
    if (!data.cycles.peptideStartDate) return null;
    const el = daysBetween(data.cycles.peptideStartDate, todayStr());
    if (el < 0) return null;
    const cycleLen = PEPTIDE_ON + PEPTIDE_OFF;
    const pos = el % cycleLen;
    const isOn = pos < PEPTIDE_ON;
    const dayInPhase = isOn ? pos + 1 : pos - PEPTIDE_ON + 1;
    const daysLeft = isOn ? PEPTIDE_ON - pos : PEPTIDE_OFF - (pos - PEPTIDE_ON);
    return { isOn, dayInPhase, daysLeft, cycle: Math.floor(el / cycleLen) + 1, nextDate: addDays(todayStr(), daysLeft), pos, cycleLen };
  };

  const getSS = () => {
    if (!data.cycles.senolyticLastDate) return null;
    const el = daysBetween(data.cycles.senolyticLastDate, todayStr());
    const left = Math.max(0, SENOLYTIC_INTERVAL - el);
    return { el, left, next: addDays(data.cycles.senolyticLastDate, SENOLYTIC_INTERVAL), due: left === 0 };
  };

  const ps = getPS(), ss = getSS();
  const thisYear = new Date().getFullYear().toString();
  const workoutsYTD = data.workouts.filter(w => w.date?.startsWith(thisYear));
  const pct = Math.min(100, Math.round((workoutsYTD.length / (data.workoutGoal || 200)) * 100));

  // ── Protocol stats ──
  const allActions = PROTOCOL_CATEGORIES.flatMap(c => c.actions);
  const totalActions = allActions.length;
  const completedActions = allActions.filter(a => data.protocolActions?.[a.id]).length;
  const protocolPct = Math.round((completedActions / totalActions) * 100);
  const nextAction = allActions.find(a => !data.protocolActions?.[a.id]);

  // ── Actions ──
  const logWorkout = () => {
    if (!wType.trim()) { toast$("Enter workout type", "err"); return; }
    update(d => { d.workouts = [{ id: Date.now(), date: wDate, type: wType.trim(), notes: wNotes.trim() }, ...d.workouts]; });
    setWType(""); setWNotes(""); setWDate(todayStr());
    toast$("Workout logged!");
  };

  const logCheckin = () => {
    update(d => { d.checkins = [{ id: Date.now(), date: todayStr(), energy: ciEnergy, notes: ciNotes.trim() }, ...d.checkins]; });
    setCiNotes(""); setCiEnergy(3);
    toast$("Check-in saved!");
  };

  const logBiomarker = () => {
    if (!bValue.trim()) { toast$("Enter a value", "err"); return; }
    update(d => { d.biomarkers = [{ id: Date.now(), type: bType, value: bValue.trim(), date: bDate, notes: bNotes.trim() }, ...d.biomarkers]; });
    setBValue(""); setBNotes(""); setBDate(todayStr());
    toast$("Biomarker saved!");
  };

  const completeSetup = () => {
    update(d => { d.workoutGoal = parseInt(sGoal) || 200; d.cycles.peptideStartDate = sPepStart; d.cycles.senolyticLastDate = sSenLast; d.setupComplete = true; });
    setTab("home");
  };

  // ── PDF Upload ──
  const handlePDF = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfLoading(true); setPdfResult(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("File read failed"));
        r.readAsDataURL(file);
      });
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-beta": "pdfs-2024-09-25",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
              { type: "text", text: `This is a blood test report. Extract ALL lab values and return ONLY a valid JSON array — no markdown, no backticks, no explanation, nothing else. Format exactly: [{"name":"Test Name","value":"123.4","unit":"mmol/L","reference":"3.5-5.0","flag":"H or L or normal","date":"YYYY-MM-DD"}]. Use the collection date for the date field. If no date found, use ${todayStr()}. Include every single test result you can find.` }
            ]
          }]
        })
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error.message || "API error");
      const raw = json.content?.find(c => c.type === "text")?.text || "[]";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const results = JSON.parse(cleaned);
      if (!Array.isArray(results) || results.length === 0) {
        toast$("No results found in PDF", "err");
      } else {
        setPdfResult(results);
      }
    } catch (err) {
      console.error("PDF error:", err);
      toast$(`Error: ${err.message || "Could not read PDF"}`, "err");
    }
    setPdfLoading(false);
    e.target.value = "";
  };

  const importPDFResults = (selected) => {
    update(d => {
      selected.forEach(r => {
        d.biomarkers = [{ id: Date.now() + Math.random(), type: r.name, value: `${r.value}${r.unit ? " " + r.unit : ""}${r.flag && r.flag !== "normal" ? " (" + r.flag + ")" : ""}`, date: r.date, notes: r.reference ? `Ref: ${r.reference}` : "" }, ...d.biomarkers];
      });
    });
    setPdfResult(null);
    toast$(`${selected.length} results imported!`);
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.accent, fontSize: 16, fontFamily: "sans-serif", letterSpacing: "0.1em" }}>LOADING...</div>
    </div>
  );

  // ── Setup ──
  if (!data.setupComplete) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, color: C.accent, marginBottom: 8 }}>◈</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Regenerative OS</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Calibrate your protocol</p>
        </div>
        {[
          ["Annual workout goal (days)", "number", sGoal, setSGoal],
          ["Peptide cycle start date", "date", sPepStart, setSPepStart],
          ["Last senolytic pulse date", "date", sSenLast, setSSenLast],
        ].map(([label, type, val, set]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={Tx.label}>{label}</label>
            <input style={Tx.input} type={type} value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}
        <button style={Tx.btnPrimary} onClick={completeSetup}>Initialize Protocol →</button>
      </div>
    </div>
  );

  // ── Main App ──
  const tabs = [
    { id: "home", icon: "⬡", label: "Home" },
    { id: "supps", icon: "◈", label: "Supps" },
    { id: "workout", icon: "◎", label: "Workout" },
    { id: "nutrition", icon: "⊙", label: "Fuel" },
    { id: "checkin", icon: "◉", label: "Check-in" },
    { id: "bio", icon: "⬡", label: "Labs" },
    { id: "protocol", icon: "⬢", label: "Protocol" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 80 }}>
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? C.red : C.accent, color: "#000", padding: "10px 22px", borderRadius: 50, fontWeight: 700, fontSize: 13, zIndex: 9999, whiteSpace: "nowrap" }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <span style={{ color: C.accent, fontSize: 20 }}>◈</span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Regen OS</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* ── HOME ── */}
        {tab === "home" && (
          <div>
            {/* Bio age hero */}
            <div style={{ background: "linear-gradient(135deg,#0a1e3d,#071428)", border: `1px solid #1e3060`, borderRadius: 20, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Biological Age</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: C.accent, lineHeight: 1, letterSpacing: "-0.04em" }}>34</div>
              <div style={{ fontSize: 13, color: C.subtle, marginTop: 6 }}>Chronological 38 · <span style={{ color: C.accent, fontWeight: 700 }}>+4 year gap</span></div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>REGENERATIVE INDEX</div>
                <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "72%", background: `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 3 }} />
                </div>
              </div>
            </div>

            {/* ── GENETIC FLAGS ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Key Genetic Markers</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { gene: "APOE E3/E4", label: "Neuroinflammation · Amyloid clearance · Cholesterol transport", color: C.red, icon: "🧠", tag: "RISK" },
                  { gene: "MTHFR 677 TT", label: "Homozygous · ~70% methylation enzyme reduction", color: C.orange, icon: "⚡", tag: "RISK" },
                  { gene: "GSTM1 + GSTT1 DEL", label: "Both deleted · Reduced toxin clearance capacity", color: C.purple, icon: "🛡", tag: "RISK" },
                  { gene: "FOXO3 TT", label: "Longevity-associated variant · Stress resistance asset", color: C.accent, icon: "🧬", tag: "PROTECTIVE" },
                ].map(f => (
                  <div key={f.gene} style={{ background: C.surface, border: `1px solid ${f.color}30`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{f.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: f.color, letterSpacing: "0.04em" }}>{f.gene}</span>
                        <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 8, background: f.color + "20", color: f.color, border: `1px solid ${f.color}40`, letterSpacing: "0.08em", fontWeight: 700 }}>{f.tag}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{f.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SUPPLEMENT ADHERENCE ── */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16, cursor: "pointer" }}
              onClick={() => setTab("supps")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Today's Supplements</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{todayAdherence}%</span>
              </div>
              <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${todayAdherence}%`, background: `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 4, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{todayLoggedCount} of {activeSuppIds.length} active supplements taken</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: "center" }}>Tap to log supplements →</div>
            </div>

            {/* ── PROTOCOL PROGRESS ── */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}
              onClick={() => setTab("protocol")} >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Protocol Actions</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{protocolPct}%</span>
              </div>
              <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${protocolPct}%`, background: `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 4, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{completedActions} of {totalActions} complete</div>
              {nextAction && (
                <div style={{ background: "#0a0e1a", borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.accent}25` }}>
                  <div style={{ fontSize: 10, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Next Priority</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{nextAction.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{nextAction.shortDesc}</div>
                </div>
              )}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>Tap to view full protocol →</div>
            </div>

            {/* Status grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <StatCard icon="↻" label="Peptides"
                val={ps ? (ps.isOn ? "ON" : "OFF") + ` D${ps.dayInPhase}` : "Not set"}
                sub={ps ? `${ps.daysLeft}d left` : "Set in Settings"}
                color={ps?.isOn ? C.accent : C.orange} />
              <StatCard icon="◎" label="Senolytics"
                val={ss ? (ss.due ? "DUE NOW" : `${ss.left}d`) : "Not set"}
                sub={ss ? fmtDate(ss.next) : "—"}
                color={ss?.due ? C.red : C.purple} />
              <StatCard icon="◈" label="Epithalon"
                val={ps ? (ps.isOn ? `In ${ps.daysLeft}d` : "ACTIVE") : "—"}
                sub={ps?.isOn ? "Off month coming" : "Run now"}
                color={C.accentB} />
              <StatCard icon="◉" label="Workouts"
                val={`${workoutsYTD.length}/${data.workoutGoal}`}
                sub={`${pct}% of goal`}
                color={C.pink} />
            </div>

            {/* Progress bar */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Annual Workout Goal</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: C.pink }}>{pct}%</span>
              </div>
              <div style={{ height: 10, background: "#1a2038", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${C.pink},${C.purple})`, borderRadius: 5, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{workoutsYTD.length} logged · {Math.max(0, data.workoutGoal - workoutsYTD.length)} remaining</div>
            </div>

            {/* Recent workouts */}
            <SectionTitle>Recent Workouts</SectionTitle>
            {data.workouts.length === 0
              ? <Empty>No workouts yet — log your first one</Empty>
              : data.workouts.slice(0, 4).map(w => (
                <Row key={w.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(w.date)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{w.type}</span>
                  {w.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.notes}</span>}
                </Row>
              ))}
          </div>
        )}

        {/* ── CYCLES ── */}
        {/* ── SUPPLEMENTS ── */}
        {tab === "supps" && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 16px", letterSpacing: "-0.02em" }}>Supplement Stack</h1>

            {/* Date nav + adherence bar */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <button style={{ background: "#0a0e1a", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}
                  onClick={() => { const d = new Date(suppViewDate + "T12:00:00"); d.setDate(d.getDate() - 1); setSuppViewDate(d.toISOString().split("T")[0]); }}>‹</button>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{suppViewDate === todayStr() ? "Today" : fmtDate(suppViewDate)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(suppViewDate)}</div>
                </div>
                <button style={{ background: "#0a0e1a", border: `1px solid ${C.border}`, borderRadius: 8, color: suppViewDate === todayStr() ? C.muted : C.text, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}
                  onClick={() => { if (suppViewDate === todayStr()) return; const d = new Date(suppViewDate + "T12:00:00"); d.setDate(d.getDate() + 1); setSuppViewDate(d.toISOString().split("T")[0]); }}>›</button>
              </div>
              {(() => {
                const ids = SUPPLEMENTS.filter(s => isSuppActive(s)).map(s => s.id);
                const logged = ids.filter(id => isSuppLogged(id, suppViewDate)).length;
                const p = ids.length > 0 ? Math.round((logged / ids.length) * 100) : 0;
                return (<>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{logged} of {ids.length} taken</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p === 100 ? C.accent : C.text }}>{p}%</span>
                  </div>
                  <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p}%`, background: p === 100 ? C.accent : `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </>);
              })()}
            </div>

            {/* View toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[["phase", "By Phase"], ["time", "By Time of Day"]].map(([v, label]) => (
                <button key={v} onClick={() => setSuppView(v)}
                  style={{ flex: 1, background: suppView === v ? C.accent + "20" : "#0a0e1a", border: `1px solid ${suppView === v ? C.accent + "60" : C.border}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: suppView === v ? C.accent : C.muted, letterSpacing: "0.03em" }}>
                  {label}
                </button>
              ))}
            </div>

            {suppView === "phase" && PHASES.map(phase => {
              const phaseSupps = SUPPLEMENTS.filter(s => s.phase === phase.id);
              if (phaseSupps.length === 0) return null;
              const activeSupps = phaseSupps.filter(s => isSuppActive(s));
              const pendingSupps = phaseSupps.filter(s => !isSuppActive(s));
              return (
                <div key={phase.id} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: phase.color + "18", border: `1px solid ${phase.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 17, color: phase.color, fontWeight: 800 }}>{phase.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: phase.color, letterSpacing: "-0.01em" }}>{phase.label}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{phase.sublabel}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{activeSupps.length}/{phaseSupps.length} active</div>
                  </div>
                  <div style={{ background: phase.color + "0c", border: `1px solid ${phase.color}22`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.subtle, lineHeight: 1.6 }}>{phase.desc}</div>
                  </div>
                  {activeSupps.map(supp => (
                    <SuppCard key={supp.id} supp={supp} active accent={phase.color}
                      logged={isSuppLogged(supp.id, suppViewDate)} streak={getSuppStreak(supp.id)}
                      isExp={expandedSupp === supp.id}
                      onToggleLog={() => toggleSuppLog(supp.id, suppViewDate)}
                      onExpand={() => setExpandedSupp(expandedSupp === supp.id ? null : supp.id)}
                      onDeactivate={() => deactivateSupp(supp.id)} />
                  ))}
                  {pendingSupps.length > 0 && (
                    <div style={{ marginTop: activeSupps.length > 0 ? 8 : 0 }}>
                      {activeSupps.length > 0 && <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Not yet started</div>}
                      {pendingSupps.map(supp => (
                        <SuppCard key={supp.id} supp={supp} active={false} accent={phase.color}
                          isExp={expandedSupp === supp.id}
                          onExpand={() => setExpandedSupp(expandedSupp === supp.id ? null : supp.id)}
                          onActivate={() => activateSupp(supp.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {suppView === "time" && TIME_GROUPS.map(group => {
              const groupSupps = SUPPLEMENTS.filter(s => s.time === group.id);
              const activeSupps = groupSupps.filter(s => isSuppActive(s));
              const pendingSupps = groupSupps.filter(s => !isSuppActive(s));
              if (groupSupps.length === 0) return null;
              return (
                <div key={group.id} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 20, color: group.color }}>{group.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{group.label}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{group.sublabel}</div>
                    </div>
                    <div style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>
                      {activeSupps.filter(s => isSuppLogged(s.id, suppViewDate)).length}/{activeSupps.length} taken
                    </div>
                  </div>
                  {activeSupps.map(supp => (
                    <SuppCard key={supp.id} supp={supp} active accent={group.color}
                      logged={isSuppLogged(supp.id, suppViewDate)} streak={getSuppStreak(supp.id)}
                      isExp={expandedSupp === supp.id}
                      onToggleLog={() => toggleSuppLog(supp.id, suppViewDate)}
                      onExpand={() => setExpandedSupp(expandedSupp === supp.id ? null : supp.id)}
                      onDeactivate={() => deactivateSupp(supp.id)} />
                  ))}
                  {pendingSupps.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Pending — activate when purchased</div>
                      {pendingSupps.map(supp => (
                        <SuppCard key={supp.id} supp={supp} active={false} accent={group.color}
                          isExp={expandedSupp === supp.id}
                          onExpand={() => setExpandedSupp(expandedSupp === supp.id ? null : supp.id)}
                          onActivate={() => activateSupp(supp.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "cycles" && (
          <div>
            <PageTitle>Protocol Cycles</PageTitle>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ color: C.accent, fontSize: 18 }}>↻</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Foundation Peptides</span>
                <Badge color={ps?.isOn ? C.accent : C.orange}>{ps ? (ps.isOn ? "ON" : "OFF") : "—"}</Badge>
              </div>
              {ps ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Phase day", `D${ps.dayInPhase}`], ["Days left", ps.daysLeft], ["Cycle #", ps.cycle], ["Next phase", fmtDate(ps.nextDate)]].map(([l, v]) => (
                      <div key={l} style={{ background: "#0a0e1a", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${(ps.pos / ps.cycleLen) * 100}%`, background: ps.isOn ? C.accent : C.orange, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {ps.isOn
                      ? [["BPC-157","250mcg/day"], ["TB-500","2mg 2×/wk"], ["Ipamorelin","200mcg bed"]].map(([n,d]) => <PTag key={n} name={n} dose={d} />)
                      : [["Epithalon","5mg/day×10d"], ["Pinealon","0.1mg/day×10d"]].map(([n,d]) => <PTag key={n} name={n} dose={d} color={C.accentB} />)
                    }
                  </div>
                </>
              ) : <Empty>Set peptide start date in Settings</Empty>}
            </Card>

            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ color: C.purple, fontSize: 18 }}>◎</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Senolytic Pulse</span>
                <Badge color={ss?.due ? C.red : C.purple}>{ss ? (ss.due ? "DUE" : `${ss.left}d`) : "—"}</Badge>
              </div>
              {ss ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Last pulse", fmtDate(data.cycles.senolyticLastDate)], ["Next pulse", fmtDate(ss.next)]].map(([l, v]) => (
                      <div key={l} style={{ background: "#0a0e1a", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 6, background: "#1a2038", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (ss.el / SENOLYTIC_INTERVAL) * 100)}%`, background: ss.due ? C.red : C.purple, borderRadius: 3 }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <PTag name="Fisetin" dose="1000-1500mg×2d" color={C.purple} />
                    <PTag name="Quercetin" dose="1000mg×2d" color={C.purple} />
                  </div>
                  <button style={Tx.btnSmall} onClick={() => { update(d => { d.cycles.senolyticLastDate = todayStr(); }); toast$("Pulse logged!"); }}>
                    ✓ Mark pulse completed today
                  </button>
                </>
              ) : <Empty>Set last senolytic date in Settings</Empty>}
            </Card>

            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ color: C.pink, fontSize: 18 }}>◉</span>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Cognitive — On Demand</span>
                <Badge color={C.pink}>AS NEEDED</Badge>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <PTag name="Semax" dose="200-300mcg nasal" color={C.pink} />
                <PTag name="Selank" dose="250mcg nasal" color={C.pink} />
              </div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Use on low-performance days. Flag with Jack Health re: Foquest interaction.</p>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: C.text }}>⊙ Cycle Settings</div>
              <label style={Tx.label}>Annual workout goal</label>
              <input style={Tx.input} type="number" value={data.workoutGoal} onChange={e => update(d => { d.workoutGoal = parseInt(e.target.value) || 200; })} />
              <label style={Tx.label}>Peptide cycle start date</label>
              <input style={Tx.input} type="date" value={data.cycles.peptideStartDate || ""} onChange={e => update(d => { d.cycles.peptideStartDate = e.target.value; })} />
              <label style={Tx.label}>Last senolytic pulse date</label>
              <input style={Tx.input} type="date" value={data.cycles.senolyticLastDate || ""} onChange={e => update(d => { d.cycles.senolyticLastDate = e.target.value; })} />
            </Card>
          </div>
        )}

        {/* ── WORKOUT ── */}
        {tab === "workout" && (
          <div>
            <PageTitle>Workouts</PageTitle>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Goal: {data.workoutGoal} days</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.pink }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${C.pink},${C.purple})`, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{workoutsYTD.length} logged · {Math.max(0, data.workoutGoal - workoutsYTD.length)} to go</div>
            </div>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Log a Workout</div>
              <label style={Tx.label}>Date</label>
              <input style={Tx.input} type="date" value={wDate} onChange={e => setWDate(e.target.value)} />
              <label style={Tx.label}>Workout type</label>
              <input style={Tx.input} placeholder="e.g. Strength, Run, Yoga, HIIT..." value={wType} onChange={e => setWType(e.target.value)} />
              <label style={Tx.label}>Notes (optional)</label>
              <textarea style={{ ...Tx.input, height: 72, resize: "vertical" }} placeholder="Duration, sets, how you felt..." value={wNotes} onChange={e => setWNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logWorkout}>Log Workout</button>
            </Card>
            <SectionTitle>History</SectionTitle>
            {data.workouts.length === 0
              ? <Empty>No workouts yet</Empty>
              : data.workouts.map(w => (
                <Row key={w.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(w.date)}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{w.type}</span>
                  {w.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1 }}>{w.notes}</span>}
                  <button style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }} onClick={() => update(d => { d.workouts = d.workouts.filter(x => x.id !== w.id); })}>×</button>
                </Row>
              ))}
          </div>
        )}

        {/* ── NUTRITION / FUEL ── */}
        {tab === "nutrition" && (() => {
          const today = todayStr();
          const dayType = getDayType(today);
          const plan = NUTRITION_PLANS[dayType];
          const goal = data.proteinGoal || PROTEIN_GOAL_DEFAULT;
          const todayLog = data.nutritionLogs[today] || {};
          const planTotal = plan.slots.reduce((s, x) => s + x.protein, 0);
          const consumed = plan.slots.reduce((s, x) => s + (todayLog[x.id] ? x.protein : 0), 0);
          const goalPct = Math.min(100, Math.round((consumed / goal) * 100));
          const planCarbs = plan.slots.reduce((s, x) => s + (x.carbs || 0), 0);
          const carbPct = Math.min(100, Math.round((planCarbs / CARB_CEILING) * 100));

          const toggleSlot = (slot) => {
            if (slot.source === "none") return; // training/cardio events aren't loggable
            update(d => {
              if (!d.nutritionLogs[today]) d.nutritionLogs[today] = {};
              if (d.nutritionLogs[today][slot.id]) delete d.nutritionLogs[today][slot.id];
              else d.nutritionLogs[today][slot.id] = true;
            });
          };

          return (
            <div>
              <PageTitle>Fuel</PageTitle>

              {/* Daily protein hero */}
              <div style={{ background: "linear-gradient(135deg,#1a0e2e,#0d1220)", border: `1px solid ${plan.color}40`, borderRadius: 20, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Today · Protein</div>
                    <div style={{ fontSize: 44, fontWeight: 900, color: plan.color, lineHeight: 1, letterSpacing: "-0.03em" }}>
                      {consumed}<span style={{ fontSize: 20, color: C.muted, fontWeight: 700 }}> / {goal}g</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28 }}>{plan.icon}</div>
                    <div style={{ fontSize: 12, color: plan.color, fontWeight: 700, marginTop: 2 }}>{plan.label}</div>
                  </div>
                </div>
                <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${goalPct}%`, background: `linear-gradient(90deg,${plan.color},${C.purple})`, borderRadius: 4, transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {goalPct}% of goal · plan delivers {planTotal}g · {Math.max(0, goal - consumed)}g to go
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: C.muted, minWidth: 38 }}>Carbs</span>
                  <div style={{ flex: 1, height: 5, background: "#1a2038", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${carbPct}%`, background: planCarbs > CARB_CEILING ? C.orange : C.accentB, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: planCarbs > CARB_CEILING ? C.orange : C.subtle }}>{planCarbs} / {CARB_CEILING}g</span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: C.subtle, lineHeight: 1.5, padding: "0 4px 4px", marginBottom: 4 }}>{plan.note}</div>

              <SectionTitle>{plan.sublabel}</SectionTitle>
              {plan.slots.map(slot => {
                const isEvent = slot.source === "none";
                const done = !isEvent && !!todayLog[slot.id];
                const src = PROTEIN_SOURCE_META[slot.source];
                return (
                  <div key={slot.id} onClick={() => toggleSlot(slot)}
                    style={{ display: "flex", alignItems: "center", gap: 12, background: done ? src.color + "12" : (isEvent ? "#0a0e1a" : C.surface), border: `1px solid ${done ? src.color + "50" : C.border}`, borderRadius: 14, padding: "13px 16px", marginBottom: 8, cursor: isEvent ? "default" : "pointer", opacity: isEvent ? 0.72 : 1, transition: "all .15s" }}>
                    {isEvent ? (
                      <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{plan.icon}</div>
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${done ? src.color : C.muted}`, background: done ? src.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {done && <span style={{ color: "#000", fontSize: 13, fontWeight: 900 }}>✓</span>}
                      </div>
                    )}
                    <div style={{ minWidth: 56 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: done ? C.text : C.subtle }}>{slot.time}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{slot.label}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{slot.detail}</div>
                    </div>
                    {!isEvent && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: done ? src.color : C.muted }}>{slot.protein}g</div>
                        <div style={{ fontSize: 9, color: C.muted }}>{slot.carbs || 0}g carb</div>
                      </div>
                    )}
                  </div>
                );
              })}

              <SectionTitle>Weekly Structure</SectionTitle>
              {Object.values(NUTRITION_PLANS).map(p => {
                const t = p.slots.reduce((s, x) => s + x.protein, 0);
                const c = p.slots.reduce((s, x) => s + (x.carbs || 0), 0);
                const isToday = p.id === dayType;
                return (
                  <Row key={p.id}>
                    <span style={{ fontSize: 18, minWidth: 26 }}>{p.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? p.color : C.text }}>{p.label}</span>
                      {isToday && <span style={{ fontSize: 9, color: p.color, marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Today</span>}
                      <div style={{ fontSize: 11, color: C.muted }}>{p.sublabel}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{t}g <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>protein</span></div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c > CARB_CEILING ? C.orange : C.subtle }}>{c}g carb</div>
                    </div>
                  </Row>
                );
              })}

              <SectionTitle>Protein Target</SectionTitle>
              <Card>
                <label style={Tx.label}>Daily goal (grams)</label>
                <input style={Tx.input} type="number" value={data.proteinGoal || PROTEIN_GOAL_DEFAULT}
                  onChange={e => update(d => { d.proteinGoal = parseInt(e.target.value) || PROTEIN_GOAL_DEFAULT; })} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Set to 1g per lb bodyweight — currently 180g for 180lb.</div>
              </Card>
            </div>
          );
        })()}

        {/* ── CHECK-IN ── */}
        {tab === "checkin" && (
          <div>
            <PageTitle>Daily Check-In</PageTitle>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>How are you today?</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setCiEnergy(n)}
                    style={{ flex: 1, background: ciEnergy === n ? C.accent + "20" : "#0a0e1a", border: `1px solid ${ciEnergy === n ? C.accent + "60" : C.border}`, borderRadius: 12, padding: "12px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>{["😴","😕","😐","😊","🔥"][n-1]}</span>
                    <span style={{ fontSize: 9, color: ciEnergy === n ? C.text : C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{["Low","Below","Avg","Good","Peak"][n-1]}</span>
                  </button>
                ))}
              </div>
              <textarea style={{ ...Tx.input, height: 90, resize: "vertical" }} placeholder="Notes — energy, mood, recovery, protocol observations..." value={ciNotes} onChange={e => setCiNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logCheckin}>Save Check-In</button>
            </Card>
            <SectionTitle>Recent Check-Ins</SectionTitle>
            {data.checkins.length === 0
              ? <Empty>No check-ins yet</Empty>
              : data.checkins.slice(0, 14).map(c => (
                <Row key={c.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(c.date)}</span>
                  <span style={{ fontSize: 16 }}>{["😴","😕","😐","😊","🔥"][c.energy-1]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{["Low","Below avg","Average","Good","Peak"][c.energy-1]}</span>
                  {c.notes && <span style={{ fontSize: 12, color: C.subtle, flex: 1 }}>{c.notes}</span>}
                </Row>
              ))}
          </div>
        )}

        {/* ── BIOMARKERS / LABS ── */}
        {tab === "bio" && (
          <div>
            <PageTitle>Labs & Biomarkers</PageTitle>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Upload Dynacare PDF</div>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Upload your lab PDF and AI will extract all values automatically.</p>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePDF} />
              <button style={{ ...Tx.btnPrimary, background: pdfLoading ? "#1a2038" : `linear-gradient(135deg,${C.accentB},${C.accent})` }}
                onClick={() => !pdfLoading && fileRef.current.click()}
                disabled={pdfLoading}>
                {pdfLoading ? "Reading PDF..." : "📄 Upload Blood Test PDF"}
              </button>
            </Card>
            {pdfResult && pdfResult.length > 0 && (
              <PDFResultsPanel results={pdfResult} onImport={importPDFResults} onDismiss={() => setPdfResult(null)} />
            )}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Manual Entry</div>
              <label style={Tx.label}>Test type</label>
              <select style={Tx.input} value={bType} onChange={e => setBType(e.target.value)}>
                {["GlycanAge","TruAge","Biological Age (Oura)","DEXA — Body Fat %","DEXA — Lean Mass (kg)","Testosterone (nmol/L)","Free Testosterone","Estradiol","SHBG","HRV (ms)","B1","B12","B5","Copper","Cortisol","Thyroid (TSH)","ApoB","Homocysteine","hsCRP","25-OH-D","1,25-OH-D","Other"].map(o => <option key={o}>{o}</option>)}
              </select>
              <label style={Tx.label}>Value</label>
              <input style={Tx.input} placeholder="e.g. 34 or 5.2 mmol/L" value={bValue} onChange={e => setBValue(e.target.value)} />
              <label style={Tx.label}>Date</label>
              <input style={Tx.input} type="date" value={bDate} onChange={e => setBDate(e.target.value)} />
              <label style={Tx.label}>Notes (optional)</label>
              <input style={Tx.input} placeholder="Reference range, context..." value={bNotes} onChange={e => setBNotes(e.target.value)} />
              <button style={Tx.btnPrimary} onClick={logBiomarker}>Save Result</button>
            </Card>
            <SectionTitle>History</SectionTitle>
            {data.biomarkers.length === 0
              ? <Empty>No results yet — upload a PDF or add manually</Empty>
              : data.biomarkers.map(b => (
                <Row key={b.id}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 90 }}>{fmtDate(b.date)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{b.type}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{b.value}</span>
                  <button style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }} onClick={() => update(d => { d.biomarkers = d.biomarkers.filter(x => x.id !== b.id); })}>×</button>
                </Row>
              ))}
          </div>
        )}

        {/* ── PROTOCOL ── */}
        {tab === "protocol" && (
          <div>
            <PageTitle>Protocol Actions</PageTitle>

            {/* Progress summary */}
            <div style={{ background: "linear-gradient(135deg,#0a1e3d,#071428)", border: `1px solid #1e3060`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Completion</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>{protocolPct}%</span>
              </div>
              <div style={{ height: 8, background: "#1a2038", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${protocolPct}%`, background: `linear-gradient(90deg,${C.accent},${C.accentB})`, borderRadius: 4, transition: "width 0.6s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{completedActions} of {totalActions} actions complete · Based on 3x4 Genetics Blueprint</div>
            </div>

            {/* Category tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {PROTOCOL_CATEGORIES.map(cat => {
                const catComplete = cat.actions.filter(a => data.protocolActions?.[a.id]).length;
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    style={{ flexShrink: 0, background: isActive ? cat.color + "20" : "#0a0e1a", border: `1px solid ${isActive ? cat.color + "60" : C.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 16, color: isActive ? cat.color : C.muted }}>{cat.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? cat.color : C.muted, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{cat.label}</span>
                    <span style={{ fontSize: 9, color: C.muted }}>{catComplete}/{cat.actions.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions list */}
            {PROTOCOL_CATEGORIES.find(c => c.id === activeCategory)?.actions.map(action => {
              const isComplete = data.protocolActions?.[action.id];
              const isExpanded = expandedAction === action.id;
              const cat = PROTOCOL_CATEGORIES.find(c => c.id === activeCategory);

              return (
                <div key={action.id} style={{ background: C.surface, border: `1px solid ${isComplete ? C.accent + "30" : C.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden", transition: "border-color 0.2s" }}>
                  {/* Action header — tap to expand */}
                  <div style={{ padding: "16px 16px 0", cursor: "pointer" }} onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                      {/* Checkbox */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleActionComplete(action.id); }}
                        style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isComplete ? C.accent : C.muted}`, background: isComplete ? C.accent + "20" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        {isComplete && <span style={{ color: C.accent, fontSize: 13, fontWeight: 900 }}>✓</span>}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isComplete ? C.muted : C.text, textDecoration: isComplete ? "line-through" : "none", flex: 1, minWidth: 160 }}>
                            {action.title}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: action.urgencyColor + "20", color: action.urgencyColor, border: `1px solid ${action.urgencyColor}40`, letterSpacing: "0.08em", flexShrink: 0 }}>
                            {action.urgency}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{action.shortDesc}</div>
                      </div>
                    </div>

                    {/* Pathways */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                      {action.pathways.map(p => (
                        <span key={p} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: "#0a0e1a", color: C.muted, border: `1px solid ${C.border}`, letterSpacing: "0.04em" }}>{p}</span>
                      ))}
                    </div>

                    {/* Expand toggle */}
                    <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em" }}>{isExpanded ? "HIDE DETAILS" : "TAP FOR FULL DETAILS"}</span>
                      <span style={{ color: C.muted, fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${C.border}`, background: "#0a0e1a" }}>

                      {/* Why */}
                      <div style={{ padding: "16px 16px 0" }}>
                        <div style={{ fontSize: 10, color: cat.color, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Why This Matters For You</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{action.why}</div>
                      </div>

                      {/* What */}
                      <div style={{ padding: "14px 16px 0" }}>
                        <div style={{ fontSize: 10, color: C.accentB, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>What To Take / Do</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>{action.what}</div>
                      </div>

                      {/* Timing */}
                      <div style={{ padding: "14px 16px 0" }}>
                        <div style={{ fontSize: 10, color: C.accent, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Timing</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{action.timing}</div>
                      </div>

                      {/* Brands */}
                      <div style={{ padding: "14px 16px 0" }}>
                        <div style={{ fontSize: 10, color: C.purple, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Brands / Sources</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{action.brands}</div>
                      </div>

                      {/* Note */}
                      {action.note && (
                        <div style={{ margin: "14px 16px 0", background: C.orange + "10", border: `1px solid ${C.orange}30`, borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, color: C.orange, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>⚑ Important Note</div>
                          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{action.note}</div>
                        </div>
                      )}

                      {/* Mark complete button */}
                      <div style={{ padding: 16 }}>
                        <button
                          style={{ ...isComplete ? Tx.btnSmall : Tx.btnPrimary, width: "100%" }}
                          onClick={() => toggleActionComplete(action.id)}>
                          {isComplete ? "✓ Completed — Tap to Undo" : "Mark as Complete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 env(safe-area-inset-bottom,8px)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === t.id ? C.accent : C.muted }}>
            <span style={{ fontSize: tab === "protocol" && t.id === "protocol" ? 14 : 18 }}>{t.id === "protocol" ? "⬢" : t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 500, letterSpacing: "0.04em" }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── PDF Results Panel ─────────────────────────────────────────────────────
function PDFResultsPanel({ results, onImport, onDismiss }) {
  const [selected, setSelected] = useState(new Set(results.map((_, i) => i)));
  const toggle = i => setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  const flagColor = f => f === "H" ? "#ff8c42" : f === "L" ? "#60a5fa" : C.subtle;

  return (
    <div style={{ background: "#0a1428", border: `1px solid ${C.accentB}40`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>PDF Results Found</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{results.length} values extracted · {selected.size} selected</div>
        </div>
        <button style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }} onClick={onDismiss}>×</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 14 }}>
        {results.map((r, i) => (
          <div key={i} onClick={() => toggle(i)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, marginBottom: 6, background: selected.has(i) ? "#0d2040" : "#0a0e1a", border: `1px solid ${selected.has(i) ? C.accentB + "40" : C.border}`, cursor: "pointer" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: selected.has(i) ? C.accentB : "transparent", border: `2px solid ${selected.has(i) ? C.accentB : C.muted}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selected.has(i) && <span style={{ color: "#000", fontSize: 11, fontWeight: 900 }}>✓</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.name}</div>
              {r.reference && <div style={{ fontSize: 11, color: C.muted }}>Ref: {r.reference}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: r.flag && r.flag !== "normal" ? flagColor(r.flag) : C.accent }}>{r.value} {r.unit}</div>
              {r.flag && r.flag !== "normal" && <div style={{ fontSize: 10, fontWeight: 700, color: flagColor(r.flag) }}>{r.flag === "H" ? "HIGH" : "LOW"}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...Tx.btnSmall, flex: 1 }} onClick={() => setSelected(new Set(results.map((_, i) => i)))}>Select all</button>
        <button style={{ ...Tx.btnPrimary, flex: 2 }} onClick={() => onImport(results.filter((_, i) => selected.has(i)))}>
          Import {selected.size} results
        </button>
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────
function SuppCard({ supp, accent, logged, streak, isExp, onToggleLog, onExpand, onActivate, onDeactivate, active }) {
  const srcColor = supp.source === "ownit" ? C.accentB : supp.source === "standalone" ? C.pink : C.accent;
  const srcLabel = supp.source === "ownit" ? "OwnIt" : supp.source === "standalone" ? "Standalone" : "Protocol";
  if (active) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${logged ? C.accent + "40" : C.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <button onClick={onToggleLog}
              style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${logged ? C.accent : C.muted}`, background: logged ? C.accent + "25" : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {logged && <span style={{ color: C.accent, fontSize: 14, fontWeight: 900 }}>✓</span>}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: logged ? C.muted : C.text, textDecoration: logged ? "line-through" : "none" }}>{supp.label}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: srcColor + "20", color: srcColor, border: `1px solid ${srcColor}40`, letterSpacing: "0.06em" }}>{srcLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{supp.dose} · {supp.form}</div>
            </div>
            {streak > 0 && <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 16 }}>🔥</div>
              <div style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>{streak}d</div>
            </div>}
          </div>
          <div onClick={onExpand}
            style={{ borderTop: `1px solid ${C.border}`, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>{isExp ? "HIDE" : "WHY & HOW"}</span>
            <span style={{ color: C.muted, fontSize: 11, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
          </div>
        </div>
        {isExp && (
          <div style={{ borderTop: `1px solid ${C.border}`, background: "#0a0e1a", padding: 14 }}>
            <div style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Why In Your Stack</div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 12 }}>{supp.why}</div>
            <div style={{ fontSize: 10, color: C.accentB, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Targets</div>
            <div style={{ fontSize: 12, color: C.text, marginBottom: 12 }}>{supp.target}</div>
            {supp.note && <div style={{ background: C.orange + "10", border: `1px solid ${C.orange}30`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>⚑ Note</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{supp.note}</div>
            </div>}
            {supp.status !== "active" && <button style={{ background: "#1a2038", color: C.red, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 12 }} onClick={onDeactivate}>Set back to pending</button>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ background: "#0a0c14", border: `1px dashed ${C.border}`, borderRadius: 14, marginBottom: 8, overflow: "hidden", opacity: 0.78 }}>
      <div style={{ padding: "12px 14px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, border: `2px dashed ${C.muted}`, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>{supp.label}</span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: C.muted + "20", color: C.muted, border: `1px solid ${C.muted}40`, letterSpacing: "0.06em" }}>PENDING</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3, opacity: 0.7 }}>{supp.dose} · {supp.form}</div>
          </div>
          <button onClick={onActivate}
            style={{ background: C.accent + "15", border: `1px solid ${C.accent}40`, borderRadius: 8, color: C.accent, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            Activate
          </button>
        </div>
        <div onClick={onExpand}
          style={{ borderTop: `1px solid ${C.border}`, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>{isExp ? "HIDE" : "WHY & HOW"}</span>
          <span style={{ color: C.muted, fontSize: 11, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
        </div>
      </div>
      {isExp && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: "#070910", padding: 14 }}>
          <div style={{ fontSize: 10, color: C.orange, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Why This Belongs In Your Stack</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 12 }}>{supp.why}</div>
          <div style={{ fontSize: 10, color: C.accentB, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>Targets</div>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 12 }}>{supp.target}</div>
          {supp.note && <div style={{ background: C.orange + "10", border: `1px solid ${C.orange}30`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>⚑ Note</div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{supp.note}</div>
          </div>}
          <button style={{ background: `linear-gradient(135deg,${C.accent},${C.accentB})`, color: "#000", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }} onClick={onActivate}>
            ✓ I've purchased this — start tracking
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, val, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 18, color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 3 }}>{val}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </div>
  );
}

function Badge({ color, children }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: color + "20", color, border: `1px solid ${color}40`, letterSpacing: "0.05em" }}>{children}</span>;
}

function PTag({ name, dose, color = C.accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "7px 12px", borderRadius: 8, background: color + "15", border: `1px solid ${color}30`, color }}>
      <span style={{ fontWeight: 700, fontSize: 12 }}>{name}</span>
      <span style={{ fontSize: 10, opacity: 0.8 }}>{dose}</span>
    </div>
  );
}

function Card({ children }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>{children}</div>;
}

function Row({ children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>{children}</div>;
}

function PageTitle({ children }) {
  return <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 16px", letterSpacing: "-0.02em" }}>{children}</h1>;
}

function SectionTitle({ children }) {
  return <h2 style={{ fontSize: 14, fontWeight: 700, color: C.subtle, margin: "20px 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</h2>;
}

function Empty({ children }) {
  return <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>{children}</p>;
}

const Tx = {
  label: { display: "block", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, marginTop: 12 },
  input: { display: "block", width: "100%", background: "#0a0e1a", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "11px 14px", fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  btnPrimary: { background: `linear-gradient(135deg,${C.accent},${C.accentB})`, color: "#000", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", letterSpacing: "0.02em" },
  btnSmall: { background: "#1a2038", color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
