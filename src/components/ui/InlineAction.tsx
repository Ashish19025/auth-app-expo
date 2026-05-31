import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { COLORS } from "@/constants/theme";

type InlineActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function InlineAction({ label, onPress, disabled, loading }: InlineActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : undefined, disabled ? styles.disabled : undefined]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    minWidth: 72,
    alignItems: "center",
  },
  label: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
