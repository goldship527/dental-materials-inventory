# Global Codex Instructions

## Common development environment

Actual development work should usually be done under:

C:\Dev

Each project should have its own folder:

C:\Dev\project-name

The Obsidian vault is used for planning, specifications, prompts, and logs.

Obsidian AI planning folder:

C:\Users\topro\Dropbox\Ts context vault\04_Projects\AI_Dev

Do not treat the entire Obsidian vault as a coding workspace.

## Standard project structure

Each project should generally follow this structure:

C:\Dev\project-name
- AGENTS.md
- CLAUDE.md
- README.md
- docs\spec.md
- docs\dev-log.md
- src
- tests

## Documentation rules

- Read AGENTS.md, README.md, docs\spec.md, and docs\dev-log.md before implementation.
- Treat docs\spec.md as the implementation specification.
- Append important work notes to docs\dev-log.md.

## Language

- Respond in Japanese unless otherwise requested.
- Explain step by step for a non-full-time software engineer.
- Prefer practical explanations over abstract theory.

## Workflow

Before editing files, first explain:

1. Understanding of the goal
2. Assumptions
3. Implementation plan
4. Proposed file structure
5. Security risks
6. Questions or points to confirm

Do not start coding until the plan is approved.

## Safety

- Do not store API keys, passwords, tokens, or secrets in code.
- Do not include personal information, patient information, real customer names, real clinic names, or company confidential information.
- Use environment variables or local config files excluded from Git for secrets.
- Do not delete or overwrite existing files without explaining the change first.
- Keep changes small and reviewable.

## Development preference

- Prefer simple, maintainable implementations.
- Avoid overengineering.
- Clarify the MVP before implementation.
- After work, summarize:
  - What changed
  - Files changed
  - How to test
  - Remaining risks
  - Next actions

## Voice input clarification rule

The user often uses voice input. If an instruction appears abrupt, contextually strange, potentially destructive, unsafe, or likely to be a speech recognition error, do not execute it immediately. Ask a brief clarification question first.

## Secret-dependent verification

- Do not ask the user to paste secret values into chat.
- Do not write secret values to Git, README, docs, or docs/dev-log.md.
- If verification cannot be completed without secrets, Codex should verify as much as possible with local fallbacks or mocks.
- If a final check requires connection to a real service, leave the required environment variables and safe execution steps for the user.

## Shared Context Engine

Before starting work in this project, check the following shared context entry point when needed:

C:\Users\topro\Dropbox\Ts context vault\04_Projects\AI_Dev\context-index.md

This file is the shared entry point used by Codex and Claude Code before starting work with the same assumptions.

Rules:

- Do not read the entire vault.
- First read context-index.md, then refer only to the necessary minimum files listed there.
- The authoritative implementation specification is this project's docs/spec.md.
- The authoritative work history is this project's docs/dev-log.md.
- Treat Obsidian-side specification notes as summaries, investigation notes, or reference links.
- Do not treat old logs or investigation notes as the current specification.
- If work affects shared context, update only the necessary files according to update-policy.md.

Reading priority:

1. This project's AGENTS.md
2. Shared context entry point context-index.md
3. This project's README.md
4. This project's docs/spec.md
5. This project's docs/dev-log.md

The user's explicit instruction in the current chat has the highest priority.
