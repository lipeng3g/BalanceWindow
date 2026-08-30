#!/usr/bin/env bash

# Fail when a removable FutureMoney identifier reappears in active source.
# The remaining matches are explicit technical/external identities or
# historical evidence and are checked by path so a broad global allowlist
# cannot hide a new user-visible occurrence.

set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
patterns='FutureMoney|futuremoney|future-money|future money|X-FutureMoney|FUTUREMONEY'

hits=()
while IFS= read -r hit; do
  hits+=("$hit")
done < <(
  rg -n -i --hidden \
    --glob '!.git/**' \
    --glob '!docs/**' \
    --glob '!node_modules/**' \
    --glob '!web/dist/**' \
    --glob '!web/.wrangler/**' \
    --glob '!**/xcuserdata/**' \
    --glob '!scripts/audit-brand-surfaces.sh' \
    "$patterns" "$repo_root" || true
)

failures=0
allowed=0

for hit in "${hits[@]}"; do
  path="${hit%%:*}"
  relative="${path#"$repo_root/"}"
  line="${hit#*:}"
  is_allowed=0

  case "$relative" in
    wrangler.jsonc)
      [[ "$line" == *"future-money"* ]] && is_allowed=1
      ;;
    README.md)
      # Only the retained technical identities and explicit historical-path
      # explanation are allowed. Do not exempt the whole README: a new
      # user-visible FutureMoney sentence must fail the audit.
      if [[ "$line" == *'FutureMoney` 仅作为仓库路径'* ||
            "$line" == *'historical `FutureMoney` name remains only in approved technical identities'* ||
            "$line" == *'historical `FutureMoney` name for update and deployment continuity'* ||
            "$line" == *'Some Cloudflare deployment identifiers retain the historical `FutureMoney` name for continuity'* ||
            "$line" == *'FutureMoney/       # 历史仓库/技术目录名'* ||
            "$line" == *'future-money.pages.dev'* ||
            "$line" == *'com.ponzio.futuremoney'* ]]; then
        is_allowed=1
      fi
      ;;
    AGENTS.md)
      # The repository instructions may name the historical brand when they
      # explicitly describe this policy or the retained production identity.
      if [[ "$line" == *'historical public name'* ||
            "$line" == *'com.ponzio.futuremoney'* ||
            "$line" == *'Do not globally replace `FutureMoney`'* ]]; then
        is_allowed=1
      fi
      ;;
    ios/README.md)
      [[ "$line" == *"com.ponzio.futuremoney"* ]] && is_allowed=1
      ;;
    ios/AppStoreAssets/Metadata/en-US.md)
      if [[ "$line" == *'future-money.pages.dev'* ||
            "$line" == *'historical `FutureMoney` brand'* ]]; then
        is_allowed=1
      fi
      ;;
    ios/scripts/audit-release-app.sh|\
    ios/BalanceWindowIOS/BalanceWindowIOS.xcodeproj/project.pbxproj|\
    ios/BalanceWindowIOS/BalanceWindowIOSTests/AppStoreSeriesTests.swift|\
    ios/BalanceWindowIOS/BalanceWindowIOS/Services/APIClient.swift|\
    ios/BalanceWindowIOS/BalanceWindowIOS/Views/SettingsView.swift|\
    web/server/auth/createAuth.ts)
      [[ "$line" == *"future-money.pages.dev"* || "$line" == *"com.ponzio.futuremoney"* ]] && is_allowed=1
      ;;
    web/src/config/product.ts|web/public/privacy.html|web/public/ios.html|web/public/support.html|web/README.md)
      [[ "$line" == *"future-money.pages.dev"* ]] && is_allowed=1
      ;;
  esac

  if (( is_allowed )); then
    allowed=$((allowed + 1))
  else
    printf 'FAIL  unexpected old-brand hit: %s\n' "$hit" >&2
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  printf '\nBrand surface audit failed: %d unexpected hit(s); %d approved technical/history hit(s).\n' "$failures" "$allowed" >&2
  exit 1
fi

printf 'Brand surface audit passed: %d approved technical/history hit(s), 0 unexpected.\n' "$allowed"
