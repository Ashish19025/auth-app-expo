import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Screen } from "@/components/ui/Screen";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";

export default function HomeScreen() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/(auth)/login" as never);
  }

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Home</Text>
          <Text style={styles.name}>Hi, {user?.name ?? "User"}</Text>
          <Text style={styles.subtext}>You are inside a protected route.</Text>
        </View>

        <AppButton title="Logout" onPress={handleLogout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 16,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  label: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtext: {
    color: COLORS.muted,
    fontSize: 14,
  },
});
