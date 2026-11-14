export type Language = "en" | "fr" | "hi" | "pa" | "ta" | "zh";
export type Channel = "whatsapp" | "email" | "phone" | "in_person";

export type Stage = "new" | "practicing" | "slipping" | "drifting" | "dormant";

export interface Course {
  programId: string;
  name: string;
  completedAt: string;
  city: string;
  teacher: string;
}

export interface AttendedEvent {
  name: string;
  type: "followup" | "satsang" | "seva" | "retreat" | "intro" | "wcf" | "celebration";
  date: string;
  city: string;
}

export interface Contact {
  at: string;
  channel: Channel;
  direction: "in" | "out";
  summary: string;
}

export interface Signals {
  appOpens30d: number;
  emailOpens30d: number;
  whatsappReplies30d: number;
  videoMinutes30d: number;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  language: Language;
  assignedTo: string;
  joinedAt: string;
  courses: Course[];
  events: AttendedEvent[];
  invites: number;
  contacts: Contact[];
  signals: Signals;
  skills: string[];
  interests: string[];
  /**
   * Free-text volunteer observations. Shown to the human, quoted by the local
   * template composer, and never included in a model request.
   */
  notes: string[];
  /** How this person has asked to be contacted, if they have said. */
  contactPreference?: Channel;
  /** A hard stop. Nothing is drafted, scored or recommended for this person. */
  doNotContact?: boolean;
  archetype?: string;
  hero?: string | null;
}

export type SignalTone = "good" | "warn" | "bad";

export interface SignalPart {
  key: string;
  label: string;
  /** 0–1, share of this part's maximum that was earned */
  ratio: number;
  earned: number;
  max: number;
  value: string;
  detail: string;
  tone: SignalTone;
}

export interface Journey {
  participant: Participant;
  stage: Stage;
  score: number;
  daysSinceContact: number;
  lastContact: Contact | null;
  signals: SignalPart[];
  /** Human-readable summary of what is driving the stage */
  drivers: string;
  /** Days until this person's stage degrades if nothing changes; null if dormant or stable */
  daysToDrift: number | null;
  driftDate: string | null;
  /** The stage they would fall to */
  driftTo: Stage | null;
  /** degrades = a crossing exists; stable = no crossing in 200 days; dormant = already gone */
  projection: "degrades" | "stable" | "dormant";
  engagement: number;
  eventRate: number;
  daysSinceFirstCourse: number;
  totalCourses: number;
}

export type OfferKind = "course" | "event" | "seva" | "call";
export type Commitment = "low" | "medium" | "high";

export interface Offer {
  id: string;
  name: string;
  kind: OfferKind;
  kindLabel: string;
  when: string;
  date: string;
  duration: string;
  place: string;
  languages: Language[];
  commitment: Commitment;
  blurb: string;
}

export interface Recommendation {
  offer: Offer;
  score: number;
  reasons: string[];
  channel: Channel;
  channelReason: string;
  /** Short, human framing of why this is the right next step */
  headline: string;
  /** Days until the offer's next intake — verifiable urgency */
  intakeInDays: number;
}

export type Tone = "warm" | "brief" | "direct";

export interface Draft {
  subject?: string;
  body: string;
  source: "template" | "openai" | "ollama";
}

export interface ActivityEntry {
  id: string;
  participantId: string;
  participantName: string;
  at: string;
  channel: Channel;
  offerName: string;
  message: string;
  stage: Stage;
  reply?: boolean;
}
