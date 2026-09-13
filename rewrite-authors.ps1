#!/usr/bin/env powershell

# Script to rewrite git history and change author names

$env:GIT_COMMITTER_NAME = "just-bamford"
$env:GIT_COMMITTER_EMAIL = "bamfordjnr5@gmail.com"

# Use git filter-branch to rewrite all commits by heymariam
git filter-branch -f --env-filter `
'if [ "$GIT_AUTHOR_NAME" = "heymariam" ]; then
  export GIT_AUTHOR_NAME="just-bamford"
  export GIT_AUTHOR_EMAIL="bamfordjnr5@gmail.com"
fi
if [ "$GIT_COMMITTER_NAME" = "heymariam" ]; then
  export GIT_COMMITTER_NAME="just-bamford"
  export GIT_COMMITTER_EMAIL="bamfordjnr5@gmail.com"
fi' -- --all

Write-Host "Rewrite complete. Now run: git push -f origin main"
