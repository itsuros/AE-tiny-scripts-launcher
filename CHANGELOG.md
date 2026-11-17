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
- **データストア・複数ローカルフォルダ＆GitHub 自動同期（`js/store.js`, `js/local-sync.js`, `js/github-sync.js`, `js/icon-resolver.js`）**:
  - ローカル永続化（`launcher-state.json` + `localStorage` フォールバック）およびスターターアイテム。
  - ローカルに配置した `AE-tiny-scripts` レポジトリを読み込む専用オプション（`localTinyScriptsRepo`：`Auto` 自動検出、`subPath` 指定、`launcher-manifest.json` 対応、`TINY` ソース分離管理）を実装。
  - 複数ローカルフォルダのパス登録・再帰スキャンによる自動読み込み（`LocalSync`）。
  - GitHub レポジトリの再帰走査による自動ダウンロードと拡張子ベースの自動種別判定（`.jsx` / `.jsxbin`, `.expr.js` / `.expr.txt` / `.expr`, `.ffx`）。
  - 同一ディレクトリ内の同名画像ファイル（`.png`, `.svg`, `.jpg` 等）を既定アイコンとして自動検出・適用する `IconResolver` を実装。
  - 手動追加・編集・削除、およびドラッグ＆ドロップ・上下ボタンによるカスタム表示順管理。
- **本体自動アップデート（`js/updater.js`）**:
  - セマンティックバージョン比較および GitHub Releases API からのアーカイブ取得・展開・リロード処理。
- **ランチャー UI & 外部ウィンドウ群（`index.html`, `target-picker.html`, `help.html`, `css/styles.css`, `js/app.js`, `js/target-picker.js`）**:
  - ホストテーマ追従のダーク/ライト UI（幅 6px の AE テーマ適応型カスタムスクロールバーを含む）、アイコン型（グリッド）/ リスト型表示切替、カード UI 全体のスケーリング（55%〜140%・サイズリセットボタン・コンパクト表示自動切替）、アイコンとテキストが重ならない常時表示インクリメンタル検索＆並び替え機能。
  - リストビューでは 1 行目にタイトルのみを表示し、2 行目に種別・バージョン・ソース・タグを移動（説明文はツールチップ表示に集約）。
  - ウィンドウ横幅が狭い場合にバージョン表記を自動でアイコン表示へ切り替えるレスポンシブ対応。
  - 設定ウィンドウ内に別ウィンドウで日本語ヘルプ（`help.html` / `com.ae.tinyscripts.launcher.help`）を開くアイコンボタンを追加。
  - CEP の `Modeless` サブ拡張（`com.ae.tinyscripts.launcher.targetpicker`）として CEP パネル外に独立表示するフローティング適用先選択ウィンドウを実装。
  - Expression 適用先選択 UI（選択プロパティ / プリセット / レイヤープロパティツリー）および適用モード・キーフレーム処理オプション。
  - FFX 適用先選択 UI（AE 選択レイヤー / レイヤー個別選択 / 新規調整レイヤー / 新規平面 / 新規ヌル）および時間基準・既存エフェクト削除・キーフレーム処理オプション。
- **Script / Expression / FFX の独立バージョン管理（`js/store.js`, `js/local-sync.js`, `js/github-sync.js`, `js/app.js`, `js/target-picker.js`）**:
  - 各スクリプト・Expression・FFX のバージョン（`item.version`）を Launcher 本体のバージョン（`version.json`）とは完全に分離して管理・表示する仕組みを実装。
  - `@version` / `Version:` / `VERSION =` ヘッダ解析、サイドカー `.meta.json`、GitHub レポジトリ側の `launcher-manifest.json`、および Add/Edit モーダルでの手動編集に対応。
- **開発版リビジョン管理 & 本番/開発チャネル識別（`version.json`, `js/version.js`, `scripts/bump-revision.js`, `.githooks/pre-commit`）**:
  - `develop` 版と `production` 版のチャネル識別を追加し、開発版では UI ヘッダ（`DEV v0.0.0 (rev.N)`）・外部適用先ウィンドウ（`DEV rN`）・設定画面にリビジョン番号を表示するよう変更。
  - コミットごとに `revision` を自動で 1 つずつ繰り上げるスクリプトと Git `pre-commit` フックを追加。
- **検証・ドキュメント（`scripts/validate.js`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `LICENSE`）**:
  - MIT ライセンス、日本語ドキュメント、開発・Git 運用規約、および Node.js 検証テストスイート。
