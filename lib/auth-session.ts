/**
 * auth-session.ts
 *
 * Central auth-session module responsible for:
 *  - Token storage (access + refresh tokens in localStorage)
 *  - Near-expiry detection (case 1: proactive refresh if <60s remaining)
 *  - 401 detect-and-refresh-retry on fetch (cases 2 & 9)
 *  - Refresh-token-expired graceful logout (case 3)
 *  - MFA/NEW_PASSWORD_REQUIRED challenge guard (case 4)
 *  - Idle timeout with 5-min warning (case 5)
 *  - Multi-tab logout sync via BroadcastChannel (case 6)
 *  - Login in-flight lock to prevent race (case 7)
 *  - Full logout cleanup (case 8)
 *
 * CRITICAL: Authorization header ALWAYS uses the access token (not the id token).
 * Per CLAUDE.md and Z2 bugfix 6f36a731 — accessToken is for API Gateway.
 */

import {
  AuthFlowType,
  CognitoIdentityProvider,
} from '@aws-sdk/client-cognito-identity-provider'
import { AWS_CONFIG } from './aws-config'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'authTokens'
const IDLE_WARN_MS = 25 * 60 * 1000   // 25 min → show warning
const IDLE_LOGOUT_MS = 30 * 60 * 1000  // 30 min → auto-logout
const NEAR_EXPIRY_THRESHOLD_S = 60     // seconds before expiry to proactively refresh

// BroadcastChannel name for cross-tab sync (case 6)
const LOGOUT_CHANNEL_NAME = 'cleanflowai_auth_logout'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredTokens {
  idToken: string
  accessToken: string
  refreshToken: string
}

export interface TokenRefreshResult {
  idToken: string
  accessToken: string
  refreshToken: string
}

// ─── Cognito Client ───────────────────────────────────────────────────────────

const cognitoClient = new CognitoIdentityProvider({
  region: AWS_CONFIG.COGNITO.REGION,
})

// ─── Token Storage ────────────────────────────────────────────────────────────

export function loadTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredTokens>
    if (!parsed.idToken || !parsed.accessToken) return null
    return {
      idToken: parsed.idToken,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? '',
    }
  } catch {
    return null
  }
}

export function saveTokens(tokens: StoredTokens): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

/** Full cleanup: clear all auth-related storage (case 8). */
export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  // Belt-and-braces: clear any sessionStorage auth keys
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem('authUser')
}

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

export function parseJWT(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Returns seconds until expiry for an access token.
 * Returns 0 if token is already expired or unparseable.
 */
export function accessTokenSecondsUntilExpiry(accessToken: string): number {
  const payload = parseJWT(accessToken)
  if (!payload || typeof payload.exp !== 'number') return 0
  const remaining = payload.exp - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Returns true if access token is expired or will expire within threshold.
 * case 1: threshold = NEAR_EXPIRY_THRESHOLD_S (60s)
 * case 2: threshold = 0 (already expired)
 */
export function isAccessTokenNearExpiry(
  accessToken: string,
  thresholdSeconds = NEAR_EXPIRY_THRESHOLD_S
): boolean {
  return accessTokenSecondsUntilExpiry(accessToken) <= thresholdSeconds
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Calls Cognito USER_REFRESH_TOKEN_AUTH and returns new tokens.
 * Throws AuthRefreshExpiredError if refresh token itself is expired (case 3).
 */
export class AuthRefreshExpiredError extends Error {
  constructor() {
    super('Session expired, sign in again')
    this.name = 'AuthRefreshExpiredError'
  }
}

export class AuthChallengeError extends Error {
  public challengeName: string
  constructor(challengeName: string) {
    super(`Re-authentication needed: ${challengeName}`)
    this.name = 'AuthChallengeError'
    this.challengeName = challengeName
  }
}

export async function refreshTokens(
  refreshToken: string
): Promise<TokenRefreshResult> {
  if (!refreshToken) {
    throw new AuthRefreshExpiredError()
  }
  try {
    const result = await cognitoClient.initiateAuth({
      ClientId: AWS_CONFIG.COGNITO.CLIENT_ID,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })

    // Case 4: server returned a new challenge mid-session
    if (result.ChallengeName) {
      throw new AuthChallengeError(result.ChallengeName)
    }

    if (!result.AuthenticationResult) {
      throw new AuthRefreshExpiredError()
    }

    return {
      idToken: result.AuthenticationResult.IdToken!,
      accessToken: result.AuthenticationResult.AccessToken!,
      // Cognito does NOT return a new refresh token on REFRESH_TOKEN_AUTH; keep existing
      refreshToken,
    }
  } catch (err: any) {
    if (
      err instanceof AuthRefreshExpiredError ||
      err instanceof AuthChallengeError
    ) {
      throw err
    }
    // NotAuthorizedException or TokenExpiredException → refresh token expired
    if (
      err?.name === 'NotAuthorizedException' ||
      err?.name === 'TokenExpiredException' ||
      err?.message?.includes('Refresh Token has expired')
    ) {
      throw new AuthRefreshExpiredError()
    }
    throw err
  }
}

// ─── Multi-tab Logout Sync (case 6) ──────────────────────────────────────────

let _logoutChannel: BroadcastChannel | null = null

export function getLogoutChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null
  if (!_logoutChannel) {
    _logoutChannel = new BroadcastChannel(LOGOUT_CHANNEL_NAME)
  }
  return _logoutChannel
}

/**
 * Broadcast a logout event to all other tabs (case 6).
 * Call this AFTER clearing local tokens.
 */
export function broadcastLogout(): void {
  const channel = getLogoutChannel()
  if (channel) {
    channel.postMessage({ type: 'LOGOUT' })
  }
}

/**
 * Subscribe to cross-tab logout events.
 * @param onLogout callback to run when another tab signals logout
 * @returns cleanup function
 */
export function subscribeToLogoutBroadcast(onLogout: () => void): () => void {
  const channel = getLogoutChannel()
  if (!channel) return () => {}
  const handler = (evt: MessageEvent) => {
    if (evt.data?.type === 'LOGOUT') {
      onLogout()
    }
  }
  channel.addEventListener('message', handler)
  return () => channel.removeEventListener('message', handler)
}

// ─── Login in-flight lock (case 7) ───────────────────────────────────────────

let _loginInFlight = false

export function isLoginInFlight(): boolean {
  return _loginInFlight
}

export function setLoginInFlight(value: boolean): void {
  _loginInFlight = value
}

// ─── Idle Timeout (case 5) ───────────────────────────────────────────────────

interface IdleTimerHandle {
  reset: () => void
  destroy: () => void
}

/**
 * Sets up an idle-timeout watcher.
 * @param onWarn  called at 25 min with seconds remaining until auto-logout
 * @param onLogout called at 30 min if user hasn't responded
 */
export function startIdleTimer(
  onWarn: (secondsRemaining: number) => void,
  onLogout: () => void
): IdleTimerHandle {
  let warnTimer: ReturnType<typeof setTimeout> | null = null
  let logoutTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (warnTimer) clearTimeout(warnTimer)
    if (logoutTimer) clearTimeout(logoutTimer)
    warnTimer = null
    logoutTimer = null
  }

  const schedule = () => {
    clearTimers()
    warnTimer = setTimeout(() => {
      const remaining = Math.round((IDLE_LOGOUT_MS - IDLE_WARN_MS) / 1000)
      onWarn(remaining)
    }, IDLE_WARN_MS)

    logoutTimer = setTimeout(() => {
      onLogout()
    }, IDLE_LOGOUT_MS)
  }

  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']

  const handleActivity = () => schedule()

  if (typeof window !== 'undefined') {
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }))
    schedule() // arm immediately
  }

  return {
    reset: schedule,
    destroy: () => {
      clearTimers()
      if (typeof window !== 'undefined') {
        ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity))
      }
    },
  }
}

// ─── Authenticated fetch wrapper (cases 1, 2, 9) ─────────────────────────────

type LogoutFn = () => void
type OnChallengeErrorFn = (challengeName: string) => void

/**
 * Authenticated fetch that:
 * 1. Proactively refreshes if access token expires in <60s (case 1)
 * 2. Retries once on 401 after refreshing (cases 2 & 9)
 * 3. Logs out and redirects on refresh-token-expired (case 3)
 * 4. Surfaces challenge errors (case 4) via onChallengeError
 *
 * ALWAYS sends `Authorization: Bearer <accessToken>` (not the id token).
 */
export async function authenticatedFetch(
  input: RequestInfo,
  init: RequestInit = {},
  options: {
    onLogout: LogoutFn
    onChallengeError?: OnChallengeErrorFn
  }
): Promise<Response> {
  const { onLogout, onChallengeError } = options

  const doRefreshAndSave = async (): Promise<string> => {
    const tokens = loadTokens()
    if (!tokens?.refreshToken) throw new AuthRefreshExpiredError()
    const refreshed = await refreshTokens(tokens.refreshToken)
    saveTokens(refreshed)
    return refreshed.accessToken
  }

  const buildHeaders = (accessToken: string): HeadersInit => ({
    ...(init.headers ?? {}),
    Authorization: `Bearer ${accessToken}`,
  })

  const performRequest = async (accessToken: string): Promise<Response> =>
    fetch(input, { ...init, headers: buildHeaders(accessToken) })

  let tokens = loadTokens()
  let accessToken = tokens?.accessToken ?? ''

  // Case 1: proactive refresh if near expiry
  if (accessToken && isAccessTokenNearExpiry(accessToken)) {
    try {
      accessToken = await doRefreshAndSave()
    } catch (err) {
      if (err instanceof AuthRefreshExpiredError) {
        onLogout()
        throw err
      }
      if (err instanceof AuthChallengeError) {
        onChallengeError?.(err.challengeName)
        throw err
      }
      throw err
    }
  }

  // First attempt
  let response = await performRequest(accessToken)

  // Cases 2 & 9: retry on 401
  if (response.status === 401) {
    try {
      accessToken = await doRefreshAndSave()
      response = await performRequest(accessToken)
    } catch (err) {
      if (err instanceof AuthRefreshExpiredError) {
        onLogout()
        throw err
      }
      if (err instanceof AuthChallengeError) {
        onChallengeError?.(err.challengeName)
        throw err
      }
      throw err
    }

    // If still 401 after retry → log out
    if (response.status === 401) {
      onLogout()
      throw new AuthRefreshExpiredError()
    }
  }

  return response
}
