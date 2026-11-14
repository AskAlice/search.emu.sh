#!/usr/bin/env bash
# Publish HEAD to production: push, wait for Vercel's git-built preview of this commit, promote it.
# Promoting the git build (instead of `vercel --prod` from this directory) never uploads local
# .env*.local secret files.
set -euo pipefail

project=search-emu-sh
sha=$(git rev-parse HEAD)

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Note: uncommitted changes are not deployed (only committed HEAD is)." >&2
fi

git push origin HEAD

echo "Waiting for the Vercel build of ${sha:0:7}..."
url=""
for _ in $(seq 60); do
  url=$(vercel ls "$project" --meta "githubCommitSha=$sha" 2>/dev/null | head -1 || true)
  [ -n "$url" ] && break
  sleep 5
done
[ -n "$url" ] || { echo "No Vercel deployment found for $sha after 5 minutes." >&2; exit 1; }

vercel inspect "$url" --wait --timeout 10m >/dev/null
vercel promote "$url" --yes
echo "Promoted $url to production."
