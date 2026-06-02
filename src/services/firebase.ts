import { getApps, initializeApp } from "firebase/app";
import {
  ConfirmationResult,
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { Platform } from "react-native";

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

  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId
  ) {
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
    throw new Error(
      "Firebase config missing. Set EXPO_PUBLIC_FIREBASE_* env vars.",
    );
  }

  return getAuth();
}

let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

export async function requestPhoneOtp(phone: string): Promise<string> {
  if (!phone.trim()) {
    throw new Error("Phone number is required.");
  }

  if (Platform.OS !== "web") {
    throw new Error(
      "Real phone OTP requires ReCaptcha which only works on Web in Expo Go. Run the app on Web (press 'w' in terminal).",
    );
  }

  const auth = getFirebaseAuth();

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible",
      }
    );
  }

  confirmationResult = await signInWithPhoneNumber(
    auth,
    phone,
    recaptchaVerifier
  );

  console.log(
    "OTP sent successfully. Verification ID:",
    confirmationResult.verificationId
  );

  return confirmationResult.verificationId;
}

export async function verifyPhoneOtp(
  verificationId: string,
  code: string
): Promise<string> {
  if (Platform.OS !== "web") {
    throw new Error(
      "Real phone OTP requires ReCaptcha which only works on Web in Expo Go. Run the app on Web (press 'w' in terminal).",
    );
  }

  if (!confirmationResult) {
    throw new Error(
      "No confirmation result found. Request OTP again."
    );
  }

  const result = await confirmationResult.confirm(code);

  const token = await result.user.getIdToken();

  console.log("REAL FIREBASE TOKEN LENGTH:", token.length);
  console.log("USER UID:", result.user.uid);

  return token;
}