import { AuthFlowType, CognitoIdentityProvider, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, RespondToAuthChallengeCommand, ChallengeNameType } from '@aws-sdk/client-cognito-identity-provider'
import { useEffect, useState } from 'react'

import { AWS_CONFIG } from '@/lib/aws-config'

const CONFIG = {
  userPoolId: AWS_CONFIG.COGNITO.USER_POOL_ID,
  clientId: AWS_CONFIG.COGNITO.CLIENT_ID,
  region: AWS_CONFIG.COGNITO.REGION
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
    mfaUsername: null
  })

  const cognitoClient = new CognitoIdentityProvider({
    region: CONFIG.region
  })

  useEffect(() => {
    // Check for existing session on mount
    const storedTokens = localStorage.getItem('authTokens')
    if (storedTokens) {
      try {
        const { idToken, accessToken } = JSON.parse(storedTokens)
        const payload = parseJWT(idToken)
        console.log('Parsed JWT payload:', payload)
        if (payload && payload.exp > Date.now() / 1000) {
          setAuthState({
            user: {
              email: payload.email,
              sub: payload.sub,
              username: payload['cognito:username'],
              name: payload.name || payload.email.split('@')[0]
            },
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })
        } else {
          localStorage.removeItem('authTokens')
          setAuthState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        localStorage.removeItem('authTokens')
        setAuthState(prev => ({ ...prev, isLoading: false }))
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const parseJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error parsing JWT:', error)
      return null
    }
  }

  const signup = async (email: string, password: string, confirmPassword: string, name?: string) => {
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
      const userAttributes = [
        {
          Name: 'email',
          Value: email
        }
      ]
      
      if (name) {
        userAttributes.push({
          Name: 'name',
          Value: name
        })
      }

      const params = {
        ClientId: CONFIG.clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes
      }

      const result = await cognitoClient.signUp(params)

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

  const confirmSignup = async (email: string, code: string) => {
    try {
      const params = {
        ClientId: CONFIG.clientId,
        Username: email,
        ConfirmationCode: code
      }

      await cognitoClient.confirmSignUp(params)
      return { success: true, message: 'Email verified successfully!' }
    } catch (error: any) {
      throw new Error(error.message || 'Verification failed')
    }
  }

  const login = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Please enter both email and password')
    }

    try {
      const authParams = {
        ClientId: CONFIG.clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      }

      const authResult = await cognitoClient.initiateAuth(authParams)

      // Check if MFA is required
      if (authResult.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        // MFA is required - store session and wait for MFA code
        setAuthState(prev => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false
        }))
        return { 
          success: false, 
          mfaRequired: true, 
          message: 'Please enter your MFA code' 
        }
      }

      // Check if MFA setup is required (first time)
      if (authResult.ChallengeName === 'MFA_SETUP') {
        setAuthState(prev => ({
          ...prev,
          mfaRequired: true,
          mfaSession: authResult.Session || null,
          mfaUsername: email,
          isLoading: false
        }))
        return { 
          success: false, 
          mfaSetupRequired: true, 
          session: authResult.Session,
          message: 'Please set up MFA' 
        }
      }

      // No MFA - complete authentication
      if (authResult.AuthenticationResult) {
        const idToken = authResult.AuthenticationResult.IdToken!
        const accessToken = authResult.AuthenticationResult.AccessToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username'],
            name: payload.name || payload.email.split('@')[0]
          }

          localStorage.setItem('authTokens', JSON.stringify({ idToken, accessToken }))

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })

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
    }
  }

  // Verify MFA code during login
  const verifyMfaCode = async (mfaCode: string) => {
    if (!authState.mfaSession || !authState.mfaUsername) {
      throw new Error('MFA session not found. Please login again.')
    }

    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: CONFIG.clientId,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: authState.mfaSession,
        ChallengeResponses: {
          USERNAME: authState.mfaUsername,
          SOFTWARE_TOKEN_MFA_CODE: mfaCode
        }
      })

      const result = await cognitoClient.send(command)

      if (result.AuthenticationResult) {
        const idToken = result.AuthenticationResult.IdToken!
        const accessToken = result.AuthenticationResult.AccessToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username'],
            name: payload.name || payload.email.split('@')[0]
          }

          localStorage.setItem('authTokens', JSON.stringify({ idToken, accessToken }))

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken,
            mfaRequired: false,
            mfaSession: null,
            mfaUsername: null
          })

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

  // Setup MFA for the first time - get secret code and QR URL
  const setupMfa = async (accessToken: string): Promise<MfaSetupData> => {
    try {
      const command = new AssociateSoftwareTokenCommand({
        AccessToken: accessToken
      })

      const result = await cognitoClient.send(command)

      if (result.SecretCode) {
        // Generate QR code URL for authenticator apps
        const email = authState.user?.email || 'user'
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`
        
        return {
          secretCode: result.SecretCode,
          qrCodeUrl
        }
      }

      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  // Setup MFA using session (for MFA_SETUP challenge during login)
  const setupMfaWithSession = async (session: string, email: string): Promise<MfaSetupData & { session: string }> => {
    try {
      const command = new AssociateSoftwareTokenCommand({
        Session: session
      })

      const result = await cognitoClient.send(command)

      if (result.SecretCode) {
        // Generate QR code URL for authenticator apps
        const qrCodeUrl = `otpauth://totp/CleanFlowAI:${email}?secret=${result.SecretCode}&issuer=CleanFlowAI`
        
        return {
          secretCode: result.SecretCode,
          qrCodeUrl,
          session: result.Session || session
        }
      }

      throw new Error('Failed to generate MFA secret')
    } catch (error: any) {
      throw new Error(error.message || 'Failed to setup MFA')
    }
  }

  // Confirm MFA setup with verification code
  const confirmMfaSetup = async (accessToken: string, mfaCode: string) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: mfaCode,
        FriendlyDeviceName: 'Authenticator App'
      })

      const result = await cognitoClient.send(command)

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

  // Confirm MFA setup using session (for MFA_SETUP challenge during login)
  const confirmMfaSetupWithSession = async (session: string, mfaCode: string, username: string) => {
    if (!mfaCode || mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      throw new Error('Please enter a valid 6-digit code')
    }

    try {
      const command = new VerifySoftwareTokenCommand({
        Session: session,
        UserCode: mfaCode,
        FriendlyDeviceName: 'Authenticator App'
      })

      const result = await cognitoClient.send(command)

      if (result.Status === 'SUCCESS') {
        // Now complete the authentication with the new session
        const authCommand = new RespondToAuthChallengeCommand({
          ClientId: CONFIG.clientId,
          ChallengeName: ChallengeNameType.MFA_SETUP,
          Session: result.Session,
          ChallengeResponses: {
            USERNAME: username
          }
        })

        const authResult = await cognitoClient.send(authCommand)

        if (authResult.AuthenticationResult) {
          const idToken = authResult.AuthenticationResult.IdToken!
          const accessToken = authResult.AuthenticationResult.AccessToken!

          const payload = parseJWT(idToken)
          if (payload) {
            const user = {
              email: payload.email,
              sub: payload.sub,
              username: payload['cognito:username'],
              name: payload.name || payload.email.split('@')[0]
            }

            localStorage.setItem('authTokens', JSON.stringify({ idToken, accessToken }))

            setAuthState({
              user,
              isLoading: false,
              isAuthenticated: true,
              idToken,
              accessToken,
              mfaRequired: false,
              mfaSession: null,
              mfaUsername: null
            })

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

  // Cancel MFA challenge and reset state
  const cancelMfa = () => {
    setAuthState(prev => ({
      ...prev,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null
    }))
  }

  const logout = () => {
    localStorage.removeItem('authTokens')
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      idToken: null,
      accessToken: null,
      mfaRequired: false,
      mfaSession: null,
      mfaUsername: null
    })
  }

  return {
    ...authState,
    signup,
    confirmSignup,
    login,
    logout,
    // MFA functions
    verifyMfaCode,
    setupMfa,
    setupMfaWithSession,
    confirmMfaSetup,
    confirmMfaSetupWithSession,
    cancelMfa
  }
}
