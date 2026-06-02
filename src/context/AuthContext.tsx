import { PropsWithChildren, createContext, useCallback, useEffect, useMemo, useState } from "react";

import * as authService from "@/services/authService";
import { saveAuthSession } from "@/services/storage";
import { AuthState, AuthUser, LoginRequest, RegisterRequest } from "@/types/auth";

type AuthContextType = AuthState & {
  login: (payload: LoginRequest) => Promise<AuthUser>;
  register: (payload: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const initialState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  tokens: null,
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const session = await authService.restoreSession();

        if (!mounted) {
          return;
        }

        if (!session) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            tokens: null,
          });
          return;
        }

        setState({
          isLoading: false,
          isAuthenticated: true,
          user: session.user,
          tokens: session.tokens,
        });
      } catch {
        if (mounted) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            tokens: null,
          });
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await authService.login(payload);
    await saveAuthSession(result.tokens, result.user);

    setState({
      isLoading: false,
      isAuthenticated: true,
      user: result.user,
      tokens: result.tokens,
    });

    return result.user;
  }, []);

  const register = useCallback(async (payload: RegisterRequest) => {
  try {
    console.log("AUTH CONTEXT REGISTER START");

    const result = await authService.register(payload);

    console.log("REGISTER RESULT:");
    console.log(JSON.stringify(result, null, 2));

    console.log("SAVING SESSION...");
    await saveAuthSession(result.tokens, result.user);
    console.log("SESSION SAVED");

    console.log("UPDATING STATE...");
    setState({
      isLoading: false,
      isAuthenticated: true,
      user: result.user,
      tokens: result.tokens,
    });

    console.log("STATE UPDATED");
    console.log("AUTH CONTEXT REGISTER END");

    return result.user;
  } catch (error) {
    console.error("AUTH CONTEXT REGISTER ERROR:");
    console.error(error);
    throw error;
  }
}, []);

  const logout = useCallback(async () => {
  await authService.logout();

  setState({
    isLoading: false,
    isAuthenticated: false,
    user: null,
    tokens: null,
  });
}, []);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    login,
    register,
    logout,
  }), [state, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
