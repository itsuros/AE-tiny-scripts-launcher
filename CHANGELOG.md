# 更新履歴（Changelog）

**AE Tiny Scripts Launcher** の主な変更履歴を記載します。

本ファイルは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、バージョニングには [セマンティックバージョニング](https://semver.org/lang/ja/) を採用しています。
ファーストリリースまではバージョン `0.0.0` を維持します。

## [Unreleased] - 0.0.0

### 追加（Added）
- **CEP 基盤（`CSXS/manifest.xml`, `.debug`, `js/lib/CSInterface.js`, `jsx/hostscript.jsx`）**:
  - Adobe After Effects CEP v11 パネル構成（`--enable-nodejs` / `--mixed-context` 有効）。
  - `.jsx` / `.jsxbin` / インラインスクリプト実行、アクティブコンポ・選択レイヤー・選択プロパティ取得、レイヤープロパティツリー列挙を行う ExtendScript ホストブリッジ。
  - macOS 開発用シンボリックリンク・`PlayerDebugMode` 設定・アンインストール（`--uninstall`）スクリプト（`scripts/install-dev.sh`）。
  - Windows 開発用ジャンクション・`PlayerDebugMode` レジストリ設定・アンインストール（`-Uninstall`）スクリプト（`scripts/install-dev.ps1`, `scripts/install-dev.bat`）。
- **データストア・GitHub 自動同期（`js/store.js`, `js/github-sync.js`）**:
  - ローカル永続化（`launcher-state.json` + `localStorage` フォールバック）およびスターターアイテム。
  - GitHub レポジトリの再帰走査による自動ダウンロードと拡張子ベースの自動種別判定（`.jsx` / `.jsxbin`, `.expr.js` / `.expr.txt` / `.expr`, `.ffx`）。
  - 手動追加・編集・削除、およびドラッグ＆ドロップ・上下ボタンによるカスタム表示順管理。
- **本体自動アップデート（`js/updater.js`）**:
  - セマンティックバージョン比較および GitHub Releases API からのアーカイブ取得・展開・リロード処理。
- **ランチャー UI & 外部適用先選択ウィンドウ（`index.html`, `target-picker.html`, `css/styles.css`, `js/app.js`, `js/target-picker.js`）**:
  - ホストテーマ追従のダーク/ライト UI、アイコン型（グリッド）/ リスト型表示切替、アイコンサイズ変更、検索・種別フィルタ・並び替え機能。
  - CEP の `Modeless` サブ拡張（`com.ae.tinyscripts.launcher.targetpicker`）として CEP パネル外に独立表示するフローティング適用先選択ウィンドウを実装。
  - Expression 適用先選択 UI（選択プロパティ / プリセット / レイヤープロパティツリー）および適用モード・キーフレーム処理オプション。
  - FFX 適用先選択 UI（AE 選択レイヤー / レイヤー個別選択 / 新規調整レイヤー / 新規平面 / 新規ヌル）および時間基準・既存エフェクト削除・キーフレーム処理オプション。
- **検証・ドキュメント（`scripts/validate.js`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `LICENSE`）**:
  - MIT ライセンス、日本語ドキュメント、開発・Git 運用規約、および Node.js 検証テストスイート。
