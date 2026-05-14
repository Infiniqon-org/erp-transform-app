/**
 * cognito-totp-login.ts
 *
 * Playwright bootstrap utility for battle-test E2E flows.
 *
 * Fetches dummy-org credentials from AWS Secrets Manager, computes the current
 * TOTP code from the stored shared secret, drives the FE login form
 * (`components/auth/login-form.tsx`) end-to-end, including the MFA challenge
 * modal, and returns the resolved user identity for downstream assertions.
 *
 * --------------------------------------------------------------------------
 * SETUP (deps NOT yet in package.json — verified 2026-05-14):
 *
 *   pnpm add -D @playwright/test otplib @aws-sdk/client-secrets-manager
 *
 * (`@aws-sdk/client-cognito-identity-provider` is already a runtime dep, but
 *  Secrets Manager + Playwright + otplib are not.)
 *
 * AWS auth: this utility relies on the **default AWS credential chain**.
 * Run with `AWS_PROFILE=cleanflowai-asfar` (account 367560038625) or set the
 * standard `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`
 * env vars before invoking Playwright.
 *
 * Secret layout (`cleanflowai/battle-test/dummy-org-creds`, region ap-south-1):
 *
 *   {
 *     "org_id": "99999999-0000-4000-8000-ba771e5e5700",
 *     "users": [
 *       { "username": "...", "password": "...", "totp_secret": "...",
 *         "role": "Super Admin" | "Member" | "Data Steward",
 *         "user_id": "..." },
 *       ... 10 entries, index 0 = user01 (Super Admin)
 *     ]
 *   }
 *
 * The exact JSON shape is whatever `tools/dq_validation/battle_test_users.py`
 * (cleanflowai_aws repo) writes; if that helper uses a flat top-level user01..
 * user10 mapping instead of a `users` array, the `fetchBattleTestCreds`
 * parser below normalizes both shapes.
 * --------------------------------------------------------------------------
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { authenticator } from 'otplib'
import type { Page } from '@playwright/test'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleTestCreds {
  username: string
  password: string
  totpSecret: string
  role: string
  userId: string
  orgId: string
}

export type BattleTestTarget = 'dev' | 'asfar'

interface RawUserEntry {
  username: string
  password: string
  totp_secret: string
  role: string
  user_id: string
}

interface RawSecretShape {
  org_id?: string
  users?: RawUserEntry[]
  // Fallback flat shape: { user01: {...}, user02: {...}, ... }
  [k: string]: any
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECRET_ID = 'cleanflowai/battle-test/dummy-org-creds'
const REGION = 'ap-south-1'
const DEFAULT_ORG_ID = '99999999-0000-4000-8000-ba771e5e5700'

// FE dev URL — override via env var. The FE has TWO long-lived deploy targets,
// the local-dev `dev` profile and the shared `asfar` profile. Map them here
// so callers can switch without rewriting the spec.
const FE_BASE_URLS: Record<BattleTestTarget, string> = {
  dev: process.env.FE_BASE_URL_DEV ?? 'http://localhost:3000',
  asfar: process.env.FE_BASE_URL_ASFAR ?? 'https://app.cleanflowai.com',
}

// Configure otplib for Cognito-compatible TOTP (SHA-1, 6 digits, 30s step).
// These are otplib defaults but pinned here so an upstream default change
// won't silently break MFA login.
authenticator.options = {
  algorithm: 'sha1',
  digits: 6,
  step: 30,
  window: 1, // accept the previous step within ±30s clock skew
}

// ─── Secrets Manager fetch ────────────────────────────────────────────────────

let _cachedSecret: RawSecretShape | null = null

async function loadSecret(): Promise<RawSecretShape> {
  if (_cachedSecret) return _cachedSecret
  const client = new SecretsManagerClient({ region: REGION })
  const resp = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }))
  if (!resp.SecretString) {
    throw new Error(`Secret ${SECRET_ID} has no SecretString payload`)
  }
  const parsed = JSON.parse(resp.SecretString) as RawSecretShape
  _cachedSecret = parsed
  return parsed
}

/**
 * Fetch credentials for the Nth battle-test user (0-indexed; user01 == 0).
 *
 * @param userIdx 0..9
 * @param target 'dev' (local) or 'asfar' (shared) — currently unused for creds
 *               selection (same Secret for both), but reserved so we can split
 *               per-target Secrets later without changing call sites.
 */
export async function fetchBattleTestCreds(
  userIdx: number,
  _target: BattleTestTarget = 'asfar',
): Promise<BattleTestCreds> {
  if (userIdx < 0 || userIdx > 9 || !Number.isInteger(userIdx)) {
    throw new Error(`userIdx must be integer in [0, 9], got ${userIdx}`)
  }

  const secret = await loadSecret()
  const orgId = secret.org_id ?? DEFAULT_ORG_ID

  // Preferred shape: { users: [...] }
  let raw: RawUserEntry | undefined
  if (Array.isArray(secret.users) && secret.users.length > userIdx) {
    raw = secret.users[userIdx]
  } else {
    // Fallback: flat keys like user01..user10
    const key = `user${String(userIdx + 1).padStart(2, '0')}`
    raw = secret[key] as RawUserEntry | undefined
  }

  if (!raw) {
    throw new Error(
      `No battle-test user found at index ${userIdx}. Secret shape: ${
        Array.isArray(secret.users) ? `users[${secret.users.length}]` : Object.keys(secret).join(',')
      }`,
    )
  }

  for (const f of ['username', 'password', 'totp_secret', 'role', 'user_id'] as const) {
    if (!raw[f]) throw new Error(`Battle-test user ${userIdx} missing field "${f}"`)
  }

  return {
    username: raw.username,
    password: raw.password,
    totpSecret: raw.totp_secret,
    role: raw.role,
    userId: raw.user_id,
    orgId,
  }
}

// ─── TOTP ─────────────────────────────────────────────────────────────────────

/**
 * Compute the current 6-digit TOTP code for the given base32 shared secret.
 * Mirrors the Python helper at
 *   cleanflowai_aws/tools/dq_validation/battle_test_users.py
 * (stdlib HMAC-SHA1, 30s step, 6 digits).
 */
export function computeTotp(secret: string): string {
  if (!secret) throw new Error('computeTotp: secret is empty')
  return authenticator.generate(secret)
}

// ─── Playwright login flow ────────────────────────────────────────────────────

interface LoginResult {
  userId: string
  orgId: string
  role: string
}

/**
 * Drive the FE login form for battle-test user N and return their identity.
 *
 * Flow (per `components/auth/login-form.tsx`):
 *   1. GET `${base}/auth/login`
 *   2. Fill `#email`, `#password`, click "Sign in"
 *   3. Wait for the MFA dialog (`#mfa-code` input)
 *   4. Compute TOTP, fill, click "Verify Code"
 *   5. Wait for redirect to `/dashboard`
 *
 * Gotcha: the form uses native `<input required>` validation, so empty creds
 * will silently fail to submit. We assert non-empty creds before fill.
 *
 * No CAPTCHA is present on the login form as of 2026-05-14, so this flow is
 * safe for automated runs. If a CAPTCHA is added later this utility will
 * need a real-CAPTCHA bypass or a test-mode FE flag.
 */
export async function loginUser(
  page: Page,
  userIdx: number,
  target: BattleTestTarget = 'asfar',
): Promise<LoginResult> {
  const creds = await fetchBattleTestCreds(userIdx, target)
  const baseUrl = FE_BASE_URLS[target]

  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded' })

  // Fill credentials
  await page.locator('#email').fill(creds.username)
  await page.locator('#password').fill(creds.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for the MFA modal. The dialog has a unique `#mfa-code` input.
  // Existing-user-with-MFA flow (verification) — not the first-time setup
  // flow, since battle-test users are pre-provisioned with MFA enabled.
  const mfaInput = page.locator('#mfa-code')
  await mfaInput.waitFor({ state: 'visible', timeout: 15_000 })

  // Compute fresh TOTP code. If we're unlucky and land in the last ~2s of a
  // step window, re-compute once to avoid an off-by-one stale code.
  let code = computeTotp(creds.totpSecret)
  await mfaInput.fill(code)
  await page.getByRole('button', { name: /verify code/i }).click()

  // The form redirects to /dashboard after a 1.5s success animation; wait
  // generously. If verification fails, the MFA modal stays open with an
  // error alert — surface that as a test failure.
  try {
    await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 20_000 })
  } catch (waitErr) {
    // One retry: maybe the TOTP step rolled over mid-submit.
    const errVisible = await page.locator('[role="alert"]').first().isVisible().catch(() => false)
    if (errVisible) {
      code = computeTotp(creds.totpSecret)
      await mfaInput.fill(code)
      await page.getByRole('button', { name: /verify code/i }).click()
      await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 20_000 })
    } else {
      throw waitErr
    }
  }

  return { userId: creds.userId, orgId: creds.orgId, role: creds.role }
}
