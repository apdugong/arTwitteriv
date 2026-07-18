# GitHub・Codex移行手順

## 1. ローカルGitを開始する

```bash
cd /path/to/arTwitteriv
./setup_git.sh
```

コミット時に氏名・メールアドレスの設定を求められた場合：

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR_EMAIL@example.com"
./setup_git.sh
```

## 2. GitHubへ置く

### GitHub CLIを使う方法

GitHub CLIでログイン済みなら、リポジトリのフォルダ内で実行します。

```bash
gh repo create arTwitteriv --private --source=. --remote=origin --push
```

公開リポジトリにする場合は `--private` を `--public` に変えます。

### GitHubウェブサイトを使う方法

1. GitHubで空のリポジトリ `arTwitteriv` を作る
2. README、`.gitignore`、licenseをGitHub側では追加しない
3. 表示されたURLを使い、ローカルで次を実行する

```bash
git remote add origin https://github.com/YOUR_USERNAME/arTwitteriv.git
git push -u origin main
```

## 3. Codexで開く

1. CodexへChatGPTアカウントでサインインする
2. プロジェクト追加画面で、このローカルの `arTwitteriv` フォルダを選ぶ
3. 最初の依頼として、下記のプロンプトを送る

```text
このリポジトリは、arXiv論文をSNS風タイムラインで表示するManifest V3のChrome拡張 arTwitteriv です。

最初に AGENTS.md、README.md、CHANGELOG.md とコード全体を読み、現状を監査してください。

1. 現在実装されている機能を整理する
2. manifest、HTML、JavaScript間の参照切れを検査する
3. npm test を実行する
4. arXivのabstract/PDF URLから v1、v2 などの版番号が確実に除去されるか確認する
5. 分野プリセット編集、期間・引用数指定のランダム機能、引用数ベースの名著機能を確認する
6. Semantic Scholarのレート制限、取得失敗、未収録論文に対する挙動を確認する
7. 問題を重要度順に報告する

この最初の作業では、大規模なリファクタリングを行わないでください。明白な小さな不具合だけ修正し、変更した場合は CHANGELOG.md を更新してください。
```

## 4. 以後の作業方法

1機能ずつCodexに依頼し、作業後に差分を確認します。

```bash
git status
git diff
npm test
```

問題なければコミットします。

```bash
git add .
git commit -m "Describe the change"
git push
```

安定版にはタグを付けます。

```bash
git tag v0.4.1
git push origin v0.4.1
```

Chromeでの実動作確認は自動検査だけでは代替できません。主要変更後は `chrome://extensions` から拡張を再読み込みし、各タイムラインと設定保存を確認してください。
