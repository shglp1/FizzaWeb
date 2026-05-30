# Enterprise platform consistency — suggested PR split from feat/enterprise-platform-consistency
#
# Usage (from repo root, with a clean working tree or stash first):
#   .\scripts\enterprise-split-branches.ps1 -BaseBranch main
#
# This script creates stacked branches in dependency order. Each branch is cut from
# the previous one so reviewers can merge sequentially without rebasing conflicts.
#
# PR order (lowest deploy risk first):
#   PR1  classification engine + driver/admin/parent consumers + smoke tests
#   PR2  parent API/UI parity (formatters, tripApiFilters, dashboard/trips/tracking)
#   PR3  admin live ops section + needs-dispatch Riyadh date filter
#   PR4  schema migration + financial review API + payroll gates + admin drawer panel
#   PR5  /admin-port auth redirects (middleware, login, authRedirect)
#   PR6  vehicle catalog validation + driver-application dropdowns
#   PR7  TripRating schema/API + parent rating prompt (shares migration with PR4)
#   PR8  role-aware profile page + API
#
# Note: PR4 and PR7 share prisma/migrations/20260524120000_enterprise_platform_consistency.
# Merge them together or keep PR7 immediately after PR4 on the same migration commit.

param(
  [string]$BaseBranch = "main",
  [string]$SourceBranch = "feat/enterprise-platform-consistency"
)

$ErrorActionPreference = "Stop"

function Assert-GitClean {
  $status = git status --porcelain
  if ($status) {
    Write-Error "Working tree is not clean. Commit or stash changes before splitting branches."
  }
}

function New-SplitBranch {
  param(
    [string]$Name,
    [string[]]$Paths
  )
  Write-Host "`n=== Creating branch: $Name ===" -ForegroundColor Cyan
  git checkout -b $Name $BaseBranch
  git checkout $SourceBranch -- @Paths
  git status --short
  Write-Host "Review diff, run npm test, then commit on $Name" -ForegroundColor Yellow
}

Assert-GitClean
git fetch origin 2>$null

Write-Host "Source: $SourceBranch | Base: $BaseBranch" -ForegroundColor Green
Write-Host @"

File groups below mirror the original 8-phase plan. Adjust paths if your branch diverged.
Run each New-SplitBranch block manually or uncomment the calls at the bottom.

"@

$PR1 = @(
  "src/lib/trips/tripClassification.ts",
  "src/lib/ui/driverTripSelection.ts",
  "src/lib/ui/driverPortal.ts",
  "src/lib/ui/adminOperations.ts",
  "src/tests/tripClassification.smoke.ts"
)

$PR2 = @(
  "src/lib/parent/parentFormatters.ts",
  "src/lib/trips/tripApiFilters.ts",
  "src/app/dashboard/page.tsx",
  "src/app/trips/page.tsx",
  "src/app/tracking/page.tsx",
  "src/app/api/trips/route.ts",
  "src/app/api/tracking/route.ts"
)

$PR3 = @(
  "src/app/api/admin/trips/live/route.ts",
  "src/app/admin/sections/LiveOperationsSection.tsx",
  "src/lib/adminNav.ts",
  "src/app/api/admin/trips/needs-dispatch/route.ts"
)

$PR4 = @(
  "prisma/schema.prisma",
  "prisma/migrations/20260524120000_enterprise_platform_consistency",
  "src/lib/trips/financialReview.ts",
  "src/app/api/admin/trips/[id]/financial-review/route.ts",
  "src/lib/payroll/generatePayrollRun.ts",
  "src/app/api/trips/[id]/status/route.ts",
  "src/lib/ui/adminTripDetail.ts",
  "src/components/admin/TripFinancialReviewPanel.tsx",
  "src/components/admin/TripDetailDrawer.tsx",
  "src/app/admin/sections/TripOperationsBoard.tsx"
)

$PR5 = @(
  "src/app/admin-port/page.tsx",
  "src/lib/authRedirect.ts",
  "middleware.ts",
  "src/app/login/page.tsx"
)

$PR6 = @(
  "src/lib/vehicles/vehicleCatalog.ts",
  "src/lib/validations/saudiPlate.ts",
  "src/lib/validations/driverApplication.ts",
  "src/app/api/driver-application/route.ts",
  "src/app/driver-application/page.tsx"
)

$PR7 = @(
  "src/lib/ratings/ratingEligibility.ts",
  "src/app/api/trips/[id]/rating/route.ts",
  "src/components/parent/TripRatingPrompt.tsx",
  "src/tests/ratingEligibility.smoke.ts"
)

$PR8 = @(
  "src/app/api/profile/route.ts",
  "src/app/profile/page.tsx"
)

Write-Host "PR1 paths: $($PR1.Count) files"
Write-Host "PR2 paths: $($PR2.Count) files"
Write-Host "PR3 paths: $($PR3.Count) files"
Write-Host "PR4 paths: $($PR4.Count) files (includes migration — deploy with prisma migrate deploy)"
Write-Host "PR5 paths: $($PR5.Count) files"
Write-Host "PR6 paths: $($PR6.Count) files"
Write-Host "PR7 paths: $($PR7.Count) files (merge with PR4 or immediately after)"
Write-Host "PR8 paths: $($PR8.Count) files"

Write-Host @"

To create branches interactively, uncomment and run:

# New-SplitBranch -Name "feat/enterprise-pr1-classification" -Paths $PR1
# git commit -m "feat: shared trip classification engine"
# New-SplitBranch -Name "feat/enterprise-pr2-parent-parity" -Paths $PR2
# ...

Recommended first merge: feat/enterprise-pr1-classification (no schema, highest leverage).

"@
