import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0D1A" } }}>
      <Stack.Screen name="role-select" />
      <Stack.Screen name="parent-register" />
      <Stack.Screen name="kid-login" />
      <Stack.Screen name="kid-setup" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="add-kid" />
      <Stack.Screen name="referral" />
    </Stack>
  );
}
