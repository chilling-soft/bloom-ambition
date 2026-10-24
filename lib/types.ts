export type Fact = {
  id: string;
  kind: "identity" | "interest" | "activity";
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
  handoff: Handoff | null;
  updatedAt: number;
};
