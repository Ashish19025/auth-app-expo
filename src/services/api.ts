import axios from "axios";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

console.log("================================");
console.log("API BASE URL =", apiBaseUrl);
console.log("================================");

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config) => {
    console.log("========== REQUEST ==========");
    console.log("METHOD:", config.method?.toUpperCase());
    console.log("BASE URL:", config.baseURL);
    console.log("URL:", config.url);
    console.log("FULL URL:", `${config.baseURL ?? ""}${config.url ?? ""}`);
    console.log("BODY:", JSON.stringify(config.data, null, 2));
    console.log("============================");

    return config;
  },
  (error) => {
    console.log("REQUEST ERROR:", error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log("========== RESPONSE ==========");
    console.log("STATUS:", response.status);
    console.log("URL:", response.config.url);
    console.log("DATA:", JSON.stringify(response.data, null, 2));
    console.log("=============================");

    return response;
  },
  (error) => {
    console.log("========== AXIOS ERROR ==========");
    console.log("MESSAGE:", error.message);
    console.log("CODE:", error.code);
    console.log("STATUS:", error?.response?.status);
    console.log("DATA:", error?.response?.data);
    console.log("URL:", error?.config?.url);
    console.log("BASE URL:", error?.config?.baseURL);
    console.log("================================");

    return Promise.reject(error);
  }
);

export function getApiBaseUrl(): string | undefined {
  return apiBaseUrl;
}