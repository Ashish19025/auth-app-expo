import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let initialized = false;

export function ensureFirebaseInitialized(): void {
  if (initialized) {
    return;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    return;
  }

  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }

  initialized = true;
}

export function getFirebaseAuth() {
  ensureFirebaseInitialized();

  if (getApps().length === 0) {
    throw new Error("Firebase config missing. Set EXPO_PUBLIC_FIREBASE_* env vars.");
  }

  return getAuth();
}

export async function requestPhoneOtp(phone: string): Promise<string> {
  const useMockOtp = process.env.EXPO_PUBLIC_USE_MOCK_OTP === "true";

  if (useMockOtp) {
    if (!phone.trim()) {
      throw new Error("Phone number is required.");
    }

    return "mock-verification-id";
  }

  throw new Error("Phone OTP for Expo managed workflow needs Firebase phone auth native setup. Keep EXPO_PUBLIC_USE_MOCK_OTP=true for assignment demo.");
}

export async function verifyPhoneOtp(verificationId: string, code: string): Promise<string> {
  const useMockOtp = process.env.EXPO_PUBLIC_USE_MOCK_OTP === "true";

  if (useMockOtp) {
    if (!verificationId || code.length < 4) {
      throw new Error("Invalid OTP code.");
    }

    return "mock-firebase-id-token";
  }

  throw new Error("Phone OTP verification for Expo managed workflow needs Firebase phone auth native setup. Keep EXPO_PUBLIC_USE_MOCK_OTP=true for assignment demo.");
}
