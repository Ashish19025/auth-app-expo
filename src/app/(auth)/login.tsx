import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AuthFooterLink } from "@/components/auth/AuthFooterLink";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { Screen } from "@/components/ui/Screen";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";

type FormState = {
  usernameOrEmail: string;
  password: string;
};

export default function LoginScreen() {
  const { login } = useAuth();

  const [form, setForm] = useState<FormState>({ usernameOrEmail: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState("");

  function validate(values: FormState) {
    const next: Partial<FormState> = {};

    if (!values.usernameOrEmail.trim()) {
      next.usernameOrEmail = "Username or email is required.";
    }

    if (!values.password.trim()) {
      next.password = "Password is required.";
    }

    return next;
  }

  async function handleLogin() {
    const validation = validate(form);
    setErrors(validation);
    setSubmitError("");

    if (Object.keys(validation).length > 0) {
      return;
    }

    try {
      setLoading(true);
      await login(form);
      router.replace("/(protected)/home" as never);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <AuthHeader
          title="Welcome back"
          subtitle="Log in with your username and password."
        />

        <View style={styles.formWrap}>
          <AppInput
            label="Username or Email"
            autoCapitalize="none"
            autoCorrect={false}
            value={form.usernameOrEmail}
            onChangeText={(value) => setForm((prev) => ({ ...prev, usernameOrEmail: value }))}
            error={errors.usernameOrEmail}
          />

          <AppInput
            label="Password"
            secureTextEntry
            value={form.password}
            onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
            error={errors.password}
          />

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <AppButton title="Log In" onPress={handleLogin} loading={loading} />
        </View>
        <Text>
            {process.env.EXPO_PUBLIC_API_BASE_URL}
        </Text>

        <AuthFooterLink prompt="No account yet?" linkText="Create one" href="/(auth)/register" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    gap: 24,
    paddingVertical: 16,
  },
  formWrap: {
    gap: 14,
  },
  error: {
    fontSize: 13,
    color: COLORS.danger,
  },
});
