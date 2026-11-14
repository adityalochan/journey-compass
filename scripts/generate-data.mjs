/**
 * Generates a realistic sample cohort for Continuity.
 *
 * The real Art of Living sample data can replace this file's output directly:
 * all downstream logic reads the Participant shape in src/types.ts.
 *
 * Run: npm run data
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/participants.json");

// Fixed "today" so the demo is stable no matter when it is run.
const NOW = new Date("2026-11-14T09:00:00-05:00");

const iso = (d) => new Date(d).toISOString();
const daysAgo = (n, hour = 11) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, [0, 15, 30, 45][n % 4], 0, 0);
  return d.toISOString().slice(0, 10);
};
const at = (dayIso, hour = 10, minute = 30) =>
  `${dayIso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`;

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const CITIES = [
  { city: "Toronto", province: "ON", area: "416", weight: 16 },
  { city: "Mississauga", province: "ON", area: "905", weight: 12 },
  { city: "Brampton", province: "ON", area: "905", weight: 10 },
  { city: "Scarborough", province: "ON", area: "416", weight: 5 },
  { city: "Markham", province: "ON", area: "905", weight: 4 },
  { city: "Ottawa", province: "ON", area: "613", weight: 6 },
  { city: "Hamilton", province: "ON", area: "905", weight: 3 },
  { city: "Vancouver", province: "BC", area: "604", weight: 8 },
  { city: "Surrey", province: "BC", area: "604", weight: 6 },
  { city: "Burnaby", province: "BC", area: "604", weight: 3 },
  { city: "Victoria", province: "BC", area: "250", weight: 2 },
  { city: "Calgary", province: "AB", area: "403", weight: 6 },
  { city: "Edmonton", province: "AB", area: "780", weight: 4 },
  { city: "Winnipeg", province: "MB", area: "204", weight: 3 },
  { city: "Halifax", province: "NS", area: "902", weight: 3 },
  { city: "Montreal", province: "QC", area: "514", weight: 8 },
  { city: "Quebec City", province: "QC", area: "418", weight: 3 },
  { city: "Laval", province: "QC", area: "450", weight: 2 },
];

const COORDINATORS = [
  { name: "Anita Rao", city: "Toronto" },
  { name: "Ravi Menon", city: "Mississauga" },
  { name: "Meera Iyer", city: "Brampton" },
  { name: "Sophie Gagnon", city: "Montreal" },
  { name: "Harpreet Gill", city: "Surrey" },
  { name: "Linda Park", city: "Vancouver" },
  { name: "David Chen", city: "Calgary" },
  { name: "Fatima Noor", city: "Ottawa" },
];

const PROGRAMS = {
  sky: { name: "SKY Breath Meditation", short: "SKY" },
  part2: { name: "SKY Part 2", short: "Part 2" },
  sahaj: { name: "Sahaj Samadhi Meditation", short: "Sahaj" },
  silence: { name: "Silence Retreat", short: "Silence Retreat" },
  yoga: { name: "Sri Sri Yoga Level 1", short: "Yoga" },
  yes: { name: "YES! for Youth", short: "YES!" },
  arts: { name: "Art of Silence", short: "Art of Silence" },
};

const EVENT_TYPES = ["followup", "satsang", "seva", "retreat", "intro", "wcf", "celebration"];
const EVENT_NAMES = {
  followup: ["Follow-up session", "Weekly follow-up", "Practice circle"],
  satsang: ["Satsang", "Full Moon Meditation", "Guru Purnima celebration"],
  seva: ["Community kitchen seva", "Centre cleaning seva", "Event seva day"],
  retreat: ["Weekend retreat", "Art of Silence weekend"],
  intro: ["Intro talk", "Discover Meditation evening"],
  wcf: ["World Culture Festival volunteer", "WCF planning meet"],
  celebration: ["Navratri celebration", "Diwali satsang"],
};

const SKILLS = [
  "cooking", "event logistics", "graphic design", "teaching", "IT support",
  "photography", "finance", "music", "translation", "driving", "social media",
  "gardening", "first aid", "video editing", "registration desk",
];

const FIRST = [
  "Arjun", "Meera", "Kavita", "Rohit", "Simran", "Harleen", "Jaspreet", "Manpreet",
  "Aditi", "Vikram", "Anjali", "Rohan", "Deepa", "Sanjay", "Nisha", "Kiran", "Aarti",
  "Sameer", "Pooja", "Rahul", "Isabelle", "Jean-François", "Camille", "Étienne",
  "Marie-Claude", "Geneviève", "Alexandre", "Chloé", "Mathieu", "Audrey", "Emily",
  "Michael", "Sarah", "Jessica", "Ryan", "Ashley", "Brandon", "Nicole", "Kevin",
  "Laura", "Rachel", "Adam", "Michelle", "Steven", "Amanda", "Christina", "Patrick",
  "Vanessa", "Jonathan", "Rebecca", "Olivia", "Ethan", "Grace", "Henry", "Julia",
  "Marcus", "Naomi", "Owen", "Tessa", "Yusuf", "Fatima", "Omar", "Layla", "Ahmed",
  "Zara", "Mei", "Lin", "Jia", "Min", "Jun", "Suki", "Carlos", "Maria", "Diego",
  "Lucia", "Ana", "Paolo", "Giulia", "Kwame", "Abena", "Chidi", "Ngozi", "Sofia",
  "Elena", "Dmitri", "Anna",
];

const LAST = [
  "Sharma", "Patel", "Singh", "Kaur", "Gill", "Dhillon", "Sidhu", "Mehta", "Shah",
  "Desai", "Iyer", "Nair", "Reddy", "Rao", "Kapoor", "Malhotra", "Chopra", "Banerjee",
  "Das", "Bose", "Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin",
  "Lavoie", "Fortin", "Ouellet", "Smith", "Johnson", "Brown", "Wilson", "Taylor",
  "Anderson", "Thomas", "Moore", "Martin", "Jackson", "White", "Harris", "Clark",
  "Lewis", "Walker", "Hall", "Young", "King", "Wright", "Scott", "Green", "Baker",
  "Adams", "Nelson", "Hill", "Campbell", "Mitchell", "Roberts", "Carter", "Phillips",
  "Evans", "Turner", "Parker", "Collins", "Edwards", "Stewart", "Morris", "Murphy",
  "Cook", "Rogers", "Morgan", "Cooper", "Peterson", "Reed", "Bailey", "Bell", "Kelly",
  "Diaz", "Rivera", "Torres", "Flores", "Gomez", "Morales", "Reyes", "Cruz",
  "Mendoza", "Castillo", "Santos", "Bautista", "Ramos", "Aquino", "Garcia", "Lopez",
  "Martinez", "Hernandez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Chen", "Wang",
  "Li", "Zhang", "Liu", "Yang", "Huang", "Wu", "Zhou", "Xu", "Ho", "Lam", "Cheung",
  "Wong", "Leung", "Osei", "Mensah", "Boateng", "Adeyemi", "Okonkwo", "Mwangi",
  "Okafor", "Abebe", "Tesfaye", "Diallo",
];

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

let seed = 20261114;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p) => rnd() < p;

function weightedCity() {
  const total = CITIES.reduce((s, c) => s + c.weight, 0);
  let r = rnd() * total;
  for (const c of CITIES) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return CITIES[0];
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

const usedNames = new Set();

function makeName(language) {
  const pools = {
    fr: [
      ["Isabelle", "Camille", "Étienne", "Marie-Claude", "Geneviève", "Alexandre", "Chloé", "Mathieu", "Audrey", "Jean-François"],
      ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Ouellet"],
    ],
    hi: [
      ["Arjun", "Meera", "Kavita", "Rohit", "Aditi", "Vikram", "Anjali", "Rohan", "Deepa", "Sanjay"],
      ["Sharma", "Patel", "Mehta", "Shah", "Desai", "Iyer", "Nair", "Reddy", "Rao", "Kapoor"],
    ],
    pa: [
      ["Simran", "Harleen", "Jaspreet", "Manpreet", "Gurpreet", "Amanpreet", "Navjot", "Sukhdeep"],
      ["Singh", "Kaur", "Gill", "Dhillon", "Sidhu", "Sandhu", "Bains", "Randhawa"],
    ],
    zh: [
      ["Mei", "Lin", "Jia", "Min", "Jun", "Suki", "Wei", "Xiao"],
      ["Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Huang", "Wong", "Lam"],
    ],
    ta: [
      ["Kavitha", "Suresh", "Priya", "Arun", "Lakshmi", "Bala"],
      ["Iyer", "Nair", "Reddy", "Rao", "Subramaniam", "Krishnan"],
    ],
  };
  const pool = pools[language] || [FIRST, LAST];
  for (let i = 0; i < 60; i++) {
    const first = pick(pool[0]);
    const last = pick(pool[1]);
    const key = `${first} ${last}`;
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return [first, last];
    }
    // fall through to generic pools
    const f2 = pick(FIRST);
    const l2 = pick(LAST);
    if (!usedNames.has(`${f2} ${l2}`)) {
      usedNames.add(`${f2} ${l2}`);
      return [f2, l2];
    }
  }
  const n = usedNames.size;
  usedNames.add(`Extra ${n}`);
  return ["Kiran", LAST[n % LAST.length]];
}

function makeEmail(first, last, i, province) {
  const clean = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const f = clean(first);
  const l = clean(last);
  const domains = province === "QC"
    ? ["videotron.ca", "sympatico.ca", "gmail.com", "outlook.com"]
    : ["gmail.com", "outlook.com", "yahoo.ca", "icloud.com"];
  const style = i % 4;
  if (style === 0) return `${f}.${l}@${pick(domains)}`;
  if (style === 1) return `${f}${l}${int(11, 89)}@${pick(domains)}`;
  if (style === 2) return `${f[0]}${l}@${pick(domains)}`;
  return `${f}_${l}@${pick(domains)}`;
}

function course(programId, dayIso, city, teacher) {
  return {
    programId,
    name: PROGRAMS[programId].name,
    completedAt: dayIso,
    city,
    teacher,
  };
}

function event(type, dayIso, city) {
  return {
    name: pick(EVENT_NAMES[type]),
    type,
    date: dayIso,
    city,
  };
}

function contact(dayIso, channel, direction, summary) {
  return { at: at(dayIso), channel, direction, summary };
}

function engagementSignals(level, opts = {}) {
  // level 0..100
  const jitter = (n) => Math.max(0, Math.round(n + (rnd() * 4 - 2)));
  const base = level / 100;
  return {
    appOpens30d: jitter(base * 14),
    emailOpens30d: opts.emailHeavy ? jitter(base * 8 + 4) : jitter(base * 7),
    whatsappReplies30d: opts.emailHeavy ? 0 : jitter(base * 5),
    videoMinutes30d: jitter(base * 55 + (opts.videoHeavy ? 20 : 0)),
  };
}

function signalsToLevel(s) {
  return Math.round(
    Math.min(
      100,
      s.appOpens30d * 3.2 +
        s.emailOpens30d * 2.4 +
        s.whatsappReplies30d * 5 +
        s.videoMinutes30d * 0.55
    )
  );
}

/* ------------------------------------------------------------------ */
/* Heroes — hand-authored for the demo                                 */
/* ------------------------------------------------------------------ */

const HEROES = [
  {
    id: "p_001",
    firstName: "Priya",
    lastName: "Raman",
    city: "Mississauga",
    province: "ON",
    area: "905",
    language: "en",
    assignedTo: "Anita Rao",
    joinedAt: daysAgo(251),
    courses: [course("sky", daysAgo(251), "Mississauga", "Anita Rao")],
    events: [
      event("followup", daysAgo(230), "Mississauga"),
      event("followup", daysAgo(202), "Mississauga"),
      event("satsang", daysAgo(174), "Mississauga"),
    ],
    invites: 7,
    contacts: [
      contact(daysAgo(188), "whatsapp", "out", "Sent the 40-day practice sheet"),
      contact(daysAgo(174), "in_person", "in", "Came to satsang, stayed for tea"),
      contact(daysAgo(120), "whatsapp", "out", "Shared the Sahaj Samadhi dates"),
      contact(daysAgo(88), "whatsapp", "out", "Checked in after the 40-day practice — said work got busy"),
    ],
    signals: { appOpens30d: 3, emailOpens30d: 2, whatsappReplies30d: 0, videoMinutes30d: 18 },
    skills: ["event logistics", "social media", "cooking"],
    interests: ["meditation", "seva"],
    notes: [
      "Said the 40-day practice changed how she handles stress at work.",
      "Started a new job in September — evenings are her only free time.",
    ],
    archetype: "slipping",
    hero: "priya",
  },
  {
    id: "p_002",
    firstName: "Marc",
    lastName: "Lefèvre",
    city: "Montreal",
    province: "QC",
    area: "514",
    language: "fr",
    assignedTo: "Sophie Gagnon",
    joinedAt: daysAgo(363),
    courses: [course("sky", daysAgo(363), "Montreal", "Sophie Gagnon")],
    events: [event("satsang", daysAgo(335), "Montreal"), event("followup", daysAgo(300), "Montreal")],
    invites: 5,
    contacts: [
      contact(daysAgo(330), "email", "out", "Bienvenue au groupe de pratique"),
      contact(daysAgo(121), "email", "out", "Invitation à la retraite de décembre"),
      contact(daysAgo(121), "email", "in", "A répondu : peut-être, à discuter avec sa conjointe"),
    ],
    signals: { appOpens30d: 1, emailOpens30d: 5, whatsappReplies30d: 0, videoMinutes30d: 6 },
    skills: ["finance", "translation"],
    interests: ["retreats", "meditation"],
    notes: [
      "Prefers French — his English is fine, but he opens up in French.",
      "Asked about a retreat he could do with his partner.",
    ],
    archetype: "drifting",
    hero: "marc",
  },
  {
    id: "p_003",
    firstName: "Amrit",
    lastName: "Kaur",
    city: "Brampton",
    province: "ON",
    area: "905",
    language: "pa",
    assignedTo: "Anita Rao",
    joinedAt: daysAgo(552),
    courses: [
      course("sky", daysAgo(552), "Brampton", "Anita Rao"),
      course("part2", daysAgo(511), "Brampton", "Anita Rao"),
    ],
    events: [
      event("seva", daysAgo(463), "Brampton"),
      event("seva", daysAgo(402), "Brampton"),
      event("satsang", daysAgo(305), "Brampton"),
      event("seva", daysAgo(281), "Brampton"),
    ],
    invites: 9,
    contacts: [
      contact(daysAgo(281), "in_person", "in", "Led the kitchen team at the February seva day"),
      contact(daysAgo(160), "whatsapp", "out", "Asked if she'd like to take Part 3"),
      contact(daysAgo(65), "whatsapp", "in", "Said she wants to serve more but doesn't want another course right now"),
    ],
    signals: { appOpens30d: 5, emailOpens30d: 6, whatsappReplies30d: 2, videoMinutes30d: 30 },
    skills: ["cooking", "event logistics", "teaching"],
    interests: ["seva", "community"],
    notes: [
      "Runs the langar kitchen team at the Brampton centre.",
      "Wants to serve more, but doesn't want to be 'sold' another course.",
    ],
    archetype: "slipping",
    hero: "amrit",
  },
  {
    id: "p_004",
    firstName: "Daniel",
    lastName: "Osei",
    city: "Toronto",
    province: "ON",
    area: "416",
    language: "en",
    assignedTo: "Anita Rao",
    joinedAt: daysAgo(8),
    courses: [course("sky", daysAgo(8), "Toronto", "Anita Rao")],
    events: [],
    invites: 1,
    contacts: [
      contact(daysAgo(8), "in_person", "in", "Completed the course — asked about the 40-day practice"),
      contact(daysAgo(5), "phone", "out", "Welcome call, walked him through the app"),
      contact(daysAgo(5), "whatsapp", "in", "Sent a voice note: 'slept better than I have in months'"),
    ],
    signals: { appOpens30d: 9, emailOpens30d: 5, whatsappReplies30d: 3, videoMinutes30d: 42 },
    skills: ["IT support", "photography"],
    interests: ["meditation", "community"],
    notes: ["Came with two friends from work.", "Asked about the 40-day practice app."],
    archetype: "new",
    hero: "daniel",
  },
  {
    id: "p_005",
    firstName: "Wei",
    lastName: "Chen",
    city: "Vancouver",
    province: "BC",
    area: "604",
    language: "zh",
    assignedTo: "Linda Park",
    joinedAt: daysAgo(790),
    courses: [
      course("sky", daysAgo(790), "Vancouver", "Linda Park"),
      course("part2", daysAgo(715), "Vancouver", "Linda Park"),
      course("sahaj", daysAgo(645), "Vancouver", "Linda Park"),
    ],
    events: [
      event("retreat", daysAgo(560), "Vancouver"),
      event("satsang", daysAgo(520), "Vancouver"),
      event("seva", daysAgo(488), "Vancouver"),
    ],
    invites: 7,
    contacts: [
      contact(daysAgo(520), "in_person", "in", "Came to satsang with her daughter"),
      contact(daysAgo(410), "email", "out", "Sent the new centre address"),
      contact(daysAgo(210), "email", "out", "Birthday note — no reply"),
    ],
    signals: { appOpens30d: 0, emailOpens30d: 1, whatsappReplies30d: 0, videoMinutes30d: 3 },
    skills: ["cooking", "gardening"],
    interests: ["meditation", "seva"],
    notes: [
      "Was one of our most consistent practitioners before the move.",
      "Moved to a new apartment in Richmond last spring.",
    ],
    archetype: "dormant",
    hero: "wei",
  },
  {
    id: "p_006",
    firstName: "Gurpreet",
    lastName: "Singh",
    city: "Surrey",
    province: "BC",
    area: "604",
    language: "pa",
    assignedTo: "Harpreet Gill",
    joinedAt: daysAgo(888),
    courses: [
      course("sky", daysAgo(888), "Surrey", "Harpreet Gill"),
      course("part2", daysAgo(830), "Surrey", "Harpreet Gill"),
      course("silence", daysAgo(357), "Orillia", "Harpreet Gill"),
    ],
    events: [
      event("satsang", daysAgo(600), "Surrey"),
      event("satsang", daysAgo(420), "Surrey"),
      event("retreat", daysAgo(357), "Orillia"),
    ],
    invites: 8,
    contacts: [
      contact(daysAgo(357), "in_person", "in", "Finished the silence retreat — called it the best week of his year"),
      contact(daysAgo(200), "whatsapp", "out", "Shared the advanced course dates"),
      contact(daysAgo(130), "whatsapp", "out", "Quick check-in — no reply"),
    ],
    signals: { appOpens30d: 2, emailOpens30d: 3, whatsappReplies30d: 1, videoMinutes30d: 9 },
    skills: ["driving", "event logistics"],
    interests: ["retreats", "seva"],
    notes: [
      "Did the silence retreat last November and called it the best week of his year.",
      "Travels for work most weeks.",
    ],
    archetype: "drifting",
    hero: "gurpreet",
  },
  {
    id: "p_007",
    firstName: "Sophie",
    lastName: "Tremblay",
    city: "Quebec City",
    province: "QC",
    area: "418",
    language: "fr",
    assignedTo: "Sophie Gagnon",
    joinedAt: daysAgo(55),
    courses: [course("sky", daysAgo(55), "Quebec City", "Sophie Gagnon")],
    events: [event("followup", daysAgo(49), "Quebec City")],
    invites: 3,
    contacts: [
      contact(daysAgo(55), "in_person", "in", "Très touchée par la pratique — a posé beaucoup de questions"),
      contact(daysAgo(49), "email", "out", "Envoyé la feuille de pratique et les dates de suivi"),
      contact(daysAgo(49), "email", "in", "A répondu : merci, je vais essayer la pratique de 40 jours"),
    ],
    signals: { appOpens30d: 2, emailOpens30d: 8, whatsappReplies30d: 0, videoMinutes30d: 14 },
    skills: ["translation", "social media"],
    interests: ["meditation", "retreats"],
    notes: [
      "Answers email quickly, never picks up the phone.",
      "Studying for her bar exam in November.",
    ],
    archetype: "slipping",
    hero: "sophie",
  },
  {
    id: "p_008",
    firstName: "Aisha",
    lastName: "Rahman",
    city: "Calgary",
    province: "AB",
    area: "403",
    language: "en",
    assignedTo: "David Chen",
    joinedAt: daysAgo(853),
    courses: [course("yes", daysAgo(853), "Calgary", "David Chen")],
    events: [event("followup", daysAgo(820), "Calgary"), event("celebration", daysAgo(700), "Calgary")],
    invites: 4,
    contacts: [
      contact(daysAgo(820), "in_person", "in", "Came to the YES! follow-up with two friends"),
      contact(daysAgo(300), "email", "out", "Invited to volunteer at the fall event"),
      contact(daysAgo(73), "whatsapp", "out", "Birthday message — no reply"),
    ],
    signals: { appOpens30d: 12, emailOpens30d: 2, whatsappReplies30d: 4, videoMinutes30d: 20 },
    skills: ["social media", "photography", "music"],
    interests: ["community", "meditation"],
    notes: [
      "Did YES! at 17 and said it got her through grade 12.",
      "Now in her second year at U of C.",
    ],
    archetype: "slipping",
    hero: "aisha",
  },
  {
    id: "p_009",
    firstName: "Tom",
    lastName: "Whitfield",
    city: "Halifax",
    province: "NS",
    area: "902",
    language: "en",
    assignedTo: "Anita Rao",
    joinedAt: daysAgo(636),
    courses: [
      course("sky", daysAgo(636), "Halifax", "Anita Rao"),
      course("part2", daysAgo(580), "Halifax", "Anita Rao"),
    ],
    events: [
      event("satsang", daysAgo(500), "Halifax"),
      event("satsang", daysAgo(440), "Halifax"),
      event("satsang", daysAgo(370), "Halifax"),
      event("seva", daysAgo(300), "Halifax"),
      event("satsang", daysAgo(210), "Halifax"),
      event("satsang", daysAgo(120), "Halifax"),
      event("satsang", daysAgo(19), "Halifax"),
    ],
    invites: 8,
    contacts: [
      contact(daysAgo(210), "in_person", "in", "Stayed after satsang to help stack chairs"),
      contact(daysAgo(120), "in_person", "in", "Asked whether we need help with the newsletter"),
      contact(daysAgo(19), "in_person", "in", "Came to satsang, brought a neighbour"),
    ],
    signals: { appOpens30d: 6, emailOpens30d: 8, whatsappReplies30d: 2, videoMinutes30d: 55 },
    skills: ["teaching", "event logistics", "music"],
    interests: ["seva", "satsang"],
    notes: [
      "Comes to every satsang and stays to stack chairs.",
      "Retired teacher — very good with newcomers.",
    ],
    archetype: "practicing",
    hero: "tom",
  },
  {
    id: "p_010",
    firstName: "Neha",
    lastName: "Gupta",
    city: "Ottawa",
    province: "ON",
    area: "613",
    language: "hi",
    assignedTo: "Fatima Noor",
    joinedAt: daysAgo(300),
    courses: [
      course("sky", daysAgo(300), "Ottawa", "Fatima Noor"),
      course("part2", daysAgo(240), "Ottawa", "Fatima Noor"),
      course("sahaj", daysAgo(160), "Ottawa", "Fatima Noor"),
    ],
    events: [
      event("satsang", daysAgo(140), "Ottawa"),
      event("seva", daysAgo(95), "Ottawa"),
      event("satsang", daysAgo(60), "Ottawa"),
    ],
    invites: 5,
    contacts: [
      contact(daysAgo(95), "in_person", "in", "Helped at the registration desk for the intro talk"),
      contact(daysAgo(60), "in_person", "in", "Came to satsang with her sister"),
      contact(daysAgo(33), "whatsapp", "in", "Asked about volunteering as a course coordinator"),
    ],
    signals: { appOpens30d: 8, emailOpens30d: 4, whatsappReplies30d: 5, videoMinutes30d: 40 },
    skills: ["event logistics", "registration desk", "teaching"],
    interests: ["seva", "meditation"],
    notes: [
      "Completed all three courses this year.",
      "Asked about volunteering as a course coordinator.",
    ],
    archetype: "practicing",
    hero: "neha",
  },
];

/* ------------------------------------------------------------------ */
/* Procedural participants                                             */
/* ------------------------------------------------------------------ */

// Hero names are reserved before the procedural pool draws, otherwise the
// generator can produce a second "Wei Chen" and the demo case becomes ambiguous.
for (const h of HEROES) usedNames.add(`${h.firstName} ${h.lastName}`);

const NOTE_POOL = {
  new: [
    "Came with a friend from work.",
    "Asked about the 40-day practice app.",
    "Said the first session was harder than expected but wants to continue.",
    "Booked a follow-up call for next week.",
    "Mentioned a lot of travel in December.",
  ],
  practicing: [
    "Attends satsang most months.",
    "Practices in the morning before work.",
    "Asked about the next course in the sequence.",
    "Brings a family member to follow-ups now and then.",
    "Prefers short check-in messages over calls.",
    "Volunteered at the last event.",
  ],
  slipping: [
    "Missed the last two follow-ups.",
    "Said work got busy in the spring.",
    "Used to reply quickly, now leaves messages on read.",
    "Mentioned a new baby in the family.",
    "Moved apartments last year.",
    "Said they'd come back when things settle down.",
  ],
  drifting: [
    "Hasn't been to an event since the winter.",
    "Stopped opening the practice emails in the summer.",
    "Changed jobs and lost touch with the group.",
    "Was very enthusiastic during the course.",
    "Said the centre felt far without a car.",
  ],
  dormant: [
    "No contact for over six months.",
    "Was active for about a year, then went quiet.",
    "Email bounces occasionally; phone is best.",
    "Moved out of the city.",
    "Took the course years ago and never came back after the follow-ups.",
  ],
};

const CHANNELS = ["whatsapp", "email", "phone", "in_person"];

function buildProcedural(archetype, i) {
  const cityInfo = weightedCity();
  const isQc = cityInfo.province === "QC";
  let language = "en";
  if (isQc) language = chance(0.82) ? "fr" : "en";
  else if (cityInfo.city === "Brampton" || cityInfo.city === "Surrey") language = chance(0.45) ? "pa" : "en";
  else if (cityInfo.city === "Mississauga" || cityInfo.city === "Markham") {
    language = chance(0.3) ? pick(["hi", "zh", "ta"]) : "en";
  } else if (cityInfo.city === "Vancouver") language = chance(0.25) ? "zh" : "en";

  const [firstName, lastName] = makeName(language);
  const coord =
    COORDINATORS.find((c) => c.city === cityInfo.city) ||
    COORDINATORS.find((c) => c.city.slice(0, 3) === cityInfo.city.slice(0, 3)) ||
    pick(COORDINATORS);

  let daysSinceFirst;
  let lastContactDays;
  let level;
  const courses = [];
  const events = [];
  let invites;

  if (archetype === "new") {
    daysSinceFirst = int(2, 20);
    // A touchpoint cannot predate the course that introduced them.
    lastContactDays = int(1, Math.max(1, daysSinceFirst - 1));
    level = int(60, 95);
    invites = int(1, 2);
  } else if (archetype === "practicing") {
    daysSinceFirst = int(70, 330);
    lastContactDays = int(4, 26);
    level = int(55, 92);
    invites = int(6, 14);
  } else if (archetype === "slipping") {
    daysSinceFirst = int(210, 600);
    lastContactDays = int(46, 80);
    level = int(18, 48);
    invites = int(4, 10);
  } else if (archetype === "drifting") {
    daysSinceFirst = int(420, 1000);
    lastContactDays = int(95, 160);
    level = int(8, 35);
    invites = int(3, 8);
  } else {
    daysSinceFirst = int(800, 1500);
    lastContactDays = int(190, 420);
    level = int(0, 20);
    invites = int(2, 6);
  }

  const teacher = coord.name;
  courses.push(course("sky", daysAgo(daysSinceFirst), cityInfo.city, teacher));

  const tenure = daysSinceFirst;
  if (tenure > 120 && chance(archetype === "practicing" ? 0.5 : 0.3)) {
    courses.push(course("part2", daysAgo(daysSinceFirst - int(30, 70)), cityInfo.city, teacher));
  }
  if (tenure > 240 && chance(archetype === "practicing" ? 0.3 : 0.12)) {
    courses.push(course("sahaj", daysAgo(daysSinceFirst - int(90, 180)), cityInfo.city, teacher));
  }
  if (tenure > 400 && chance(0.1)) {
    courses.push(course("silence", daysAgo(int(180, 400)), "Orillia", teacher));
  }
  if (archetype === "new" && chance(0.1)) {
    courses[0] = course("yes", daysAgo(daysSinceFirst), cityInfo.city, teacher);
  }

  // Events. Everything must sit between joining and the most recent contact,
  // otherwise the history shows attendance before the course that introduced them.
  const eventCount =
    archetype === "practicing" ? int(2, 6) :
    archetype === "slipping" ? int(1, 3) :
    archetype === "drifting" ? int(1, 2) :
    archetype === "dormant" ? int(0, 2) : int(0, 1);

  const eventWindowStart = 4;                       // days after joining
  const eventWindowEnd = lastContactDays - 3;        // before the last touch
  const eventWindow = eventWindowEnd - eventWindowStart;
  for (let e = 0; e < eventCount && eventWindow > 0; e++) {
    const gap =
      eventWindowStart + Math.round((eventWindow * (e + 1)) / (eventCount + 1));
    const day = daysAgo(Math.max(1, Math.min(gap, daysSinceFirst - 1)));
    const type =
      archetype === "practicing" && chance(0.3)
        ? "seva"
        : pick(["followup", "satsang", "seva", "celebration"]);
    events.push(event(type, day, cityInfo.city));
  }
  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Contacts. Each one is older than the last, and none predates joining.
  const channelPref = language === "fr"
    ? (chance(0.6) ? "email" : "whatsapp")
    : level < 20 ? (chance(0.6) ? "email" : "phone") : (chance(0.55) ? "whatsapp" : "email");
  const contactCount =
    archetype === "new" ? int(1, 3) :
    archetype === "practicing" ? int(2, 5) :
    archetype === "slipping" ? int(2, 4) : int(1, 3);

  const contacts = [
    contact(
      daysAgo(lastContactDays),
      channelPref,
      "out",
      "Last touchpoint"
    ),
  ];
  let gapCursor = lastContactDays;
  for (let c = 1; c < contactCount; c++) {
    const nextGap = Math.min(gapCursor + int(25, 90), daysSinceFirst - 1);
    if (nextGap <= gapCursor) break;
    gapCursor = nextGap;
    contacts.push(
      contact(
        daysAgo(gapCursor),
        pick(CHANNELS),
        chance(0.35) ? "in" : "out",
        pick(["Checked in", "Shared course dates", "Followed up after an event", "Sent a practice resource"])
      )
    );
  }

  const emailHeavy = language === "fr" && chance(0.5);
  const signals = engagementSignals(level, { emailHeavy });

  return {
    id: `p_${String(i).padStart(3, "0")}`,
    firstName,
    lastName,
    email: makeEmail(firstName, lastName, i, cityInfo.province),
    phone: `+1 (${cityInfo.area}) 555-${String(1000 + i).slice(-4)}`,
    city: cityInfo.city,
    province: cityInfo.province,
    language,
    assignedTo: coord.name,
    joinedAt: daysAgo(daysSinceFirst),
    courses: courses.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    events,
    invites,
    contacts,
    signals,
    skills: Array.from({ length: int(1, 3) }, () => pick(SKILLS)).filter((v, idx, a) => a.indexOf(v) === idx),
    interests: Array.from({ length: int(1, 2) }, () =>
      pick(["meditation", "seva", "retreats", "community", "satsang", "yoga"])
    ).filter((v, idx, a) => a.indexOf(v) === idx),
    notes: [pick(NOTE_POOL[archetype]), pick(NOTE_POOL[archetype])].filter((v, idx, a) => a.indexOf(v) === idx),
    archetype,
    hero: null,
  };
}

/* ------------------------------------------------------------------ */
/* Assemble                                                            */
/* ------------------------------------------------------------------ */

const PLAN = [
  ["new", 24],
  ["practicing", 52],
  ["slipping", 42],
  ["drifting", 34],
  ["dormant", 28],
];

const out = [...HEROES];
let idx = HEROES.length + 1;
for (const [archetype, count] of PLAN) {
  const heroCount = HEROES.filter((h) => h.archetype === archetype).length;
  for (let n = 0; n < count - heroCount; n++) {
    out.push(buildProcedural(archetype, idx++));
  }
}

// Every completed course must appear in the contact log, or the history shows
// someone finishing a retreat that nobody ever spoke to them about.
for (const p of out) {
  const lastGap = Math.min(
    ...p.contacts.map((c) => Math.floor((NOW.getTime() - +new Date(c.at)) / 86400000))
  );
  for (const c of p.courses) {
    const gap = Math.floor((NOW.getTime() - +new Date(c.completedAt)) / 86400000);
    if (gap > lastGap && !p.contacts.some((x) => x.summary.includes(c.name))) {
      p.contacts.push(contact(daysAgo(gap), "in_person", "in", `Completed ${c.name}`));
    }
  }
  p.contacts.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

// Ids are assigned at creation and never renumbered, so stored activity keeps
// pointing at the right person after a data edit.
out.forEach((p, i) => {
  const area = CITIES.find((c) => c.city === p.city)?.area ?? "416";
  p.phone = p.phone
    ? p.phone.replace(/555-\d{4}$/, `555-${String(1000 + i + 1).slice(-4)}`)
    : `+1 (${area}) 555-${String(1000 + i + 1).slice(-4)}`;
  p.email = p.email || makeEmail(p.firstName, p.lastName, i + 1, p.province);

  // A few people have told us how to reach them, and one or two have asked us
  // not to. Both are first-class state, not an edge case.
  if (i % 37 === 5) p.contactPreference = "email";
  if (i % 53 === 9) p.contactPreference = "phone";
  if (i === 12 || i === 77 || i === 131) p.doNotContact = true;
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const now = NOW.getTime();
const days = (isoStr) => Math.floor((now - +new Date(isoStr)) / 86400000);
const byArch = {};
for (const p of out) {
  byArch[p.archetype] = byArch[p.archetype] || { n: 0, contact: 0, level: 0 };
  byArch[p.archetype].n++;
  byArch[p.archetype].contact += days(p.contacts.reduce((m, c) => (+new Date(c.at) > +new Date(m) ? c.at : m), p.contacts[0].at));
  byArch[p.archetype].level += signalsToLevel(p.signals);
}
console.log(`Wrote ${out.length} participants → ${OUT}\n`);
for (const [k, v] of Object.entries(byArch)) {
  console.log(
    `${k.padEnd(11)} n=${String(v.n).padStart(3)}  avg days since contact=${String(Math.round(v.contact / v.n)).padStart(3)}  avg engagement=${Math.round(v.level / v.n)}`
  );
}
console.log(`\nLanguages: ${JSON.stringify(out.reduce((a, p) => ((a[p.language] = (a[p.language] || 0) + 1), a), {}))}`);
console.log(`Provinces: ${JSON.stringify(out.reduce((a, p) => ((a[p.province] = (a[p.province] || 0) + 1), a), {}))}`);
