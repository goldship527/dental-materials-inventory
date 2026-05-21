# CLAUDE.md

このプロジェクトでは、まず `AGENTS.md` の共通ルールを優先してください。

実装前には必ず以下を確認します。

- `AGENTS.md`
- `README.md`
- `docs/spec.md`
- `docs/dev-log.md`

`docs/spec.md` を実装仕様として扱い、重要な作業メモは `docs/dev-log.md` に追記してください。

## Shared Context Engine

このプロジェクトで作業を始める前に、必要に応じて以下の共有文脈入口を確認する。

C:\Users\topro\Dropbox\Ts context vault\04_Projects\AI_Dev\context-index.md

このファイルは、Claude Code と Codex が同じ前提から作業を始めるための共通入口である。

作業時のルール:

- vault全体を読まない。
- まず context-index.md を読み、そこに書かれた必要最小限のファイルだけを参照する。
- 実装仕様の正本は、このプロジェクト内の docs/spec.md とする。
- 作業履歴の正本は、このプロジェクト内の docs/dev-log.md とする。
- Obsidian側の仕様メモは、概要、検討メモ、参照リンクとして扱う。
- 古いログや検討メモを、現在の仕様として扱わない。
- 作業後に共有文脈へ影響がある場合は、update-policy.md に従って必要な文脈ファイルを更新する。

読む優先順位:

1. このプロジェクトの CLAUDE.md
2. 共有文脈入口 context-index.md
3. このプロジェクトの README.md
4. このプロジェクトの docs/spec.md
5. このプロジェクトの docs/dev-log.md

ただし、ユーザーのこのチャットでの明示指示が最優先である。
