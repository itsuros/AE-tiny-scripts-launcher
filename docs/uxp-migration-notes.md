# UXP プラグイン移行に関する記録・リファクタリング方針メモ

## 1. 背景および Adobe 公式発表スケジュール

- **2026年9月24日**: Adobe Developer Blog にて、Creative Cloud 主力アプリケーションへの UXP（Unified Extensibility Platform）導入に関する案内が公開され、After Effects については以下のスケジュールが提示されました。
  - `After Effects: Public beta UXP plugins by November 2026.`
- **2026年11月11日**: Adobe から **CEP（Common Extensibility Platform）から UXP プラグインへの移行** が正式に案内されました。

### 参考 URL
- Adobe Developer Blog（2026年9月24日）:
  https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications
- Adobe HelpX（CEP から UXP プラグインへの移行）:
  https://helpx.adobe.com/jp/creative-cloud/apps/integration-with-other-apps/manage-plugins/cep-uxp-plugin-transition.html

---

## 2. 本プロジェクトにおける今後の開発・移行方針

1. **現行 CEP 版の維持**:
   - After Effects 本体側の UXP 対応（パブリックベータから正式版・主要 API 整備）が完了するまでの間は、本リポジトリを **CEP 版** として維持・運用します。
2. **Fork による UXP 版へのリファクタリング**:
   - After Effects 本体側の UXP 対応完了後、本プロジェクトを **fork** して **UXP プラグイン版** として新規にリファクタリングする作業を実施します。

---

## 3. UXP 移行時に想定される主なリファクタリング箇所

| 現行（CEP 版） | UXP 版での移行先・検討事項 |
| :--- | :--- |
| `CSXS/manifest.xml` | UXP 用 `manifest.json`（`manifestVersion: 5`、`host.app: "AEFT"`、必要な `requiredPermissions` 定義） |
| `js/lib/CSInterface.js` + `jsx/hostscript.jsx`（ExtendScript） | After Effects UXP DOM API / Host API（`require("aftereffects")` 等）への全面書き換え、および既存 `.jsx` / `.jsxbin` スクリプト実行互換性の確認・対応方法の設計 |
| 外部フローティングウィンドウ（`target-picker.html` / `help.html`：`Type="Modeless"`） | UXP ダイアログ API（`dialog.uxpShowModal` 等）または UXP マルチパネル定義・UI コンポーネントへの再設計 |
| Node.js `fs` / `os` / `https`（`store.js`, `local-sync.js`, `github-sync.js`, `icon-resolver.js`, `updater.js`） | UXP `storage.localFileSystem`（およびトークンベースアクセス / `network` 権限付き `fetch`）への置き換え |
| ローカル画像アイコン表示（`file://` URL） | UXP ファイルトークン / `uxp-internal` または Blob / Data URL 読み込みへの変換 |
| 自動アップデート機構（ZIP 展開・自己上書き） | UXP プラグインの配布・更新形態（`.ccx` / Marketplace / 自己更新可否）に合わせた見直し |
