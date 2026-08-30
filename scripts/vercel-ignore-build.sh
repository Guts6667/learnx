#!/usr/bin/env bash
# Vercel "Ignored Build Step".
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
