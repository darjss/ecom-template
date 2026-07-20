# Issue tracker: GitHub

Issues live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create**: `gh issue create --title "..." --body "..."`. Heredoc for multi-line bodies.
- **Read**: `gh issue view <number> --comments`.
- **List**: `gh issue list --state open --json number,title,labels`.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

## Writing issues

Issues are outcome-first slices per [`feature-slice.md`](feature-slice.md): who does what, what they see when it works, explicit boundaries, proof expected. One page maximum. Mechanism choices belong to the implementer within the `AGENTS.md` simplicity caps, not to the issue body.
