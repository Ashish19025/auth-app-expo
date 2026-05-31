import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { COLORS } from "@/constants/theme";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
};

export function AppButton({ title, onPress, loading, disabled, variant = "primary" }: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "ghost" ? styles.ghost : styles.primary,
        pressed ? styles.pressed : undefined,
        isDisabled ? styles.disabled : undefined,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? COLORS.text : "#FFFFFF"} />
      ) : (
        <Text style={[styles.text, variant === "ghost" ? styles.ghostText : styles.primaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  ghostText: {
    color: COLORS.text,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});
