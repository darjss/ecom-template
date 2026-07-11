export type ProspectStatus =
  | "candidate"
  | "researched"
  | "demo-ready"
  | "reviewed"
  | "sent"
  | "replied"
  | "call"
  | "deposit"
  | "won"
  | "rejected"
  | "follow-up"
  | "expired";

export type GateId =
  | "catalog"
  | "brand"
  | "storefront"
  | "demo-order"
  | "video"
  | "recipient"
  | "dm-copy";

export type ArtifactKind =
  | "sources"
  | "catalog"
  | "brand-brief"
  | "store-profile"
  | "seed"
  | "storefront"
  | "demo-manifest"
  | "video"
  | "outreach-package";

export type JournalEntry = {
  sequence: number;
  event: string;
  detail: string;
};

export type WorkflowState = {
  prospect: "rozie-store";
  status: ProspectStatus;
  step: number;
  minutesUsed: number;
  targetMinutes: 75;
  hardStopMinutes: 90;
  blocker: string | null;
  artifacts: ArtifactKind[];
  approvals: GateId[];
  activeDemoAllowlisted: boolean;
  telegramActionRef: string | null;
  journal: JournalEntry[];
};

export type WorkflowAction =
  | { type: "advance" }
  | { type: "approve" }
  | { type: "reject" }
  | { type: "fail" }
  | { type: "resume" }
  | { type: "attempt-production-telegram" }
  | { type: "mark"; status: ProspectStatus };

export type Step =
  | {
      type: "agent";
      name: string;
      minutes: number;
      artifacts: ArtifactKind[];
      status?: ProspectStatus;
      activatesDemo?: true;
    }
  | {
      type: "gate";
      name: string;
      gate: GateId;
      reviseFrom: number;
    };
