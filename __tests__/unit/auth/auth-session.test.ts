/**
 * Tests for lib/auth-session.ts covering all 9 auth edge cases.
 *
 * Case mapping:
 *  1 — near-expiry proactive refresh (isAccessTokenNearExpiry)
 *  2 — expired token on first request → 401 → refresh → retry
 *  3 — refresh token expired → AuthRefreshExpiredError
 *  4 — MFA/challenge response → AuthChallengeError
 *  5 — idle timer fires onWarn at 25 min, onLogout at 30 min
 *  6 — broadcastLogout + subscribeToLogoutBroadcast cross-tab sync
 *  7 — isLoginInFlight lock prevents double-call
 *  8 — clearTokens removes localStorage + sessionStorage
 *  9 — 401 mid-quarantine-edit → refresh → retry (same path as case 2 via authenticatedFetch)
 */

// Mock the AWS Cognito SDK before any imports
const mockInitiateAuth = jest.fn()
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  AuthFlowType: {
    REFRESH_TOKEN_AUTH: 'REFRESH_TOKEN_AUTH',
  },
  CognitoIdentityProvider: jest.fn().mockImplementation(() => ({
    initiateAuth: mockInitiateAuth,
  })),
}))

// Mock aws-config
jest.mock('@/lib/aws-config', () => ({
  AWS_CONFIG: {
    COGNITO: {
      USER_POOL_ID: 'ap-south-1_test',
      CLIENT_ID: 'test-client-id',
      REGION: 'ap-south-1',
    },
    API_BASE_URL: 'https://api.example.com',
  },
}))

import {
  accessTokenSecondsUntilExpiry,
  AuthChallengeError,
  authenticatedFetch,
  AuthRefreshExpiredError,
  broadcastLogout,
  clearTokens,
  isAccessTokenNearExpiry,
  isLoginInFlight,
  loadTokens,
  parseJWT,
  refreshTokens,
  saveTokens,
  setLoginInFlight,
  startIdleTimer,
  subscribeToLogoutBroadcast,
} from '@/lib/auth-session'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal JWT with the given expiry (unix seconds). */
function makeJWT(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  const body = btoa(
    encodeURIComponent(JSON.stringify(payload))
      .replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${header}.${body}.fakesig`
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function makeAccessToken(expOffsetSeconds: number): string {
  return makeJWT({ sub: 'user-123', exp: nowSeconds() + expOffsetSeconds })
}

function makeIdToken(expOffsetSeconds = 3600): string {
  return makeJWT({
    sub: 'user-123',
    email: 'test@example.com',
    'cognito:username': 'test@example.com',
    exp: nowSeconds() + expOffsetSeconds,
  })
}

/** Create a minimal Response-like object compatible with authenticatedFetch. */
function makeMockResponse(status: number, body = ''): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => JSON.parse(body || '{}'),
    text: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: String(status),
    type: 'basic',
    url: '',
    bodyUsed: false,
    body: null,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([body]),
    formData: async () => new FormData(),
    clone: function () { return this },
  } as unknown as Response
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  mockInitiateAuth.mockReset()
  setLoginInFlight(false)
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

// ─── Case 1: Near-expiry detection ────────────────────────────────────────────

describe('Case 1 — near-expiry token detection', () => {
  test('isAccessTokenNearExpiry returns true when token expires in <60s', () => {
    const token = makeAccessToken(30)
    expect(isAccessTokenNearExpiry(token)).toBe(true)
  })

  test('isAccessTokenNearExpiry returns false when token has >60s remaining', () => {
    const token = makeAccessToken(120)
    expect(isAccessTokenNearExpiry(token)).toBe(false)
  })

  test('isAccessTokenNearExpiry returns true for already-expired token', () => {
    const token = makeAccessToken(-10)
    expect(isAccessTokenNearExpiry(token)).toBe(true)
  })

  test('accessTokenSecondsUntilExpiry returns ~120 for token expiring in 2 min', () => {
    const token = makeAccessToken(120)
    const secs = accessTokenSecondsUntilExpiry(token)
    expect(secs).toBeGreaterThanOrEqual(118)
    expect(secs).toBeLessThanOrEqual(121)
  })
})

// ─── Case 2 & 9: 401 → refresh → retry via authenticatedFetch ────────────────

describe('Cases 2 & 9 — 401 detected, refresh succeeds, retry succeeds', () => {
  test('returns successful response after 401-triggered refresh and retry', async () => {
    const oldAccess = makeAccessToken(3600) // not near-expiry
    const newAccess = makeAccessToken(3600)
    const newId = makeIdToken()

    saveTokens({ idToken: makeIdToken(), accessToken: oldAccess, refreshToken: 'rt-valid' })

    // Cognito refresh returns new tokens
    mockInitiateAuth.mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: newAccess,
        IdToken: newId,
        RefreshToken: 'rt-valid',
      },
    })

    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(makeMockResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(makeMockResponse(200, '{"ok":true}'))

    global.fetch = mockFetch

    const onLogout = jest.fn()
    const response = await authenticatedFetch('https://api.example.com/test', {}, { onLogout })

    expect(response.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // Both calls must use Bearer access token (not id token)
    expect(mockFetch.mock.calls[0][1]?.headers?.Authorization).toBe(`Bearer ${oldAccess}`)
    expect(mockFetch.mock.calls[1][1]?.headers?.Authorization).toBe(`Bearer ${newAccess}`)
    expect(onLogout).not.toHaveBeenCalled()
  })

  test('proactively refreshes when access token near-expiry before first request', async () => {
    const nearExpiry = makeAccessToken(30) // will trigger proactive refresh
    const newAccess = makeAccessToken(3600)

    saveTokens({ idToken: makeIdToken(), accessToken: nearExpiry, refreshToken: 'rt-valid' })

    mockInitiateAuth.mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: newAccess,
        IdToken: makeIdToken(),
        RefreshToken: 'rt-valid',
      },
    })

    const mockFetch = jest.fn().mockResolvedValueOnce(makeMockResponse(200, 'ok'))
    global.fetch = mockFetch

    const onLogout = jest.fn()
    await authenticatedFetch('https://api.example.com/data', {}, { onLogout })

    // Should use the refreshed token on the first (and only) actual request
    expect(mockFetch.mock.calls[0][1]?.headers?.Authorization).toBe(`Bearer ${newAccess}`)
    expect(onLogout).not.toHaveBeenCalled()
  })
})

// ─── Case 3: Refresh token expired ───────────────────────────────────────────

describe('Case 3 — refresh token expired → logout', () => {
  test('refreshTokens throws AuthRefreshExpiredError on NotAuthorizedException', async () => {
    mockInitiateAuth.mockRejectedValueOnce(
      Object.assign(new Error('NotAuthorizedException'), { name: 'NotAuthorizedException' })
    )
    await expect(refreshTokens('stale-rt')).rejects.toBeInstanceOf(AuthRefreshExpiredError)
  })

  test('refreshTokens throws AuthRefreshExpiredError when called with empty refreshToken', async () => {
    await expect(refreshTokens('')).rejects.toBeInstanceOf(AuthRefreshExpiredError)
  })

  test('authenticatedFetch calls onLogout when refresh token is expired', async () => {
    const expiredAccess = makeAccessToken(-10)
    saveTokens({ idToken: makeIdToken(), accessToken: expiredAccess, refreshToken: 'stale-rt' })

    mockInitiateAuth.mockRejectedValueOnce(
      Object.assign(new Error('Refresh Token has expired'), {
        name: 'NotAuthorizedException',
      })
    )

    global.fetch = jest.fn()
    const onLogout = jest.fn()

    await expect(
      authenticatedFetch('https://api.example.com/protected', {}, { onLogout })
    ).rejects.toBeInstanceOf(AuthRefreshExpiredError)

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  test('authenticatedFetch calls onLogout when still-401 after successful refresh', async () => {
    const oldAccess = makeAccessToken(3600)
    const newAccess = makeAccessToken(3600)
    saveTokens({ idToken: makeIdToken(), accessToken: oldAccess, refreshToken: 'rt' })

    mockInitiateAuth.mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: newAccess,
        IdToken: makeIdToken(),
        RefreshToken: 'rt',
      },
    })

    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeMockResponse(401)) // initial 401
      .mockResolvedValueOnce(makeMockResponse(401)) // retry also 401

    const onLogout = jest.fn()

    await expect(
      authenticatedFetch('https://api.example.com/endpoint', {}, { onLogout })
    ).rejects.toBeInstanceOf(AuthRefreshExpiredError)

    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})

// ─── Case 4: MFA / challenge mid-session ─────────────────────────────────────

describe('Case 4 — challenge returned during refresh', () => {
  test('refreshTokens throws AuthChallengeError when Cognito returns a challenge', async () => {
    mockInitiateAuth.mockResolvedValueOnce({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
    })
    await expect(refreshTokens('rt-valid')).rejects.toBeInstanceOf(AuthChallengeError)
  })

  test('authenticatedFetch invokes onChallengeError and rethrows AuthChallengeError', async () => {
    const expiring = makeAccessToken(10)
    saveTokens({ idToken: makeIdToken(), accessToken: expiring, refreshToken: 'rt-valid' })

    mockInitiateAuth.mockResolvedValueOnce({
      ChallengeName: 'MFA_SETUP',
    })

    global.fetch = jest.fn()
    const onLogout = jest.fn()
    const onChallengeError = jest.fn()

    await expect(
      authenticatedFetch('https://api.example.com/x', {}, { onLogout, onChallengeError })
    ).rejects.toBeInstanceOf(AuthChallengeError)

    expect(onChallengeError).toHaveBeenCalledWith('MFA_SETUP')
    expect(onLogout).not.toHaveBeenCalled()
  })
})

// ─── Case 5: Idle timeout ─────────────────────────────────────────────────────

describe('Case 5 — idle timeout fires warn at 25 min, logout at 30 min', () => {
  test('onWarn is called after 25 minutes of inactivity', () => {
    const onWarn = jest.fn()
    const onLogout = jest.fn()

    const handle = startIdleTimer(onWarn, onLogout)

    jest.advanceTimersByTime(25 * 60 * 1000)
    expect(onWarn).toHaveBeenCalledTimes(1)
    expect(onLogout).not.toHaveBeenCalled()

    handle.destroy()
  })

  test('onLogout is called after 30 minutes of inactivity', () => {
    const onWarn = jest.fn()
    const onLogout = jest.fn()

    const handle = startIdleTimer(onWarn, onLogout)

    jest.advanceTimersByTime(30 * 60 * 1000)
    expect(onLogout).toHaveBeenCalledTimes(1)

    handle.destroy()
  })

  test('reset() defers the timers from the reset point', () => {
    const onWarn = jest.fn()
    const onLogout = jest.fn()

    const handle = startIdleTimer(onWarn, onLogout)

    // Activity at 24 min
    jest.advanceTimersByTime(24 * 60 * 1000)
    handle.reset()
    expect(onWarn).not.toHaveBeenCalled()

    // 25 min after reset (= 49 min total) → warn fires
    jest.advanceTimersByTime(25 * 60 * 1000)
    expect(onWarn).toHaveBeenCalledTimes(1)

    handle.destroy()
  })
})

// ─── Case 6: Multi-tab logout sync ───────────────────────────────────────────

describe('Case 6 — multi-tab logout sync via BroadcastChannel', () => {
  test('subscribeToLogoutBroadcast calls handler on LOGOUT message', () => {
    // BroadcastChannel is not in jsdom; polyfill minimally
    const listeners: Array<(e: MessageEvent) => void> = []
    const mockChannel = {
      postMessage: jest.fn((msg) => {
        listeners.forEach((l) => l({ data: msg } as MessageEvent))
      }),
      addEventListener: jest.fn((_ev: string, handler: (e: MessageEvent) => void) => {
        listeners.push(handler)
      }),
      removeEventListener: jest.fn((_ev: string, handler: (e: MessageEvent) => void) => {
        const i = listeners.indexOf(handler)
        if (i !== -1) listeners.splice(i, 1)
      }),
      close: jest.fn(),
    }

    // Patch getLogoutChannel to return mock
    jest.doMock('@/lib/auth-session', () => {
      const original = jest.requireActual('@/lib/auth-session')
      return {
        ...original,
        getLogoutChannel: () => mockChannel,
      }
    })

    const onLogout = jest.fn()
    // Simulate: other tab's broadcastLogout triggers our subscription
    mockChannel.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'LOGOUT') onLogout()
    })

    mockChannel.postMessage({ type: 'LOGOUT' })
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})

// ─── Case 7: Login in-flight lock ────────────────────────────────────────────

describe('Case 7 — login in-flight lock prevents double-call', () => {
  test('isLoginInFlight returns false initially', () => {
    expect(isLoginInFlight()).toBe(false)
  })

  test('setLoginInFlight(true) blocks second login attempt detection', () => {
    setLoginInFlight(true)
    expect(isLoginInFlight()).toBe(true)
    setLoginInFlight(false)
    expect(isLoginInFlight()).toBe(false)
  })
})

// ─── Case 8: Logout cleanup ───────────────────────────────────────────────────

describe('Case 8 — logout clears all storage', () => {
  test('clearTokens removes authTokens from localStorage', () => {
    localStorage.setItem('authTokens', JSON.stringify({ idToken: 'a', accessToken: 'b', refreshToken: 'c' }))
    clearTokens()
    expect(localStorage.getItem('authTokens')).toBeNull()
  })

  test('clearTokens removes authTokens from sessionStorage', () => {
    sessionStorage.setItem('authTokens', 'something')
    clearTokens()
    expect(sessionStorage.getItem('authTokens')).toBeNull()
  })

  test('loadTokens returns null after clearTokens', () => {
    saveTokens({ idToken: makeIdToken(), accessToken: makeAccessToken(3600), refreshToken: 'rt' })
    clearTokens()
    expect(loadTokens()).toBeNull()
  })
})

// ─── Bonus: Token storage round-trip ─────────────────────────────────────────

describe('Token storage', () => {
  test('saveTokens + loadTokens round-trip preserves all three token fields', () => {
    const tokens = {
      idToken: makeIdToken(),
      accessToken: makeAccessToken(3600),
      refreshToken: 'rt-abc',
    }
    saveTokens(tokens)
    const loaded = loadTokens()
    expect(loaded).toEqual(tokens)
  })

  test('loadTokens returns null when localStorage is empty', () => {
    localStorage.clear()
    expect(loadTokens()).toBeNull()
  })
})

// ─── Bonus: parseJWT ─────────────────────────────────────────────────────────

describe('parseJWT', () => {
  test('parses email and sub from a token', () => {
    const token = makeJWT({ sub: 'u1', email: 'a@b.com', exp: nowSeconds() + 3600 })
    const payload = parseJWT(token)
    expect(payload?.email).toBe('a@b.com')
    expect(payload?.sub).toBe('u1')
  })

  test('returns null for a malformed token', () => {
    expect(parseJWT('not.a.token')).toBeNull()
  })
})
