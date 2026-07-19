# GitHub And Codex Migration Notes

## 1. Initialize Local Git

```bash
cd /path/to/arTwitteriv
./setup_git.sh
```

If Git asks for a name or email address when committing, configure them first:

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR_EMAIL@example.com"
./setup_git.sh
```

For privacy on public GitHub repositories, prefer a GitHub noreply address.

## 2. Put The Repository On GitHub

### With GitHub CLI

If you are signed in with GitHub CLI, run this from the repository folder:

```bash
gh repo create arTwitteriv --private --source=. --remote=origin --push
```

Change `--private` to `--public` when you are ready to publish.

### With The GitHub Website

1. Create an empty GitHub repository named `arTwitteriv`.
2. Do not add a README, `.gitignore`, or license on GitHub.
3. Use the URL shown by GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/arTwitteriv.git
git push -u origin main
```

## 3. Open The Project In Codex

1. Sign in to Codex with your ChatGPT account.
2. Add this local `arTwitteriv` folder as a project.
3. For the first review, you can ask Codex:

```text
This repository is arTwitteriv, a Manifest V3 Chrome extension that displays arXiv papers in a social-media-style timeline.

First, read AGENTS.md, README.md, CHANGELOG.md, and the codebase, then audit the current state.

1. Summarize the currently implemented features.
2. Check for broken references among manifest, HTML, and JavaScript files.
3. Run npm test.
4. Confirm arXiv version suffixes such as v1 and v2 are reliably removed from abstract and PDF URLs.
5. Confirm editable field presets, random date/citation filters, and citation-based classics behavior.
6. Confirm Semantic Scholar behavior for rate limits, fetch failures, and papers missing from the index.
7. Report problems in severity order.

For this first pass, do not perform a large refactor. Fix only obvious small bugs, and update CHANGELOG.md if you change user-visible behavior.
```

## 4. Ongoing Workflow

Ask Codex for one focused change at a time, then review the result:

```bash
git status
git diff
npm test
```

If the diff looks good:

```bash
git add .
git commit -m "Describe the change"
git push
```

For stable releases:

```bash
git tag v0.4.11
git push origin v0.4.11
```

Automated checks do not replace manual Chrome testing. After significant changes, reload the extension from `chrome://extensions` and verify the popup, each timeline, settings persistence, and latest-version abstract/PDF links.
