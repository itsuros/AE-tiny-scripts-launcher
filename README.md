# AE Tiny Scripts Launcher

**Adobe After Effects** 向けの軽量・ドッキング可能な **CEP エクステンション（Launch Pad 代替ツール）** です。**スクリプト（`.jsx` / `.jsxbin`）**、**エクスプレッション（Expression）**、**アニメーションプリセット（`.ffx`）** を一元管理し、素早く実行・適用できます。

> **現在のバージョン:** `0.0.0`（プレリリース中。セマンティックバージョニングを採用し、ファーストリリースまでは `0.0.0` を維持します）

---

## 主な機能

- **CEP ドッキングパネル（After Effects ネイティブ UI 準拠）**: Adobe CEP v11（`CSXS 9.0+` / After Effects `16.0+`）および `--enable-nodejs` に対応。[ae-theme.js](js/ae-theme.js) により After Effects の「アピアランス（明るさ）」スライダーやハイライトカラー・フォント設定へリアルタイムに追従し、暗い背景から明るい背景までネイティブパネルと違和感なく調和します。パネル横幅を狭くした場合は、バージョン表示が自動でアイコン表示へ切り替わりレイアウト崩れを防ぎます。
- **アイコン型（グリッド）＆リスト型の表示切替・カードサイズ変更＆リセット**: ツールバーの `Size` スライダー（55%〜140%）でカード UI 全体を拡大・縮小でき、`↺` / `Reset` ボタンでワンクリックで 100% にリセットできます。縮小時はコンパクト表示に切り替えて画面内に多くのツールを一覧できます。
- **常時表示インクリメンタル検索＆設定内ヘルプウィンドウ**: 虫眼鏡アイコンがテキストと重ならないレイアウトの常時表示検索欄で、入力と同時にインクリメンタル検索できます（検索ボタン不要）。設定画面ヘッダには別ウィンドウで日本語ヘルプ（`help.html`）を開くアイコンボタンを備えています。
- **Script / Expression / FFX の個別バージョン管理（Launcher 本体と分離）**:
  - 各 Script・Expression・FFX は Launcher 本体のバージョン（`version.json`）とは独立した `version` を保持します。
  - `.jsx` / `.expr*` 先頭コメントの `@version 1.2.3`・`Version: 1.2.3`・`var VERSION = "1.2.3"`、`.ffx` / `.jsxbin` 向けのサイドカー `<ファイル名>.meta.json`、GitHub レポジトリ側の `launcher-manifest.json`、および Add/Edit 画面の手動入力から読み取り・管理できます。
- **表示順の並び替え**: ドラッグ＆ドロップおよび上下移動ボタン（`⇅ Reorder`）によるカスタム順並び替えのほか、名前順（A-Z / Z-A）・種別順でのソートに対応しています。
- **ローカル `AE-tiny-scripts` 専用読み込み＆複数ローカルフォルダ＆GitHub 同期**:
  - **ローカル `AE-tiny-scripts` 専用オプション**: Settings 画面の「Local `AE-tiny-scripts` Repository」を有効にしてローカル配置パス（`Auto` 自動検出対応）および任意サブディレクトリを指定すると、`launcher-manifest.json`・同名アイコン・個別バージョンを含めて `TINY` ソースとして専用管理・読み込みできます。
  - **ローカルフォルダ**: Settings 画面で複数のフォルダパスを登録し、配下の `.jsx` / `.jsxbin` / `.expr.js` / `.expr.txt` / `.expr` / `.ffx` を再帰スキャンして自動登録できます。
  - **GitHub レポジトリ**: 指定した GitHub レポジトリ（`owner/repo`、ブランチ、サブディレクトリ、任意トークン）から自動取得・ダウンロードします。
- **同名画像の既定アイコン自動適用**: スクリプト（または Expression / FFX）と同一ディレクトリに同名の画像ファイル（`.png` / `.svg` / `.jpg` / `.jpeg` / `.webp` / `.gif` / `.ico`）が存在する場合、既定値としてその画像をアイコンに使用します（ローカルフォルダ・GitHub 同期・手動追加のいずれにも対応）。
- **手動での追加・編集・削除**: GitHub 同期アイテムとは別に、ローカルファイルやインラインの ExtendScript / Expression を手動で登録・編集・削除できます。
- **Expression / FFX 適用先セレクタ UI（外部フローティングウィンドウ表示）**:
  - ドッキングされたメインパネルの内側に窮屈に表示されないよう、CEP の独立した `Modeless` ウィンドウ（`com.ae.tinyscripts.launcher.targetpicker`）として CEP パネルの外側に表示します（AE 本体のタイムライン操作を妨げず、選択更新も可能）。
  - **Expression**: 「AE タイムラインで選択中のプロパティ」「共通プロパティプリセット（Position / Scale / Rotation / Opacity / Anchor Point / Time Remap）」「レイヤープロパティツリー検索」から適用先を選択可能です。適用モード（置換 / 末尾追記 / 先頭挿入）やキーフレーム処理（保持 / 現在値で固定して削除 / 全削除）も指定できます。
  - **FFX プリセット**: 「AE で選択中のレイヤー」「コンポ内レイヤーからチェック選択」「新規調整レイヤー」「新規平面」「新規ヌルオブジェクト」から適用先を選べます。適用時間基準（現在時刻 / インポイント / 0:00）、既存エフェクト削除、トランスフォームキーフレーム削除のオプションも備えています。
- **本体自動アップデート機能**: GitHub Releases API を参照して新しいセマンティックバージョンを検知し、リリースアーカイブのダウンロード・展開・パネル再読み込みを行います。

---

## ディレクトリ構成

```text
AE-tiny-scripts-launcher/
├── CSXS/
│   └── manifest.xml          # Adobe CEP エクステンションマニフェスト (v11 / AEFT)
├── assets/
│   └── icon.svg              # パネルアイコン
├── css/
│   └── styles.css            # CEP テーマ適応型 UI スタイルシート
├── js/
│   ├── lib/
│   │   └── CSInterface.js    # Adobe CEP CSInterface ラッパー（単体プレビュー用モック含む）
│   ├── ae-theme.js           # AE ネイティブ UI 明るさ・ハイライトカラー連動テーマエンジン
│   ├── app.js                # メイン UI コントローラ
│   ├── github-sync.js        # GitHub レポジトリ走査・ファイル＆同名アイコン自動ダウンローダー
│   ├── icon-resolver.js      # 同名画像アイコン検出 & file:// URL 変換ヘルパー
│   ├── local-sync.js         # 複数ローカルフォルダ走査・読み込みモジュール
│   ├── store.js              # ローカル永続化（JSON / localStorage）＆並び順管理
│   ├── target-picker.js      # Expression / FFX 適用先セレクタ共通コントローラ
│   └── updater.js            # SemVer 対応 GitHub Releases 自動アップデータ
├── docs/
│   └── uxp-migration-notes.md # UXP プラグイン移行方針・スケジュール記録
├── jsx/
│   └── hostscript.jsx        # After Effects ExtendScript ホストブリッジ
├── scripts/
│   ├── install-dev.bat       # Windows 開発用バッチラッパー（PowerShell 実行）
│   ├── install-dev.ps1       # Windows 開発用ジャンクション & PlayerDebugMode 設定スクリプト
│   ├── install-dev.sh        # macOS 開発用シンボリックリンク & PlayerDebugMode 設定スクリプト
│   └── validate.js           # Node.js 検証・単体テストスイート
├── .debug                    # CEP リモートデバッグポート設定 (8088 / 8089 / 8090)
├── AGENTS.md                 # AI エージェント向け開発・コミット規約
├── help.html                 # 日本語ヘルプ別ウィンドウ
├── index.html                # メインパネルエントリポイント
├── target-picker.html        # 外部フローティング適用先選択ウィンドウ
├── package.json              # パッケージ定義 (version 0.0.0)
├── CHANGELOG.md              # 変更履歴
└── LICENSE                   # MIT ライセンス
```

---

## 開発環境のセットアップ（macOS）

1. 開発用セットアップスクリプトを実行し、CEP 拡張フォルダへのシンボリックリンク作成と `PlayerDebugMode` の有効化を行います。
   ```bash
   ./scripts/install-dev.sh
   ```
   リンク先: `~/Library/Application Support/Adobe/CEP/extensions/com.ae.tinyscripts.launcher`
2. **Adobe After Effects** を再起動します。
3. メニューの **ウィンドウ > エクステンション > AE Tiny Scripts Launcher** からパネルを開きます。
4. （任意）リモートデバッグを行う場合は Chrome 等で `http://localhost:8088` にアクセスします。

### 開発環境のアンインストール（macOS）

1. **CEP 拡張リンクの解除**:
   ```bash
   ./scripts/install-dev.sh --uninstall
   ```
   （または `rm "$HOME/Library/Application Support/Adobe/CEP/extensions/com.ae.tinyscripts.launcher"` で直接リンクを削除）
2. **（任意）ローカル保存データ・キャッシュの削除**:
   ```bash
   rm -rf "$HOME/Library/Application Support/AETinyScriptsLauncher"
   ```
3. **（任意）`PlayerDebugMode` を元に戻す場合**:
   他の未署名 CEP 拡張も開発している場合はそのままにしてください。無効化する場合は以下を実行し、After Effects を再起動します。
   ```bash
   for ver in 9 10 11 12; do defaults delete com.adobe.CSXS.$ver PlayerDebugMode 2>/dev/null || true; done
   ```

---

## 開発環境のセットアップ（Windows）

1. PowerShell またはコマンドプロンプトから Windows 用セットアップスクリプトを実行します（`%APPDATA%` 配下へのジャンクション作成および `HKCU` レジストリ設定のため、**管理者権限は不要**です）。
   - **PowerShell から実行する場合**:
     ```powershell
     powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dev.ps1
     ```
   - **コマンドプロンプト / エクスプローラーから実行する場合**:
     ```bat
     scripts\install-dev.bat
     ```
   - **npm スクリプトから実行する場合**:
     ```bat
     npm run setup:win
     ```
   このスクリプトにより以下が自動設定されます。
   - リンク先（ジャンクション）: `%APPDATA%\Adobe\CEP\extensions\com.ae.tinyscripts.launcher`
   - レジストリ（`HKEY_CURRENT_USER\Software\Adobe\CSXS.9` 〜 `CSXS.12`）の `PlayerDebugMode` を `"1"` に設定
2. **Adobe After Effects** を再起動します。
3. メニューの **ウィンドウ > エクステンション > AE Tiny Scripts Launcher** からパネルを開きます。
4. （任意）リモートデバッグを行う場合は Chrome / Edge 等で `http://localhost:8088` にアクセスします。

### 開発環境のアンインストール（Windows）

1. **CEP 拡張ジャンクションの解除**:
   - PowerShell から実行する場合:
     ```powershell
     powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dev.ps1 -Uninstall
     ```
   - コマンドプロンプトから実行する場合:
     ```bat
     scripts\install-dev.bat -Uninstall
     ```
   （手動で削除する場合は、エクスプローラーまたは `rmdir "%APPDATA%\Adobe\CEP\extensions\com.ae.tinyscripts.launcher"` でジャンクションを削除してください）
2. **（任意）ローカル保存データ・キャッシュの削除**:
   - PowerShell:
     ```powershell
     Remove-Item -LiteralPath "$env:APPDATA\AETinyScriptsLauncher" -Recurse -Force -ErrorAction SilentlyContinue
     ```
   - コマンドプロンプト:
     ```bat
     rmdir /s /q "%APPDATA%\AETinyScriptsLauncher"
     ```
3. **（任意）`PlayerDebugMode` を元に戻す場合**:
   他の未署名 CEP 拡張も開発している場合はそのままにしてください。無効化する場合は PowerShell で以下を実行し、After Effects を再起動します。
   ```powershell
   foreach ($ver in @(9, 10, 11, 12)) { Remove-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$ver" -Name "PlayerDebugMode" -ErrorAction SilentlyContinue }
   ```

### テストの実行

```bash
npm test
```

---

## GitHub スクリプト同期レポジトリの規約

**Settings > GitHub Scripts Repository Sync** で対象レポジトリを設定すると、指定ブランチ（および任意のサブディレクトリ）配下を再帰走査し、拡張子に応じて自動で種別を判定します。

| 拡張子 | Launcher 上の種別 |
| :--- | :--- |
| `.jsx`, `.jsxbin` | **Script** |
| `.expr.js`, `.expr.txt`, `.expr` | **Expression** |
| `.ffx` | **Animation Preset (FFX)** |

ダウンロード済みファイルおよび設定データはローカルの以下に保存されます。
- macOS: `~/Library/Application Support/AETinyScriptsLauncher/`
- Windows: `%APPDATA%\AETinyScriptsLauncher\`

### 個別バージョン・バンドルバージョンを GitHub 側で指定する場合（任意）

スクリプト同期先レポジトリに `launcher-manifest.json` を配置すると、Launcher 本体とは独立したスクリプト集バージョンや個別アイテムのバージョンを指定できます（未配置でも `.jsx` / `.expr*` 内の `@version` コメントから自動抽出されます）。

```json
{
  "version": "1.2.0",
  "items": {
    "presets/glow.ffx": {
      "version": "2.0.1",
      "description": "Glow animation preset"
    }
  }
}
```

---

## 開発ルール・Git ブランチ運用

- **ドキュメント言語**: 本プロジェクトのドキュメント（README、CHANGELOG、設計メモ等）は**常に日本語**で記述します。
- **開発版（`develop`）と本番版（`production`）のバージョン識別・リビジョン管理**:
  - `version.json` および `js/version.js` で `version`・`channel`（`"develop"` / `"production"`）・`revision` を管理しています。
  - **開発版（`develop`）**: コミットごとに `revision` を 1 つずつインクリメントし、UI 上に **`DEV v0.0.0 (rev.26)`**（適用先選択ウィンドウには **`DEV r26`**）のようにリビジョンを表示します。
  - **本番版（`production`）**: リビジョン表示を省き、**`v0.0.0`**（リリース後の該当バージョン）および設定画面に `[PRODUCTION]` と表示します。
  - `.githooks/pre-commit` を有効化（`npm run setup:hooks` または `install-dev` スクリプト実行時に自動設定）しておくと、`develop` 系の通常コミット時に自動で `revision` が `+1` されます（手動実行は `npm run bump:rev`）。
- **ブランチ運用**:
  - `main`: リリース用ブランチ（初期状態は空コミット）。
  - `develop`: 恒久的な統合開発ブランチ（**リリース後も削除せず維持します**）。
  - `feat/*`, `fix/*`, `docs/*`: `develop` から機能・作業単位で切り出し、`develop` へマージ後に削除します。
- **リリース手順**:
  1. `node scripts/bump-revision.js --channel production` で本番チャネルへ切り替え、`package.json`、`CSXS/manifest.xml`、`version.json`、`js/version.js`、`CHANGELOG.md` のバージョンを一括更新します。
  2. `develop` から `main` へ Pull Request を作成してマージします。
  3. `main` にリリースタグ（例: `v0.1.0` / `v1.0.0`）を打ち、GitHub Release を公開します。
  4. リリース後、`develop` 側で `node scripts/bump-revision.js --channel develop` を実行して開発チャネルへ戻します。

---

## 今後の計画・UXP プラグインへの移行方針（ロードマップ）

- **背景・公式スケジュール**:
  - 2026年9月24日の Adobe 発表にて、After Effects の UXP 対応スケジュールとして `After Effects: Public beta UXP plugins by November 2026.` が案内されました。
  - 2026年11月11日には、Adobe より **CEP から UXP プラグインへの移行** が正式に発表されました。
- **移行方針**:
  - After Effects 本体の UXP 対応が完了した後、**本リポジトリを fork して UXP プラグイン版へリファクタリングする作業**を実施します（それまでは本リポジトリを CEP 版として維持します）。
  - 移行時の技術的検討メモは [docs/uxp-migration-notes.md](docs/uxp-migration-notes.md) に記録しています。
- **参考 URL**:
  - https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications
  - https://helpx.adobe.com/jp/creative-cloud/apps/integration-with-other-apps/manage-plugins/cep-uxp-plugin-transition.html

---

## コントリビューター（Contributors）

- **Itsuro Sasakura** — オーナー / 企画・要件定義
- **Antigravity**（Google Antigravity）— AI コントリビューター（実装・コーディング・テスト・コミット担当）
  - コミット時には GitHub 上でコントリビュートが識別できるよう、`Co-authored-by: Antigravity <noreply@google.com>` トレーラーを付与して運用します。

---

## ライセンス

[MIT License](LICENSE) の下で公開されています。
