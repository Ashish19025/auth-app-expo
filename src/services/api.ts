import axios from "axios";

const apiBaseUrl = "http://3.27.140.95" || process.env.EXPO_PUBLIC_API_BASE_URL;

console.log("API BASE URL =", apiBaseUrl);

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 12000,
});

apiClient.interceptors.request.use((config) => {
  console.log(
  "REQUEST:",
  config.method,
  `${config.baseURL ?? ""}${config.url ?? ""}`
);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log("RESPONSE:", response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error("AXIOS ERROR:", error);
    console.error("RESPONSE:", error?.response?.data);
    console.error("STATUS:", error?.response?.status);
    throw error;
  }
);

export function getApiBaseUrl(): string | undefined {
  return apiBaseUrl;
}