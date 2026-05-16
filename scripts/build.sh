#!/usr/bin/env bash
# HangarForge Woodpecker build + ECR push with auto versioning
# Usage: ./scripts/build.sh [--no-cache] [--dry-run]
#
# Version scheme: MAJOR.MINOR.PATCH
#   MAJOR.MINOR = contents of .hf-version (tracks upstream Woodpecker release)
#   PATCH       = auto-incremented from last hf-v* git tag
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECR="${AWS_ACCOUNT_ID:-632843870295}.dkr.ecr.${AWS_DEFAULT_REGION:-us-east-1}.amazonaws.com"
ECR_IMAGE="$ECR/hangarforge/woodpecker-server"

# ── Compute version ────────────────────────────────────────────────────────────
BASE_VERSION=$(cat "$REPO_ROOT/.hf-version" | tr -d '[:space:]')  # e.g. "3.14"
LAST_TAG=$(git -C "$REPO_ROOT" tag --list "hf-v${BASE_VERSION}.*" | sort -V | tail -1)

if [[ -z "$LAST_TAG" ]]; then
  PATCH=0
else
  PATCH=$(echo "$LAST_TAG" | awk -F. '{print $NF}')
  PATCH=$((PATCH + 1))
fi

VERSION="${BASE_VERSION}.${PATCH}"    # e.g. "3.14.5"
GIT_TAG="hf-v${VERSION}"
SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD)
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

echo ">>> HangarForge Woodpecker ${VERSION} (${SHA} @ ${BRANCH})"

# ── Flags ──────────────────────────────────────────────────────────────────────
NO_CACHE_FLAG=""
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE_FLAG="--no-cache" ;;
    --dry-run)  DRY_RUN=true ;;
  esac
done

if $DRY_RUN; then
  echo "DRY RUN — would build ${ECR_IMAGE}:${VERSION} and tag git as ${GIT_TAG}"
  exit 0
fi

# ── ECR login ─────────────────────────────────────────────────────────────────
aws ecr get-login-password --region "${AWS_DEFAULT_REGION:-us-east-1}" \
  | docker login --username AWS --password-stdin "$ECR"

# ── Docker build ───────────────────────────────────────────────────────────────
docker buildx build \
  $NO_CACHE_FLAG \
  --platform linux/arm64 \
  -f "$REPO_ROOT/Dockerfile.hf-server" \
  --build-arg CI_COMMIT_SHA="$SHA" \
  --build-arg CI_COMMIT_BRANCH="$BRANCH" \
  --build-arg CI_COMMIT_TAG="$GIT_TAG" \
  -t "${ECR_IMAGE}:latest" \
  -t "${ECR_IMAGE}:${VERSION}" \
  -t "${ECR_IMAGE}:${SHA}" \
  --push \
  "$REPO_ROOT"

# ── Git tag ────────────────────────────────────────────────────────────────────
echo ">>> Tagging git as ${GIT_TAG}"
git -C "$REPO_ROOT" tag "$GIT_TAG"
git -C "$REPO_ROOT" push origin "$GIT_TAG"

echo ""
echo "✓  ${GIT_TAG} — pushed to ECR as ${ECR_IMAGE}:${VERSION}"
