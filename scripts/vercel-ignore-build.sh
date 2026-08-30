#!/usr/bin/env bash
# Reference copy of the Vercel "Ignored Build Step" — documentation, not wiring.
#
# NOTHING CALLS THIS FILE. The rule that actually governs deployments lives in
# the Vercel project itself, at Settings → Git → Ignored Build Step → Custom,
# as the self-contained one-liner reproduced at the bottom of this file. This
# copy exists so the logic is readable, reviewable and runnable in a repository
# somebody can clone, since a project setting is visible only to whoever holds
# the Vercel dashboard.
#
# It used to be the wiring, referenced by "ignoreCommand" in vercel.json. That
# arrangement could not work, and the reason is worth keeping: a rule that
# lives in a repository file cannot govern a branch that predates the file. On
# such a branch the command still runs, bash finds no script, exits non-zero —
# and in this inverted convention non-zero means BUILD. The mechanism failed
# open, on exactly the old feature branches it existed to stop. A project-level
# setting has no such blind spot: it applies to every branch, including ones
# created before it, because it is not carried by the branch.
#
# Exit 1 tells Vercel to build, exit 0 tells it to skip. The polarity is
# inverted from the usual shell convention, so the explicit exits below say
# which they mean.
#
# The Hobby plan allows 100 deployments a day. On 29 August 2026 roughly fifty
# pull requests and forty-five merges each produced one, the quota ran out, and
# the previews that actually matter — dev, and the payment pass — could no
# longer build. Feature branches are the volume; the release line is the value.
#
# So only the three promotion branches build by default. A feature branch that
# genuinely needs a preview opts in by putting [preview] in its commit message,
# which keeps the escape hatch in the commit that needs it rather than in a
# setting somebody has to remember to undo.
set -euo pipefail

branch="${VERCEL_GIT_COMMIT_REF:-}"
message="${VERCEL_GIT_COMMIT_MESSAGE:-}"

# Production must never depend on branch-name matching.
if [ "${VERCEL_ENV:-}" = 'production' ]; then
  echo "Building: production deployment."
  exit 1
fi

case "$branch" in
  dev | staging | main)
    echo "Building: ${branch} is a promotion branch."
    exit 1
    ;;
esac

case "$message" in
  *'[preview]'*)
    echo "Building: commit message opts in with [preview]."
    exit 1
    ;;
esac

echo "Skipped: ${branch:-unknown branch} is not a promotion branch and did not ask for a preview."
echo "Add [preview] to the commit message to build one."
exit 0

# The command configured in the Vercel project, kept here verbatim:
#
#   bash -c 'case "$VERCEL_GIT_COMMIT_REF" in dev|staging|main) exit 1;; esac; case "$VERCEL_GIT_COMMIT_MESSAGE" in *"[preview]"*) exit 1;; esac; if [ "$VERCEL_ENV" = production ]; then exit 1; fi; exit 0'
#
# It orders the three tests differently from this file, which changes nothing:
# each of the three independently means build, so the union is the same. It
# repeats the logic rather than sourcing it, deliberately — a setting that
# depended on a file in the repository would inherit the failure above.
