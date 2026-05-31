import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/theme";

type AuthFooterLinkProps = {
  prompt: string;
  linkText: string;
  href: string;
};

export function AuthFooterLink({ prompt, linkText, href }: AuthFooterLinkProps) {
  return (
    <View style={styles.footerWrap}>
      <Text style={styles.footerText}>{prompt}</Text>
      <Link href={href as never} style={styles.linkText}>
        {linkText}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    color: COLORS.muted,
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});
