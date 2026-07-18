#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -d .git ]]; then
  echo "Git is already initialized in: $(pwd)"
  exit 0
fi

git init
git branch -M main
git add .
git commit -m "Initial import of arTwitteriv"

cat <<'MSG'

Git initialization complete.

Next, create an empty GitHub repository named arTwitteriv, then run either:

  gh repo create arTwitteriv --private --source=. --remote=origin --push

or, using the repository URL shown by GitHub:

  git remote add origin https://github.com/YOUR_USERNAME/arTwitteriv.git
  git push -u origin main
MSG
