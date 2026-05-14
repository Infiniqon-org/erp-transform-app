/**
 * useAuth.ts
 *
 * React hook that owns Cognito session state.
 * Delegates token storage, refresh, idle-timeout, and multi-tab sync
 * to lib/auth-session.ts.
 *
 * CRITICAL: accessToken is used for API Gateway Authorization headers.
 * idToken is stored/exposed for informational use only.
 * Per CLAUDE.md Z2 bugfix 6f36a731 — NEVER send the idToken to API Gateway.
 */

import {
  AuthFlowType,
  CognitoIdentityProvider,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  RespondToAuthChallengeCommand,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AWS_CONFIG } from '@/lib/aws-config'
import {
  AuthRefreshExpiredError,
  broadcastLogout,
  clearTokens,
  isLoginInFlight,
  loadTokens,
  parseJWT,
  saveTokens,
  setLoginInFlight,
  startIdleTimer,
  subscribeToLogoutBroadcast,
} from '@/lib/auth-session'

const CONFIG = {
  userPoolId: AWS_CONFIG.COGNITO.USER_POOL_ID,
  clientId: AWS_CONFIG.COGNITO.CLIENT_ID,
  region: AWS_CONFIG.COGNITO.REGION,
}

interface User {
  email: string
  sub: string
  username: string
  name: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  idToken: string | null
  accessToken: string | null
  // MFA state
  mfaRequired: boolean
  mfaSession: string | null
  mfaUsername: string | null
  // Idle timeout warning state (case 5)
  idleWarnSecondsRemaining: number | null
}

interface MfaSetupData {
  secretCode: string
  qrCodeUrl: string
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    idToken: null,
    accessToken: null,
    mfaRequired: false,
    mfaSession: null,
    mfaUsername: null,
    idleWarnSecondsRemaining: null,
  })

  const cognitoClient = new CognitoIdentityProvider({ region: CONFIG.region })
  const idleTimerRef = useRef<ReturnType<typeof startIdleTimer> | null>(null)

  // ─── Logout (case 8) ─────────────────────────────────────────────────────

  const logout = useCallback(() => {
    // Full cleanup: localStorage + sessionStorage auth keys
    clearTokens()

    // Notify other tabs (case 6)
    broadcastLogout()

    // Tear down idle timer
    idleTimerRef.current?.destroy()
    idleTimerRef.current = null

    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      idToken: null,
      accessToken: null,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null,
      idleWarnSecondsRemaining: null,
    })

    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }, [])

  // ─── Session expired logout (case 3) with message ────────────────────────

  const logoutExpired = useCallback(() => {
    clearTokens()
    broadcastLogout()
    idleTimerRef.current?.destroy()
    idleTimerRef.current = null

    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      idToken: null,
      accessToken: null,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null,
      idleWarnSecondsRemaining: null,
    })

    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?reason=session_expired'
    }
  }, [])

  // ─── Idle timeout (case 5) ────────────────────────────────────────────────

  const armIdleTimer = useCallback(() => {
    idleTimerRef.current?.destroy()
    idleTimerRef.current = startIdleTimer(
      (secondsRemaining) => {
        setAuthState((prev) => ({ ...prev, idleWarnSecondsRemaining: secondsRemaining }))
      },
      () => {
        logoutExpired()
      }
    )
  }, [logoutExpired])

  const dismissIdleWarning = useCallback(() => {
    setAuthState((prev) => ({ ...prev, idleWarnSecondsRemaining: null }))
    idleTimerRef.current?.reset()
  }, [])

  // ─── Restore session on mount ─────────────────────────────────────────────

  useEffect(() => {
    const stored = loadTokens()
    if (stored) {
      const payload = parseJWT(stored.idToken)
      if (payload && typeof payload.exp === 'number' && payload.exp > Date.now() / 1000) {
        setAuthState({
          user: {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username'],
            name: payload.name || payload.email.split('@')[0],
          },
          isLoading: false,
          isAuthenticated: true,
          idToken: stored.idToken,
          accessToken: stored.accessToken,
          mfaRequired: false,
          mfaSession: null,
          mfaUsername: null,
          idleWarnSecondsRemaining: null,
        })
        armIdleTimer()
      } else {
        // idToken expired on mount; don't redirect — let the page/guard handle it
        clearTokens()
        setAuthState((prev) => ({ ...prev, isLoading: false }))
      }
    } else {
      setAuthState((prev) => ({ ...prev, isLoading: false }))
    }

    // Case 6: subscribe to cross-tab logout
    const unsubscribe = subscribeToLogoutBroadcast(() => {
      // Another tab logged out — clear state without re-broadcasting
      clearTokens()
      idleTimerRef.current?.destroy()
      idleTimerRef.current = null
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        idToken: null,
        accessToken: null,
        mfaRequired: false,
        mfaSession: null,
        mfaUsername: null,
        idleWarnSecondsRemaining: null,
      })
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    })

    return () => {
      unsubscribe()
      idleTimerRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Signup ───────────────────────────────────────────────────────────────

  const signup = async (
    email: string,
    password: string,
    confirmPassword: string,
    name?: string
  ) => {
    if (!email || !password || !confirmPassword) {
      throw new Error('Please fill in all fields')
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match')
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    try {
      const userAttributes = [{ Name: 'email', Value: email }]
      if (name) userAttributes.push({ Name: 'name', Value: name })

      const result = await cognitoClient.signUp({
        ClientId: CONFIG.clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes,
      })

      if (result.UserConfirmed) {
        return { confirmed: true, message: 'Account created successfully!' }
      } else {
        return { confirmed: false, message: 'Please check your email for verification code' }
      }
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new Error('User already exists. Try logging in instead.')
      }
      throw new Error(error.message || 'Signup failed')
    }
  }

  // ─── Confirm signup ───────────────────────────────────────────────────────

  const confirmSignup = async (email: string, code: string) => {
    try {
      await cognitoClient.confirmSignUp({
        ClientId: CONFIG.clientId,
        Username: email,
        ConfirmationCode: code,
      })
      return { success: true, message: 'Email verified successfully!' }
    } catch (error: any) {
      throw new Error(error.message || 'Verification failed')
    }
  }

  // ─── Login (case 7: in-flight lock) ──────────────────────────────────────

  const login = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Please enter both email and password')
    }

    // Case 7: no-op if a login call is already in flight
    if (isLoginInFlight()) {
      return { success: false, message: 'Sign in already in progress' }
    }

    setLoginInFlight(true)
    try {
      const authResult = await cognitoClient.initiateAuth({
        ClientId: CONFIG.clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })

      // Case 4: MFA required
      if (authResult.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        setAuthState((prev) => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false,
        }))
        return { success: false, mfaRequired: true, message: 'Please enter your MFA code' }
      }

      // Case 4: MFA setup required
      if (authResult.ChallengeName === 'MFA_SETUP') {
        setAuthState((prev) => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false,
        }))
        return {
          success: false,
          mfaSetupRequired: true,
          session: authResult.Session,
          message: 'Please set up MFA',
        }
      }

      // Case 4: unexpected challenge (NEW_PASSWORD_REQUIRED etc.) — don't crash
      if (authResult.ChallengeName) {
        setAuthState((prev) => ({
          ...prev,
          mfaRequired: false,
          mfaSession: null,
          mfaUsername: null,
          isLoading: false,
        }))
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login?reason=reauth_required'
        }
        return {
          success: false,
          challengeRequired: true,
          challengeName: authResult.ChallengeName,
          message: 'Re-authentication needed',
        }
      }

      // Normal success
      if (authResult.AuthenticationResult) {
        const idToken = authResult.AuthenticationResult.IdToken!
        const accessToken = authResult.AuthenticationResult.AccessToken!
        const refreshToken = authResult.AuthenticationResult.RefreshToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user: User = {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username'],
            name: payload.name || payload.email.split('@')[0],
          }

          saveTokens({ idToken, accessToken, refreshToken })

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null,
            idleWarnSecondsRemaining: null,
          })

          armIdleTimer()
          return { success: true, message: 'Login successful!' }
        }
      }

      throw new Error('Authentication failed')
    } catch (error: any) {
      if (error.name === 'UserNotConfirmedException') {
        throw new Error('Account not confirmed. Please check your email.')
      } else if (error.name === 'NotAuthorizedException') {
        throw new Error('Invalid email or password.')
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('User not found. Please sign up first.')
      }
      throw new Error(error.message || 'Login failed')
    } finally {
      setLoginInFlight(false)
    }
  }

  // ─── MFA verify ───────────────────────────────────────────────────────────

  const verifyMfaCode = async (mfaCode: string) => {
    if (!authState.mfaSession || !authState.mfaUsername) {
      throw new Error('MFA session not found. Please login again.')
    }
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const result = await cognitoClient.send(
        new RespondToAuthChallengeCommand({
          ClientId: CONFIG.clientId,
          ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
          Session: authState.mfaSession,
          ChallengeResponses: {
            USERNAME: authState.mfaUsername,
            SOFTWARE_TOKEN_MFA_CODE: mfaCode,
          },
        })
      )

      if (result.AuthenticationResult) {
        const idToken = result.AuthenticationResult.IdToken!
        const accessToken = result.AuthenticationResult.AccessToken!
        const refreshToken = result.AuthenticationResult.RefreshToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user: User = {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username'],
            name: payload.name || payload.email.split('@')[0],
          }

          saveTokens({ idToken, accessToken, refreshToken })

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null,
            idleWarnSecondsRemaining: null,
          })

          armIdleTimer()
          return { success: true, message: 'MFA verified successfully!' }
        }
      }

      throw new Error('MFA verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      } else if (error.name === 'ExpiredCodeException') {
        throw new Error('Code has expired. Please login again.')
      }
      throw new Error(error.message || 'MFA verification failed')
    }
  }

  // ─── MFA setup ────────────────────────────────────────────────────────────

  const setupMfa = async (accessToken: string): Promise<MfaSetupData> => {
    try {
      const result = await cognitoClient.send(
        new AssociateSoftwareTokenCommand({ AccessToken: accessToken })
      )
      if (result.SecretCode) {
        const email = authState.user?.email || 'user'
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`
        return { secretCode: result.SecretCode, qrCodeUrl }
      }
      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  const setupMfaWithSession = async (
    session: string,
    email: string
  ): Promise<MfaSetupData & { session: string }> => {
    try {
      const result = await cognitoClient.send(
        new AssociateSoftwareTokenCommand({ Session: session })
      )
      if (result.SecretCode) {
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`
        return { secretCode: result.SecretCode, qrCodeUrl, session: result.Session || session }
      }
      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  const confirmMfaSetup = async (accessToken: string, mfaCode: string) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }
    try {
      const result = await cognitoClient.send(
        new VerifySoftwareTokenCommand({
          AccessToken: accessToken,
          UserCode: mfaCode,
          FriendlyDeviceName: 'Authenticator App',
        })
      )
      if (result.Status === 'SUCCESS') {
        return { success: true, message: 'MFA enabled successfully!' }
      }
      throw new Error('MFA setup verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      }
      throw new Error(error.message || 'MFA setup failed')
    }
  }

  const confirmMfaSetupWithSession = async (
    session: string,
    mfaCode: string,
    username: string
  ) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }
    try {
      const result = await cognitoClient.send(
        new VerifySoftwareTokenCommand({
          Session: session,
          UserCode: mfaCode,
          FriendlyDeviceName: 'Authenticator App',
        })
      )

      if (result.Status === 'SUCCESS') {
        const authResult = await cognitoClient.send(
          new RespondToAuthChallengeCommand({
            ClientId: CONFIG.clientId,
            ChallengeName: ChallengeNameType.MFA_SETUP,
            Session: result.Session,
            ChallengeResponses: { USERNAME: username },
          })
        )

        if (authResult.AuthenticationResult) {
          const idToken = authResult.AuthenticationResult.IdToken!
          const accessToken = authResult.AuthenticationResult.AccessToken!
          const refreshToken = authResult.AuthenticationResult.RefreshToken!

          const payload = parseJWT(idToken)
          if (payload) {
            const user: User = {
              email: payload.email,
              sub: payload.sub,
              username: payload['cognito:username'],
              name: payload.name || payload.email.split('@')[0],
            }

            saveTokens({ idToken, accessToken, refreshToken })

            setAuthState({
              user,
              isLoading: false,
              isAuthenticated: true,
              idToken,
              accessToken,
              mfaRequired: false,
              mfaSession: null,
              mfaUsername: null,
              idleWarnSecondsRemaining: null,
            })

            armIdleTimer()
            return { success: true, message: 'MFA enabled successfully!' }
          }
        }

        return { success: true, message: 'MFA setup verified, please log in again.' }
      }

      throw new Error('MFA setup verification failed')
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new Error('Invalid verification code. Please try again.')
      }
      throw new Error(error.message || 'MFA setup verification failed')
    }
  }

  const cancelMfa = () => {
    setAuthState((prev) => ({
      ...prev,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null,
    }))
  }

  return {
    ...authState,
    signup,
    confirmSignup,
    login,
    logout,
    logoutExpired,
    dismissIdleWarning,
    // MFA functions
    verifyMfaCode,
    setupMfa,
    setupMfaWithSession,
    confirmMfaSetup,
    confirmMfaSetupWithSession,
    cancelMfa,
  }
}
