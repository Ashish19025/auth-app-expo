import { create } from "axios";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const apiClient = create({
  baseURL: apiBaseUrl,
  timeout: 12000,
});

export function getApiBaseUrl(): string | undefined {
  return apiBaseUrl;
}
