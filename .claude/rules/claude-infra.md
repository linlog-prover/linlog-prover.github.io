---
paths:
  - ".claude/**"
  - "CLAUDE.md"
---

# The Claude Code setup in this repo

Taken from linlog's own (`~/Projects/own/linlog/.claude/`, whose `rules/claude-infra.md`
says why each piece is as it is) and the author's learning sites'.

| mechanism | loaded | for |
|---|---|---|
| `CLAUDE.md` | every session | what the repo is, hard rules, commands, layout |
| `.claude/rules/*.md` with `paths:` | when a matching file is read, written or edited | the conventions of one area |
| `.claude/settings.json` + `.claude/hooks/` | on the tool call | what must happen or must not, whatever Claude decides |

- **The hooks**: `block-git.py` and `block-jj-new-message.py` (PreToolUse on Bash) refuse
  git, behind every wrapper `command_line.py` knows, and `jj new -m`; `format.sh`
  (PostToolUse on Write and Edit) runs `nix fmt` on the one file written;
  `session-jj-state.sh` (SessionStart) prints `@` and `@-`. They fail open: a missing tool
  or a malformed payload exits 0.
- **The `claude-hooks` check** (`modules/claude-hooks.nix`) pins every guard: the commands
  it blocks and allows, that a malformed payload passes, that `settings.json` registers it
  and that it is executable. A new guard gets its cases there in the same change.
- **Permissions**: git, `npm ci`, `npx`, `npm exec` and hand edits of `LICENSE` and both
  lock files are denied; `jj git push` and every `gh` command ask.
- **Keep it current**: when the repo changes shape, amend `.claude/` and CLAUDE.md in the
  same change.
