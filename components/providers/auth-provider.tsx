"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useAuth as useAuthHook } from "@/hooks/useAuth";

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  accessToken: string | null;
  signup: (email: string, password: string, confirmPassword: string) => Promise<any>;
  confirmSignup: (email: string, code: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
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
        signup: auth.signup,
        confirmSignup: auth.confirmSignup,
        login: auth.login,
        logout: auth.logout,
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
