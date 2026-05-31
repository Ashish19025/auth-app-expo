import * as SecureStore from "expo-secure-store";

import { AuthTokens, AuthUser } from "@/types/auth";

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
const USER_KEY = "auth.user";

export async function saveAuthSession(tokens: AuthTokens, user: AuthUser): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

export async function getStoredSession(): Promise<{ tokens: AuthTokens | null; user: AuthUser | null }> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  const tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;

  return { tokens, user };
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function setStoredJson<T>(key: string, value: T): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function getStoredJson<T>(key: string): Promise<T | null> {
  const rawValue = await SecureStore.getItemAsync(key);

  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue) as T;
}

export async function removeStoredKey(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
