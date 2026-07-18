# arTwitteriv

arXiv論文を、SNSの投稿のような縦型タイムラインで眺めるManifest V3のChrome拡張です。

## 現在の機能

- 新着タイムライン
- 指定分野・期間・引用数範囲から選ぶランダムタイムライン
- 固定リストを使わず、その都度取得した論文を引用数で絞る「名著」タイムライン
- 分野タブの追加・編集・削除
- 保存済みタイムライン
- arXivの版番号を除いたURLでabstractとPDFの最新版を開く

引用数にはSemantic Scholar Academic Graph APIを利用します。APIのレート制限や未収録論文により、引用数を取得できない場合があります。

## Chromeへの読み込み

1. Chromeで `chrome://extensions` を開く
2. 「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. この `arTwitteriv` フォルダを選ぶ

## 検査

Node.js 18以降を用意し、次を実行します。

```bash
npm test
```

外部パッケージへの依存はないため、`npm install` は不要です。

## Gitの開始

ターミナルでこのフォルダへ移動し、同梱スクリプトを実行します。

```bash
./setup_git.sh
```

手動で行う場合は次のとおりです。

```bash
git init
git branch -M main
git add .
git commit -m "Initial import of arTwitteriv"
```

GitHubへ公開または非公開で置く方法とCodexへの移行手順は、`MIGRATION.md` を参照してください。

Disclaimer

arTwitteriv is an independent, unofficial open-source project.

It is not affiliated with, endorsed by, or sponsored by arXiv, X Corp., or Twitter. “arXiv” and related marks belong to their respective owners.

This project has been developed substantially with the assistance of generative AI, including AI-generated code, documentation, and design suggestions. The resulting software is reviewed and maintained by the project owner, but it may still contain errors, incomplete implementations, or unintended behavior.

Users should independently verify important information obtained through this application, including paper metadata, citation counts, and external links.
