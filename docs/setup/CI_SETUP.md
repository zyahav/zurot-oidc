# CI Setup (GitHub Actions)

This document explains how to make CI pass on your PR after local setup works.

## 1. What GitHub Actions Does (Plain Explanation)

GitHub Actions runs your workflow on a clean GitHub-hosted machine.

Important differences from your local machine:
- It does not have your local `.env.local`.
- It does not have your terminal/session state.
- It only sees repository files and configured GitHub secrets.

That is why CI needs explicit secrets configured in repository settings.

## 2. Which Secrets CI Needs and Why

Current CI build requires exactly these 6 secrets:

1. `NEXT_PUBLIC_CONVEX_URL`
2. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. `CLERK_SECRET_KEY`
4. `ISSUER`
5. `RSA_PRIVATE_KEY`
6. `RSA_PUBLIC_KEY`

Why these 6:
- They are needed by the current Next.js/OIDC build path and runtime config checks in `.github/workflows/ci.yml`.

Why these are excluded from CI for now:
- `CONVEX_DEPLOYMENT`: used for Convex CLI/deployment workflows, not current CI build.
- `NEXT_PUBLIC_APP_URL`: local/dev convenience variable, not required by current CI validation/build contract.

## 3. Same Values vs Different Values

Current project stage:
- Use the same values as `zurot-oidc / dev` for CI.

Guidance:
- Only create a separate BitWarden item `zurot-oidc / github-actions` when you have truly different environment values (for example staging/production separation).

## 4. Add Secrets to GitHub (Step-by-Step)

1. Open repository secrets page:
- `https://github.com/zyahav/zurot-oidc/settings/secrets/actions`

2. Click `New repository secret`.

3. Add each secret by exact name and value (copy from BitWarden `zurot-oidc / dev`):
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ISSUER`
- `RSA_PRIVATE_KEY`
- `RSA_PUBLIC_KEY`

4. Repeat until all 6 exist.

## 5. Verify CI Works

1. Open your PR.
2. Wait for GitHub Actions to run the `CI` workflow.
3. Confirm both jobs are green:
- `lint`
- `build`

If build fails at `Validate required build secrets`, at least one required secret is missing or empty.

## 6. STOP Checkpoint (Critical)

Before adding secrets, verify:
- You are in the correct repository (`zyahav/zurot-oidc`)
- You are not adding secrets to a fork by mistake

Do not continue until both checks are true.
