import { useState, useEffect } from 'react'
import { CognitoIdentityProvider, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider'

const CONFIG = {
  userPoolId: 'ap-south-1_CMfo9cOwX',
  clientId: '476inkko2vl462vk1pv5vurs7j',
  region: 'ap-south-1'
}

interface User {
  email: string
  sub: string
  username: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  idToken: string | null
  accessToken: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    idToken: null,
    accessToken: null
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
        if (payload && payload.exp > Date.now() / 1000) {
          setAuthState({
            user: {
              email: payload.email,
              sub: payload.sub,
              username: payload['cognito:username']
            },
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken
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

  const signup = async (email: string, password: string, confirmPassword: string) => {
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
      const params = {
        ClientId: CONFIG.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
        ]
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

      if (authResult.AuthenticationResult) {
        const idToken = authResult.AuthenticationResult.IdToken!
        const accessToken = authResult.AuthenticationResult.AccessToken!

        const payload = parseJWT(idToken)
        if (payload) {
          const user = {
            email: payload.email,
            sub: payload.sub,
            username: payload['cognito:username']
          }

          localStorage.setItem('authTokens', JSON.stringify({ idToken, accessToken }))

          setAuthState({
            user,
            isLoading: false,
            isAuthenticated: true,
            idToken,
            accessToken
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

  const logout = () => {
    localStorage.removeItem('authTokens')
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      idToken: null,
      accessToken: null
    })
  }

  return {
    ...authState,
    signup,
    confirmSignup,
    login,
    logout
  }
}
