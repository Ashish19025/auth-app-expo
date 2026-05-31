import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href={"/(protected)/home" as never} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
