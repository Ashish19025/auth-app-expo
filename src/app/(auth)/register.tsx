import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AuthFooterLink } from "@/components/auth/AuthFooterLink";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { TermsModal } from "@/components/auth/TermsModal";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { InlineAction } from "@/components/ui/InlineAction";
import { Screen } from "@/components/ui/Screen";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { requestPhoneOtp, verifyPhoneOtp } from "@/services/firebase";
import { fetchTerms, saveTermsSelection } from "@/services/termsService";
import { TermsItem, TermsSelections } from "@/types/terms";
import {
  isStrongPassword,
  isValidEmail,
  isValidPhone,
} from "@/utils/validators";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  phone: string;
  otpCode: string;
};

export default function RegisterScreen() {
  const { register } = useAuth();

  const [form, setForm] = useState<RegisterForm>({
    name: "",
    email: "",
    password: "",
    phone: "",
    otpCode: "",
  });
  const [errors, setErrors] = useState<Partial<RegisterForm>>({});
  const [submitError, setSubmitError] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [firebaseIdToken, setFirebaseIdToken] = useState("");
  const [terms, setTerms] = useState<TermsItem[]>([]);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    async function loadTerms() {
      try {
        const data = await fetchTerms();
        setTerms(data);
      } catch {
        setTerms([]);
      }
    }

    loadTerms();
  }, []);

  const canVerifyOtp = useMemo(
    () => !!verificationId && form.otpCode.trim().length >= 4,
    [verificationId, form.otpCode],
  );

  function validate(values: RegisterForm) {
    const next: Partial<RegisterForm> = {};

    if (!values.name.trim()) {
      next.name = "Name is required.";
    }

    if (!isValidEmail(values.email)) {
      next.email = "Enter a valid email address.";
    }

    if (!isStrongPassword(values.password)) {
      next.password = "Password must be at least 8 characters.";
    }

    if (!isValidPhone(values.phone)) {
      next.phone = "Use phone format like +919999999999.";
    }

    if (!values.otpCode.trim()) {
      next.otpCode = "OTP code is required.";
    }

    return next;
  }

  async function handleSendOtp() {
    setErrors((prev) => ({ ...prev, phone: undefined }));
    setSubmitError("");

    if (!isValidPhone(form.phone)) {
      setErrors((prev) => ({
        ...prev,
        phone: "Use phone format like +919999999999.",
      }));
      return;
    }

    try {
      setLoadingOtp(true);
      const id = await requestPhoneOtp(form.phone);
      setVerificationId(id);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "OTP request failed.",
      );
    } finally {
      setLoadingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (!canVerifyOtp) {
      return;
    }

    try {
      setLoadingVerify(true);
      const token = await verifyPhoneOtp(verificationId, form.otpCode.trim());
      console.log("TOKEN RECEIVED:", token);
      console.log("TOKEN LENGTH:", token?.length);
      setFirebaseIdToken(token);
      setSubmitError("");
    } catch (error) {
      setFirebaseIdToken("");
      setSubmitError(
        error instanceof Error ? error.message : "OTP verification failed.",
      );
    } finally {
      setLoadingVerify(false);
    }
  }

  function handleOpenTerms() {
    const validation = validate(form);
    setErrors(validation);
    setSubmitError("");

    if (Object.keys(validation).length > 0) {
      return;
    }

    if (!firebaseIdToken) {
      setSubmitError("Verify OTP first.");
      return;
    }

    setShowTerms(true);
  }

  async function handleConfirmTerms(selections: TermsSelections) {
    try {
      setLoadingRegister(true);
      console.log("firebaseIdToken before register:", firebaseIdToken);
      console.log("firebaseIdToken length:", firebaseIdToken?.length);
      console.log("REGISTER START");
      console.log({
       name: form.name,
       email: form.email,
       phone: form.phone,
       tokenLength: firebaseIdToken.length,
      });

      const registeredUser = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
        firebaseIdToken,
        termsSelections: Object.entries(selections).map(
          ([termId, accepted]) => ({
            termId,
            accepted,
          }),
        ),
      });

      console.log("REGISTER SUCCESS");
      console.log(registeredUser);

      try {
        await saveTermsSelection(registeredUser.userId, selections);
      } catch {
        // Terms persistence is best-effort so the user can continue into the app.
      }

      setShowTerms(false);
      router.replace("/(protected)/home" as never);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed.";
      if (errorMessage.includes("User already exists")) {
        setSubmitError("You already have an account. Please log in instead.");
      } else {
        setSubmitError(errorMessage);
      }
    } finally {
      setLoadingRegister(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <AuthHeader
          title="Create account"
          subtitle="Register with details and phone OTP verification."
        />

        <View style={styles.formWrap}>
          <AppInput
            label="Name"
            value={form.name}
            onChangeText={(value) =>
              setForm((prev) => ({ ...prev, name: value }))
            }
            error={errors.name}
          />

          <AppInput
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(value) =>
              setForm((prev) => ({ ...prev, email: value }))
            }
            error={errors.email}
          />

          <AppInput
            label="Password"
            secureTextEntry
            value={form.password}
            onChangeText={(value) =>
              setForm((prev) => ({ ...prev, password: value }))
            }
            error={errors.password}
          />

          <AppInput
            label="Phone"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(value) =>
              setForm((prev) => ({ ...prev, phone: value }))
            }
            error={errors.phone}
            rightSlot={
              <InlineAction
                label={verificationId ? "Resend" : "Send OTP"}
                onPress={handleSendOtp}
                loading={loadingOtp}
              />
            }
          />

          <AppInput
            label="OTP Code"
            keyboardType="number-pad"
            value={form.otpCode}
            onChangeText={(value) =>
              setForm((prev) => ({ ...prev, otpCode: value }))
            }
            error={errors.otpCode}
            rightSlot={
              <InlineAction
                label={firebaseIdToken ? "Verified" : "Verify"}
                onPress={handleVerifyOtp}
                loading={loadingVerify}
                disabled={!canVerifyOtp || !!firebaseIdToken}
              />
            }
          />

          {firebaseIdToken ? (
            <Text style={styles.success}>
              Phone number verified successfully.
            </Text>
          ) : null}
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <AppButton title="Create Account" onPress={handleOpenTerms} />
        </View>

        <AuthFooterLink
          prompt="Already have an account?"
          linkText="Log in"
          href="/(auth)/login"
        />
     </View>

      {showTerms ? (
        <TermsModal
          visible={showTerms}
          terms={terms}
          onClose={() => setShowTerms(false)}
          onConfirm={handleConfirmTerms}
          loading={loadingRegister}
          serverError={submitError}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 16,
  },
  formWrap: {
    gap: 12,
  },
  success: {
    color: COLORS.success,
    fontSize: 13,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
  },
});
