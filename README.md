# AE Tiny Scripts Launcher

**Adobe After Effects** 向けの軽量・ドッキング可能な **CEP エクステンション（Launch Pad 代替ツール）** です。**スクリプト（`.jsx` / `.jsxbin`）**、**エクスプレッション（Expression）**、**アニメーションプリセット（`.ffx`）** を一元管理し、素早く実行・適用できます。

> **現在のバージョン:** `0.0.0`（プレリリース中。セマンティックバージョニングを採用し、ファーストリリースまでは `0.0.0` を維持します）

---

## 主な機能

- **CEP ドッキングパネル**: Adobe CEP v11（`CSXS 9.0+` / After Effects `16.0+`）および `--enable-nodejs` に対応し、After Effects 本体のテーマカラー（ダーク / ライト）に自動追従します。
- **アイコン型（グリッド）＆リスト型の表示切替**: コンパクトなアイコン型表示（Small / Medium / Large）と詳細なリスト型表示をワンクリックで切り替えられます。
- **表示順の並び替え**: ドラッグ＆ドロップおよび上下移動ボタン（`⇅ Reorder`）によるカスタム順並び替えのほか、名前順（A-Z / Z-A）・種別順でのソートに対応しています。
- **別 GitHub レポジトリからのスクリプト自動同期**: 指定した GitHub レポジトリ（`owner/repo`、ブランチ、サブディレクトリ、任意トークン）からスクリプト・エクスプレッション・`.ffx` を自動取得・ダウンロードします。
- **手動での追加・編集・削除**: GitHub 同期アイテムとは別に、ローカルファイルやインラインの ExtendScript / Expression を手動で登録・編集・削除できます。
- **Expression / FFX 適用先セレクタ UI**:
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
│   ├── app.js                # メイン UI コントローラ＆適用先選択モーダル
│   ├── github-sync.js        # GitHub レポジトリ走査・ファイル自動ダウンローダー
│   ├── store.js              # ローカル永続化（JSON / localStorage）＆並び順管理
│   └── updater.js            # SemVer 対応 GitHub Releases 自動アップデータ
├── jsx/
│   └── hostscript.jsx        # After Effects ExtendScript ホストブリッジ
├── scripts/
│   ├── install-dev.sh        # macOS 開発用シンボリックリンク & PlayerDebugMode 設定スクリプト
│   └── validate.js           # Node.js 検証・単体テストスイート
├── .debug                    # CEP リモートデバッグポート設定 (8088)
├── AGENTS.md                 # AI エージェント向け開発・コミット規約
├── index.html                # パネルエントリポイント
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

---

## 開発ルール・Git ブランチ運用

- **ドキュメント言語**: 本プロジェクトのドキュメント（README、CHANGELOG、設計メモ等）は**常に日本語**で記述します。
- **ブランチ運用**:
  - `main`: リリース用ブランチ（初期状態は空コミット）。
  - `develop`: 恒久的な統合開発ブランチ（**リリース後も削除せず維持します**）。
  - `feat/*`, `fix/*`, `docs/*`: `develop` から機能・作業単位で切り出し、`develop` へマージ後に削除します。
- **リリース手順**:
  1. `package.json`、`CSXS/manifest.xml`、`js/store.js`、`js/updater.js`、`CHANGELOG.md` のバージョンを一括更新します。
  2. `develop` から `main` へ Pull Request を作成してマージします。
  3. `main` にリリースタグ（例: `v0.1.0` / `v1.0.0`）を打ち、GitHub Release を公開します。

---

## コントリビューター（Contributors）

- **Itsuro Sasakura** — オーナー / 企画・要件定義
- **Antigravity**（Google Antigravity）— AI コントリビューター（実装・コーディング・テスト・コミット担当）
  - コミット時には GitHub 上でコントリビュートが識別できるよう、`Co-authored-by: Antigravity <noreply@google.com>` トレーラーを付与して運用します。

---

## ライセンス

[MIT License](LICENSE) の下で公開されています。
