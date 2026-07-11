import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { initialState, steps, transition } from "./machine";
import type { ProspectStatus, WorkflowAction, WorkflowState } from "./model";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";

const outcome = (value: string): ProspectStatus | null => {
  if (value === "sent") return "sent";
  if (value === "replied") return "replied";
  if (value === "call") return "call";
  if (value === "deposit") return "deposit";
  if (value === "won") return "won";
  if (value === "rejected") return "rejected";
  if (value === "follow-up") return "follow-up";
  if (value === "expired") return "expired";
  return null;
};

const parseAction = (input: string): WorkflowAction | null => {
  const [command, value] = input.trim().split(/\s+/, 2);
  if (command === "n") return { type: "advance" };
  if (command === "a") return { type: "approve" };
  if (command === "x") return { type: "reject" };
  if (command === "f") return { type: "fail" };
  if (command === "r") return { type: "resume" };
  if (command === "p") return { type: "attempt-production-telegram" };
  if (command === "m" && value) {
    const status = outcome(value);
    return status ? { type: "mark", status } : null;
  }
  return null;
};

const render = (state: WorkflowState): void => {
  console.clear();
  const current = steps[state.step];
  const latest = state.journal.slice(-7);
  console.log(`${bold}PROTOTYPE — Rozie Store prospect workflow${reset}`);
  console.log(`${dim}Question: can a resumable agent workflow stay bounded while every consequential choice remains human-owned?${reset}\n`);
  console.log(`${bold}status${reset}              ${state.status}`);
  console.log(`${bold}current step${reset}        ${current?.name ?? "Complete"}`);
  console.log(`${bold}mode${reset}                ${current?.type === "gate" ? "HITL review" : "AFK agent"}`);
  console.log(`${bold}active time${reset}         ${state.minutesUsed}m / ${state.targetMinutes}m target / ${state.hardStopMinutes}m hard stop`);
  console.log(`${bold}blocker${reset}             ${state.blocker ?? "none"}`);
  console.log(`${bold}artifacts${reset}           ${state.artifacts.join(", ") || "none"}`);
  console.log(`${bold}approved gates${reset}      ${state.approvals.join(", ") || "none"}`);
  console.log(`${bold}Telegram allowlist${reset}  ${state.activeDemoAllowlisted ? "active prospect demo only" : "inactive"}`);
  console.log(`${bold}opaque action ref${reset}   ${state.telegramActionRef ?? "none"}`);
  console.log(`\n${bold}Recent journal${reset}`);
  for (const entry of latest) console.log(`${dim}${entry.sequence}.${reset} ${entry.event}: ${entry.detail}`);
  console.log(`\n${bold}[n]${reset} next agent step  ${bold}[a]${reset} approve gate  ${bold}[x]${reset} reject gate  ${bold}[f]${reset} inject failure  ${bold}[r]${reset} resume`);
  console.log(`${bold}[p]${reset} try Production Store Telegram  ${bold}[m status]${reset} record sent/outcome  ${bold}[q]${reset} quit`);
};

export const run = async (): Promise<void> => {
  const terminal = createInterface({ input: stdin, output: stdout });
  let state = initialState();
  while (true) {
    render(state);
    const input = await terminal.question("\n> ");
    if (input.trim() === "q") break;
    const action = parseAction(input);
    if (action) state = transition(state, action);
  }
  terminal.close();
};

await run();
