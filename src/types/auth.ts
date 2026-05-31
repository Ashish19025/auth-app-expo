export type AuthUser = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  username?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginRequest = {
  usernameOrEmail: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  phone: string;
  firebaseIdToken: string;
  termsSelections: {
    termId: string;
    accepted: boolean;
  }[];
};

export type AuthResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
};
