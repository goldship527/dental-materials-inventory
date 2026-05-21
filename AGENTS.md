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

## 秘密値が必要な検証の扱い

- 秘密値はチャットに貼ってもらわない
- 秘密値はGit、README、docs、dev-logに記載しない
- 秘密値がないと実行できない検証は、ローカルフォールバックやモック可能な範囲までCodexが確認する
- 実サービス接続が必要な最終確認は、利用者がローカル環境変数や管理画面で秘密値を設定して実施する手順として残す

今後、Supabase以外の秘密値(SMTP, S3, OAuth client secret等)を扱う場面でも、同じルールを適用する。

## Shared Context Engine

このプロジェクトで作業を始める前に、必要に応じて以下の共有文脈入口を確認する。

C:\Users\topro\Dropbox\Ts context vault\04_Projects\AI_Dev\context-index.md

このファイルは、Codex と Claude Code が同じ前提から作業を始めるための共通入口である。

作業時のルール:

- vault全体を読まない。
- まず context-index.md を読み、そこに書かれた必要最小限のファイルだけを参照する。
- 実装仕様の正本は、このプロジェクト内の docs/spec.md とする。
- 作業履歴の正本は、このプロジェクト内の docs/dev-log.md とする。
- Obsidian側の仕様メモは、概要、検討メモ、参照リンクとして扱う。
- 古いログや検討メモを、現在の仕様として扱わない。
- 作業後に共有文脈へ影響がある場合は、update-policy.md に従って必要な文脈ファイルを更新する。

読む優先順位:

1. このプロジェクトの AGENTS.md
2. 共有文脈入口 context-index.md
3. このプロジェクトの README.md
4. このプロジェクトの docs/spec.md
5. このプロジェクトの docs/dev-log.md

ただし、ユーザーのこのチャットでの明示指示が最優先である。
