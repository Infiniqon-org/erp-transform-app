"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useAuth as useAuthHook } from "@/hooks/useAuth";

interface MfaSetupData {
  secretCode: string;
  qrCodeUrl: string;
}

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  accessToken: string | null;
  // MFA state
  mfaRequired: boolean;
  mfaSession: string | null;
  mfaUsername: string | null;
  // Auth functions
  signup: (email: string, password: string, confirmPassword: string, name?: string) => Promise<any>;
  confirmSignup: (email: string, code: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  // MFA functions
  verifyMfaCode: (mfaCode: string) => Promise<any>;
  setupMfa: (accessToken: string) => Promise<MfaSetupData>;
  setupMfaWithSession: (session: string, email: string) => Promise<MfaSetupData & { session: string }>;
  confirmMfaSetup: (accessToken: string, mfaCode: string) => Promise<any>;
  confirmMfaSetupWithSession: (session: string, mfaCode: string, username: string) => Promise<any>;
  cancelMfa: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthHook();

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        idToken: auth.idToken,
        accessToken: auth.accessToken,
        // MFA state
        mfaRequired: auth.mfaRequired,
        mfaSession: auth.mfaSession,
        mfaUsername: auth.mfaUsername,
        // Auth functions
        signup: auth.signup,
        confirmSignup: auth.confirmSignup,
        login: auth.login,
        logout: auth.logout,
        // MFA functions
        verifyMfaCode: auth.verifyMfaCode,
        setupMfa: auth.setupMfa,
        setupMfaWithSession: auth.setupMfaWithSession,
        confirmMfaSetup: auth.confirmMfaSetup,
        confirmMfaSetupWithSession: auth.confirmMfaSetupWithSession,
        cancelMfa: auth.cancelMfa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
