import auth, {
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { getApps } from "@react-native-firebase/app";
console.log("FIREBASE APPS:", getApps().length);


let confirmationResult: FirebaseAuthTypes.ConfirmationResult | null = null;


/**
 * Send OTP to phone number
 */
export async function requestPhoneOtp(
  phone: string
): Promise<string> {
  if (!phone?.trim()) {
    throw new Error("Phone number is required.");
  }

  try {
    console.log("SENDING OTP TO:", phone);

    confirmationResult = await auth().signInWithPhoneNumber(phone);

    console.log("OTP SENT SUCCESSFULLY");

    return confirmationResult.verificationId ?? "otp-sent";
  } catch (error: any) {
    console.error("SEND OTP ERROR:", error);

    throw new Error(
      error?.message || "Failed to send OTP"
    );
  }
}

/**
 * Verify OTP and return Firebase ID Token
 */
export async function verifyPhoneOtp(
  _verificationId: string,
  code: string
): Promise<string> {
  if (!code?.trim()) {
    throw new Error("OTP is required.");
  }

  if (!confirmationResult) {
    throw new Error(
      "No OTP request found. Please request OTP again."
    );
  }

  try {
    console.log("VERIFYING OTP");

    const confirmation = confirmationResult;

   const credential = await confirmation.confirm(code);

if (!credential) {
  throw new Error("OTP verification failed.");
}

const user = credential.user;

if (!user) {
  throw new Error("User not found.");
}

    const token = await user.getIdToken(true);

    console.log(
      "FIREBASE TOKEN LENGTH:",
      token.length
    );

    console.log(
      "USER UID:",
      user.uid
    );

    return token;
  } catch (error: any) {
    console.error("VERIFY OTP ERROR:", error);

    throw new Error(
      error?.message || "OTP verification failed"
    );
  }
}

/**
 * Current Firebase user
 */
export function getCurrentUser() {
  return auth().currentUser;
}

/**
 * Logout
 */
export async function signOutUser() {
  await auth().signOut();
  confirmationResult = null;
}