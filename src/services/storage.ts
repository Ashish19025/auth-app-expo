import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { AuthTokens, AuthUser } from "@/types/auth";

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
const USER_KEY = "auth.user";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  // Only call SecureStore on native platforms
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  // Only call SecureStore on native platforms
  return await SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  // Only call SecureStore on native platforms
  await SecureStore.deleteItemAsync(key);
}

export async function saveAuthSession(
  tokens: AuthTokens,
  user: AuthUser
): Promise<void> {
  console.log("SAVING SESSION");

  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
    setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
    setItem(USER_KEY, JSON.stringify(user)),
  ]);

  console.log("SESSION SAVED");
}

export async function getStoredSession(): Promise<{
  tokens: AuthTokens | null;
  user: AuthUser | null;
}> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
    getItem(USER_KEY),
  ]);

  let parsedUser: AuthUser | null = null;
  if (userJson) {
    try {
      parsedUser = JSON.parse(userJson) as AuthUser;
    } catch (error) {
      console.error("Failed to parse user from storage", error);
    }
  }

  return {
    tokens:
      accessToken && refreshToken
        ? { accessToken, refreshToken }
        : null,
    user: parsedUser,
  };
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
    removeItem(USER_KEY),
  ]);
}

export async function setStoredJson<T>(
  key: string,
  value: T
): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

export async function getStoredJson<T>(
  key: string
): Promise<T | null> {
  const rawValue = await getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Failed to parse JSON for key ${key}`, error);
    return null;
  }
}

export async function removeStoredKey(key: string): Promise<void> {
  await removeItem(key);
}   