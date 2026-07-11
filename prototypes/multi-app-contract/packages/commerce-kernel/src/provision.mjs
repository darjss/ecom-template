export const provisioningSteps = [
  "create-d1",
  "create-sessions-kv",
  "create-cache-kv",
  "create-r2",
  "write-config",
  "generate-types",
  "migrate",
  "seed",
  "deploy",
  "prove",
];

export const createProvisioningState = ({ profile, suffix }) => {
  const baseName = `${profile.provisioning.disposablePrefix}-${profile.slug}-${suffix}`;

  return {
    contractVersion: 1,
    app: profile.slug,
    baseName,
    status: "provisioning",
    completed: [],
    attempts: [],
    resources: {
      d1: { name: `${baseName}-db` },
      sessionsKv: { name: `${baseName}-sessions` },
      cacheKv: { name: `${baseName}-cache` },
      r2: { name: `${baseName}-media` },
      worker: { name: baseName },
    },
  };
};

export const nextProvisioningStep = (state) =>
  provisioningSteps.find((step) => !state.completed.includes(step));

export const recordProvisioningSuccess = (state, step, result) => ({
  ...state,
  status: step === provisioningSteps.at(-1) ? "ready" : "provisioning",
  completed: [...state.completed, step],
  attempts: [...state.attempts, { step, outcome: "succeeded", at: new Date().toISOString() }],
  resources: { ...state.resources, ...result },
  lastError: undefined,
});

export const recordProvisioningFailure = (state, step, error) => ({
  ...state,
  status: "blocked",
  attempts: [...state.attempts, { step, outcome: "failed", at: new Date().toISOString() }],
  lastError: { step, message: error },
});
