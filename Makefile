.PHONY: help lint build smoke-oidc seed-clients convex-fresh convex-reset-dev convex-sync convex-sync-fresh clerk-check qa-run2 qa-step1 qa-step2 qa-step3 qa-step4 qa-manage qa-oidc qa-pin dev quality

help:
	@echo "Available targets:"
	@echo "  make lint        - Run ESLint"
	@echo "  make build       - Run Next.js production build"
	@echo "  make smoke-oidc  - Run OIDC smoke checks"
	@echo "  make seed-clients - Register/update OAuth clients"
	@echo "  make convex-fresh - Create/select a fresh Convex dev deployment"
	@echo "  make convex-reset-dev - Clear dev Convex tables before schema sync"
	@echo "  make convex-sync - Push local Convex functions/schema to dev deployment"
	@echo "  make convex-sync-fresh - Push local Convex code to the fresh run2 QA deployment"
	@echo "  make clerk-check - Verify Clerk key pairing"
	@echo "  make qa-run2     - Run full QA suite (all 14 tests, ~3-5 min)"
	@echo "  make qa-step1    - Run Step 1 tests only (profile selection, ~1 min)"
	@echo "  make qa-step2    - Run Step 2 tests only (portal, ~1 min)"
	@echo "  make qa-step3    - Run Step 3 tests only (OIDC silent auth, ~30s)"
	@echo "  make qa-step4    - Run Step 4 tests only (management dashboard, ~1 min)"
	@echo "  make qa-pin      - Run PIN flow test only (~45s, includes cooldown)"
	@echo "  make qa-manage   - Run management gate tests only (~30s)"
	@echo "  make qa-oidc     - Run OIDC token claims test only (~30s)"
	@echo "  make dev         - Start local Next.js dev server"
	@echo "  make quality     - Run lint, build, and smoke checks"

lint:
	npm run lint

build:
	npm run build

smoke-oidc:
	npm run smoke:oidc

seed-clients:
	npm run seed:clients

convex-fresh:
	npx convex deployment create run2-qa-$(shell date +%s) --type dev --select

convex-reset-dev:
	printf "[]" > /tmp/convex-empty.json
	npx convex import --table users /tmp/convex-empty.json --replace -y
	npx convex import --table profiles /tmp/convex-empty.json --replace -y
	npx convex import --table appPermissions /tmp/convex-empty.json --replace -y
	npx convex import --table activities /tmp/convex-empty.json --replace -y
	npx convex import --table activeProfiles /tmp/convex-empty.json --replace -y
	npx convex import --table authCodes /tmp/convex-empty.json --replace -y
	npx convex import --table oauthClients /tmp/convex-empty.json --replace -y

convex-sync:
	npx convex dev --once

convex-sync-fresh:
	printf "CONVEX_DEPLOYMENT=dev:good-wildcat-322\nNEXT_PUBLIC_CONVEX_URL=https://good-wildcat-322.convex.cloud\nNEXT_PUBLIC_CONVEX_SITE_URL=https://good-wildcat-322.convex.site\n" > /tmp/run2qa.env
	npx convex dev --once --env-file=/tmp/run2qa.env

clerk-check:
	node --env-file=.env.local scripts/qa/clerk-check.mjs

qa-run2:
	npx --env-file=.env.local playwright test --config=playwright.config.ts

# Targeted QA — run only the tests relevant to what you changed
# Much faster for iterating on a specific feature.

qa-step1:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "Step 1"

qa-step2:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "Step 2"

qa-step3:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "Step 3"

qa-step4:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "Step 4"

qa-manage:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "management password|Wrong management|Full management"

qa-oidc:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "Silent auth"

qa-pin:
	npx --env-file=.env.local playwright test --config=playwright.config.ts --grep "PIN flow"

dev:
	npm run dev -- --port 3000

quality: lint build smoke-oidc
