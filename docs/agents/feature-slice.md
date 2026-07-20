# Slice guide

A slice is one demonstrable user journey, not a layer inventory.

## Shape

- **Outcome-first.** Name who does what and what they see when it works. One page maximum.
- **Thin at every layer it touches.** A slice may cross contracts, kernel, api, client, and UI — each crossing is as small as the outcome allows.
- **No mechanism inventories.** Do not pre-enumerate tables, transitions, states, or predicates in the brief. The implementer chooses the smallest mechanism that satisfies the outcome and the simplicity caps in `AGENTS.md`.
- **Boundaries explicit.** State what is *not* in the slice. Silence is not permission.

## Done means

1. The journey works in a real browser, walked by the agent, screenshots attached.
2. Gates in `AGENTS.md` are green.
3. Nothing outside the outcome grew: no new table without its one-line justification, no new abstraction for a hypothetical second use.

Gates green and product approved are separate states. Report both.

## Escalation

One correction pass per review. A second failure stops the slice and escalates to the human with the evidence gathered — do not spawn another review loop or widen the slice.
