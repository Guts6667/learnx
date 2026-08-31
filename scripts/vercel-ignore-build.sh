#!/usr/bin/env bash
# Reference copy of the Vercel "Ignored Build Step" — documentation, not wiring.
#
# NOTHING CALLS THIS FILE. The rule that actually governs deployments lives in
# the Vercel project itself, at Settings → Git → Ignored Build Step → Custom,
# as the one-liner reproduced at the bottom. This copy exists so the logic is
# readable and runnable in a repository somebody can clone, since a project
# setting is visible only to whoever holds the Vercel dashboard.
#
# It used to be the wiring, referenced by "ignoreCommand" in vercel.json. That
# could not work, and the reason is worth keeping: a rule that lives in a
# repository file cannot govern a branch that predates the file. On such a
# branch the command still runs, bash finds no script, exits non-zero — and in
# this inverted convention non-zero means BUILD. The mechanism failed open, on
# exactly the old feature branches it existed to stop.
#
# Exit 1 tells Vercel to build, exit 0 tells it to skip. The polarity is
# inverted from the usual shell convention, so the explicit exits say which.
#
# TWO LAYERS, and they are often confused. This file is the second one.
#
#   1. `vercel.json` -> `git.deploymentEnabled` decides which branches may
#      CREATE a deployment at all. Since V4.5-185 only `dev`, `staging` and
#      `main` may; `"**": false` blocks the rest. This is the layer that
#      protects the daily deployment quota, because the quota counts creations
#      — including the ones this script immediately cancels. On 31 August 2026
#      the account hit its limit while GitHub's deployments API recorded a
#      single deployment that day: the difference was made of builds cancelled
#      right here, which cost a unit each and left no GitHub record.
#   2. This script decides whether an already-created deployment BUILDS. It
#      protects build minutes, not the quota.
#
# So a branch outside the allowlist never reaches this file at all, and putting
# the marker on one of its commits now does nothing.
#
# No branch builds by itself. Two cases build: the deployment is a production
# one, or the commit message carries the marker. Branch names left the rule on
# 30 August 2026, when the promotion line alone outran the Hobby plan's 100
# deployments a day. The marker puts the decision where the information is —
# whoever merges knows whether the result needs serving; a branch name does not.
#
# The marker is matched against the WHOLE commit message, body included. A
# commit that merely writes about it therefore asks for a build, which happened
# on the first day of the previous rule. Writing it in a file is inert; writing
# it in a commit message is a request.
set -euo pipefail

message="${VERCEL_GIT_COMMIT_MESSAGE:-}"

# Production must never depend on a marker somebody could forget.
if [ "${VERCEL_ENV:-}" = 'production' ]; then
  echo "Building: production deployment."
  exit 1
fi

case "$message" in
  *"[deploy]"*)
    echo "Building: the commit message asks for a deployment."
    exit 1
    ;;
esac

echo "Skipped: not a production deployment, and the commit message did not ask."
exit 0

# The command configured in the Vercel project, kept here verbatim:
#
#   bash -c 'case "$VERCEL_GIT_COMMIT_MESSAGE" in *"[deploy]"*) exit 1;; esac; if [ "$VERCEL_ENV" = production ]; then exit 1; fi; exit 0'
#
# It tests the message before the environment, which changes nothing: either
# alone means build, so the union is the same. It repeats the logic rather than
# sourcing this file, deliberately — a setting that depended on a repository
# file would inherit the failure described above.
