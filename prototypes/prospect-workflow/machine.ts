import type {
  ArtifactKind,
  JournalEntry,
  ProspectStatus,
  Step,
  WorkflowAction,
  WorkflowState,
} from "./model";

export const steps: Step[] = [
  { type: "agent", name: "Capture public references with agent-browser", minutes: 12, artifacts: ["sources", "catalog"] },
  { type: "gate", name: "Review extracted products, variants, prices, and provenance", gate: "catalog", reviseFrom: 0 },
  { type: "agent", name: "Draft brand interpretation", minutes: 5, artifacts: ["brand-brief"], status: "researched" },
  { type: "gate", name: "Review brand interpretation", gate: "brand", reviseFrom: 2 },
  { type: "agent", name: "Generate app-owned profile, seed, and storefront", minutes: 15, artifacts: ["store-profile", "seed", "storefront"] },
  { type: "gate", name: "Review generated storefront UI", gate: "storefront", reviseFrom: 4 },
  { type: "agent", name: "Provision isolated noindex synthetic demo", minutes: 12, artifacts: ["demo-manifest"], status: "demo-ready", activatesDemo: true },
  { type: "gate", name: "Review synthetic order and demo-only Telegram behavior", gate: "demo-order", reviseFrom: 6 },
  { type: "agent", name: "Record portrait walkthrough", minutes: 10, artifacts: ["video"] },
  { type: "gate", name: "Review walkthrough video", gate: "video", reviseFrom: 8 },
  { type: "agent", name: "Draft outreach package", minutes: 6, artifacts: ["outreach-package"] },
  { type: "gate", name: "Confirm exact recipient", gate: "recipient", reviseFrom: 10 },
  { type: "gate", name: "Approve final Mongolian DM copy", gate: "dm-copy", reviseFrom: 10 },
];

export const initialState = (): WorkflowState => ({
  prospect: "rozie-store",
  status: "candidate",
  step: 0,
  minutesUsed: 0,
  targetMinutes: 75,
  hardStopMinutes: 90,
  blocker: null,
  artifacts: [],
  approvals: [],
  activeDemoAllowlisted: false,
  telegramActionRef: null,
  journal: [],
});

const addEntry = (state: WorkflowState, event: string, detail: string): JournalEntry[] => [
  ...state.journal,
  { sequence: state.journal.length + 1, event, detail },
];

const uniqueArtifacts = (current: ArtifactKind[], added: ArtifactKind[]): ArtifactKind[] => [
  ...current.filter((artifact) => !added.includes(artifact)),
  ...added,
];

const advance = (state: WorkflowState): WorkflowState => {
  const step = steps[state.step];
  if (!step) return { ...state, journal: addEntry(state, "denied", "Workflow is already reviewed") };
  if (state.blocker) return { ...state, journal: addEntry(state, "denied", "Resume the blocked step first") };
  if (step.type === "gate") return { ...state, journal: addEntry(state, "waiting", step.name) };
  const minutesUsed = state.minutesUsed + step.minutes;
  if (minutesUsed > state.hardStopMinutes) {
    return { ...state, blocker: "Hard stop reached; founder must explicitly re-scope or abandon", journal: addEntry(state, "hard-stop", step.name) };
  }
  return {
    ...state,
    step: state.step + 1,
    minutesUsed,
    status: step.status ?? state.status,
    artifacts: uniqueArtifacts(state.artifacts, step.artifacts),
    activeDemoAllowlisted: step.activatesDemo ?? state.activeDemoAllowlisted,
    telegramActionRef: step.activatesDemo ? "act_rozie_7KQ2M9_single_use" : state.telegramActionRef,
    journal: addEntry(state, "completed", `${step.name} (${step.minutes}m)`),
  };
};

const approve = (state: WorkflowState): WorkflowState => {
  const step = steps[state.step];
  if (!step || step.type !== "gate" || state.blocker) return { ...state, journal: addEntry(state, "denied", "No review gate is ready") };
  const finished = state.step === steps.length - 1;
  return {
    ...state,
    step: state.step + 1,
    minutesUsed: state.minutesUsed + 1,
    status: finished ? "reviewed" : state.status,
    approvals: [...state.approvals, step.gate],
    journal: addEntry(state, "approved", step.name),
  };
};

const reject = (state: WorkflowState): WorkflowState => {
  const step = steps[state.step];
  if (!step || step.type !== "gate" || state.blocker) return { ...state, journal: addEntry(state, "denied", "No review gate is ready") };
  return {
    ...state,
    step: step.reviseFrom,
    blocker: `Revision requested at ${step.gate}; resume regenerates from its producer`,
    journal: addEntry(state, "rejected", step.name),
  };
};

const mark = (state: WorkflowState, status: ProspectStatus): WorkflowState => {
  if (status === "sent" && state.status !== "reviewed") return { ...state, journal: addEntry(state, "denied", "Manual send requires every approval") };
  if (status === "sent") return { ...state, status, journal: addEntry(state, "recorded", "Founder manually sent approved package") };
  const allowed = ["replied", "call", "deposit", "won", "rejected", "follow-up", "expired"];
  if (!allowed.includes(status) || !["sent", "replied", "call", "deposit", "follow-up"].includes(state.status)) {
    return { ...state, journal: addEntry(state, "denied", `Cannot mark ${status} from ${state.status}`) };
  }
  return { ...state, status, activeDemoAllowlisted: status === "expired" ? false : state.activeDemoAllowlisted, journal: addEntry(state, "recorded", `Prospect marked ${status}`) };
};

export const transition = (state: WorkflowState, action: WorkflowAction): WorkflowState => {
  if (action.type === "advance") return advance(state);
  if (action.type === "approve") return approve(state);
  if (action.type === "reject") return reject(state);
  if (action.type === "mark") return mark(state, action.status);
  if (action.type === "fail") return state.blocker ? state : { ...state, blocker: "Injected agent/tool failure; completed journal entries remain resumable", journal: addEntry(state, "failed", steps[state.step]?.name ?? "workflow") };
  if (action.type === "resume") return { ...state, blocker: null, journal: addEntry(state, "resumed", `Continue at step ${state.step + 1}`) };
  return { ...state, journal: addEntry(state, "denied", "Production Stores are never admitted to the demo Telegram allowlist") };
};
