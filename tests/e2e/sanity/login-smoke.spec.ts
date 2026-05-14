/**
 * login-smoke.spec.ts
 *
 * Smoke test for `tests/e2e/utils/cognito-totp-login.ts`.
 *
 * SETUP (deps NOT in package.json as of 2026-05-14):
 *   pnpm add -D @playwright/test otplib @aws-sdk/client-secrets-manager
 *   npx playwright install --with-deps
 *
 * To run this test (skipped by default):
 *   1. Remove the `test.skip(...)` line below, or set RUN_BATTLE_TEST_SMOKE=1
 *   2. Export AWS creds for account 367560038625 (profile cleanflowai-asfar):
 *        export AWS_PROFILE=cleanflowai-asfar
 *      AND ensure `aws sso login --profile cleanflowai-asfar` is fresh.
 *   3. Either run against the deployed FE:
 *        FE_BASE_URL_ASFAR=https://app.cleanflowai.com pnpm exec playwright test \
 *          tests/e2e/sanity/login-smoke.spec.ts
 *      Or against a local dev server:
 *        pnpm dev   # in another terminal
 *        FE_BASE_URL_DEV=http://localhost:3000 pnpm exec playwright test ... -- target=dev
 *
 * Why skipped by default: this test requires live AWS Secrets Manager creds
 * AND a running FE; CI does not have either configured. It exists so a human
 * can verify the bootstrap utility works end-to-end before a battle-test
 * session.
 */

import { test, expect } from '@playwright/test'
import { computeTotp, fetchBattleTestCreds, loginUser } from '../utils/cognito-totp-login'

const RUN = process.env.RUN_BATTLE_TEST_SMOKE === '1'

test.describe('battle-test login bootstrap', () => {
  test.skip(!RUN, 'Set RUN_BATTLE_TEST_SMOKE=1 + valid AWS creds to enable.')

  test('computeTotp produces a 6-digit numeric string for a known secret', () => {
    // RFC 6238 test secret: base32("12345678901234567890") == "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const code = computeTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(code).toMatch(/^\d{6}$/)
  })

  test('fetchBattleTestCreds returns user01 (Super Admin)', async () => {
    const creds = await fetchBattleTestCreds(0, 'asfar')
    expect(creds.username).toBeTruthy()
    expect(creds.password).toBeTruthy()
    expect(creds.totpSecret).toBeTruthy()
    expect(creds.role).toBe('Super Admin')
    expect(creds.orgId).toBe('99999999-0000-4000-8000-ba771e5e5700')
  })

  test('loginUser drives the FE login form end-to-end for user01', async ({ page }) => {
    const target = (process.env.BATTLE_TEST_TARGET as 'dev' | 'asfar') ?? 'asfar'
    const identity = await loginUser(page, 0, target)

    expect(identity.userId).toBeTruthy()
    expect(identity.orgId).toBe('99999999-0000-4000-8000-ba771e5e5700')
    expect(identity.role).toBe('Super Admin')

    // After successful login the page should be on /dashboard.
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
