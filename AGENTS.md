# AGENTS.md — プロジェクト開発・運用ルール

このファイルは、本リポジトリで作業する AI エージェント（Antigravity など）向けの共通ルールです。

## 1. ドキュメント言語ルール
- `README.md`、`CHANGELOG.md`、設計ドキュメント、その他すべてのドキュメントは**常に日本語**で記述・更新すること。

## 2. コミット帰属（Contributor 表記）
- 本リポジトリのコーディングおよびコミットを Antigravity が担当していることを GitHub 上でも明確に識別できるよう、すべてのコミットメッセージ末尾に以下のトレーラーを必ず付与すること：
  ```text
  Co-authored-by: Antigravity <noreply@google.com>
  ```
- コミット時の `Author` はリポジトリのローカル Git 設定（オーナー）を維持し、`Co-authored-by` によって Antigravity をコントリビューターとして記録する。

## 3. Git ブランチ・バージョニング運用
- ファーストリリースまではベースバージョン `0.0.0`（セマンティックバージョニング）を維持すること。
- 開発版（`channel: "develop"`）と本番版（`channel: "production"`）を `version.json` / `js/version.js` で識別し、開発版のコミットごとに `revision` を `1` ずつインクリメントすること（`npm run bump:rev` または `.githooks/pre-commit` により自動更新）。
- `develop` ブランチは恒久的に残し、削除しないこと。
- 新機能・修正・ドキュメント更新は `develop` からトピックブランチ（`feat/*`, `fix/*`, `docs/*`）を切って作業し、`develop` へマージした後にトピックブランチを削除すること。
- リリース時は `node scripts/bump-revision.js --channel production`（および必要に応じて `--set-version`）で本番版に切り替えて `develop` から `main` へ PR・マージ・タグ付与を行い、リリース後は `develop` 側を `--channel develop` に戻して開発を継続すること。
