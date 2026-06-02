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

export async function login(
  payload: LoginRequest
): Promise<AuthResponse> {
  try {
    const response = await apiClient.post(
      "/auth/login",
      payload
    );

    console.log("LOGIN RESPONSE");
    console.log(
      JSON.stringify(response.data, null, 2)
    );

    const result: AuthResponse = {
      user: {
        userId: response.data.user.id,
        name: response.data.user.name,
        email: response.data.user.email,
        phone: response.data.user.phoneNumber,
        username: response.data.user.email,
      },
      tokens: {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      },
    };

    console.log("LOGIN RESULT");
    console.log(result);

    return result;
  } catch (error) {
    const status = (
      error as {
        response?: { status?: number };
      }
    )?.response?.status;

    if (status !== 404) {
      throw error;
    }

    // Fallback to mock user only if API endpoint doesn't exist
    const mockUser = await getMockUser();

    if (!mockUser) {
      throw new Error(
        "Login endpoint is not available and no local user is cached. Please register first."
      );
    }

    const usernameMatch =
      mockUser.user.email.toLowerCase() ===
        payload.usernameOrEmail.toLowerCase() ||
      mockUser.user.username ===
        payload.usernameOrEmail;

    if (
      !usernameMatch ||
      payload.password !== mockUser.password
    ) {
      throw new Error("Invalid credentials.");
    }

    const tokens = createMockTokens();

    return {
      user: mockUser.user,
      tokens,
    };
  }
}

export async function register(
  payload: RegisterRequest
): Promise<AuthResponse> {
  console.log("REGISTER REQUEST");

  const response = await apiClient.post(
    "/auth/register",
    payload
  );

  console.log("REGISTER RESPONSE");
  console.log(response.data);

  const result: AuthResponse = {
    user: {
      userId: response.data.user.id,
      name: response.data.user.name,
      email: response.data.user.email,
      phone: response.data.user.phoneNumber,
      username: response.data.user.email,
    },
    tokens: {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
    },
  };

  console.log("REGISTER setStoredJson");
  await setStoredJson(MOCK_USER_KEY, {
    user: result.user,
    password: payload.password,
  });

  console.log("REGISTER setStoredJson");
  return result;
}

export async function logout(): Promise<void> {
  const session = await getStoredSession();

  const accessToken = session.tokens?.accessToken;

  if (getApiBaseUrl() && accessToken) {
    try {
      await apiClient.post(
        "/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error) {
      console.error("LOGOUT ERROR", error);
    }
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
