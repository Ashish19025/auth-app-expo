import { apiClient, getApiBaseUrl } from "@/services/api";
import { clearStoredSession, getStoredJson, getStoredSession, removeStoredKey, saveAuthSession, setStoredJson } from "@/services/storage";
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from "@/types/auth";

const MOCK_USER_KEY = "mock.user";

type MockUserRecord = {
  user: AuthUser;
  password: string;
};

async function getMockUser(): Promise<MockUserRecord | null> {
  return getStoredJson<MockUserRecord>(MOCK_USER_KEY);
}

function createMockTokens() {
  return {
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
  };
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  if (!getApiBaseUrl()) {
    const mockUser = await getMockUser();

    if (!mockUser) {
      throw new Error("No registered user found. Please register first.");
    }

    const usernameMatch =
      mockUser.user.email.toLowerCase() === payload.usernameOrEmail.toLowerCase() ||
      mockUser.user.username === payload.usernameOrEmail;

    if (!usernameMatch || payload.password !== mockUser.password) {
      throw new Error("Invalid credentials.");
    }

    const tokens = createMockTokens();
    await saveAuthSession(tokens, mockUser.user);

    return {
      user: mockUser.user,
      tokens,
    };
  }

  const response = await apiClient.post<AuthResponse>("/auth/login", payload);
  return response.data;
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  if (!getApiBaseUrl()) {
    const user: AuthUser = {
      userId: `user-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      username: payload.email,
    };

    await setStoredJson(MOCK_USER_KEY, {
      user,
      password: payload.password,
    });

    const tokens = createMockTokens();
    await saveAuthSession(tokens, user);

    return {
      user,
      tokens,
    };
  }

  const response = await apiClient.post<AuthResponse>("/auth/register", payload);
  return response.data;
}

export async function logout(refreshToken?: string): Promise<void> {
  if (getApiBaseUrl() && refreshToken) {
    await apiClient.post("/auth/logout", { refreshToken });
  }

  await clearStoredSession();
}

export async function clearMockUser(): Promise<void> {
  await removeStoredKey(MOCK_USER_KEY);
}

export async function restoreSession(): Promise<AuthResponse | null> {
  const session = await getStoredSession();

  if (!session.user || !session.tokens) {
    return null;
  }

  return {
    user: session.user,
    tokens: session.tokens,
  };
}
