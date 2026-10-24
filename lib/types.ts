export type Fact = {
  id: string;
  kind: "identity" | "interest" | "activity" | "habit"; // habit: how this person likes to be helped
  key: string;
  label: string;
  value: string;
  source: string;
  confidence: number;
  isNew?: boolean;
  userEdited?: boolean;
};

export type Handoff = {
  title: string;
  term: string;
  explanation: string;
  ts: number;
};

export type Session = {
  facts: Fact[];
  minutes?: Record<string, number>; // daily ring minutes, so the phone shows the same rings
  handoff: Handoff | null;
  updatedAt: number;
};
