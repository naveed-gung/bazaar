# AGENTS.md — Bazaar

This repository keeps an agent-maintained knowledge base at **[docs/agent/](docs/agent/00-INDEX.md)**.

Any agent (Claude Code, Cursor, Codex, Copilot) or human that modifies this repo:

1. **Start** by reading [docs/agent/00-INDEX.md](docs/agent/00-INDEX.md) — doc map, stack
   facts, current top priorities.
2. **Follow** the contract in [docs/agent/PROTOCOL.md](docs/agent/PROTOCOL.md) — status
   tables, task IDs, `HUMAN-GATE:` steps.
3. **Finish** by updating the Status tables you touched, bumping `last-verified:`
   frontmatter, and appending one line to [docs/agent/SESSIONS.md](docs/agent/SESSIONS.md).

Verification before marking anything done (from the repo root):

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Never commit `.env*`, `atlas-credentials.env`, or `*-adminsdk-*.json` — they are
ignored on purpose. Deploying, publishing, key rotation, and Atlas console changes are
HUMAN-GATE: surface them, do not execute them.
