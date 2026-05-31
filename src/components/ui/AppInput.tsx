import { ReactNode } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { COLORS } from "@/constants/theme";

type AppInputProps = TextInputProps & {
  label: string;
  error?: string;
  rightSlot?: ReactNode;
};

export function AppInput({ label, error, rightSlot, style, ...props }: AppInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputError : undefined]}>
        <TextInput
          placeholderTextColor={COLORS.muted}
          style={[styles.input, style]}
          {...props}
        />
        {rightSlot}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
  },
});
