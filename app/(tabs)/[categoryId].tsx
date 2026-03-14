import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Redirect from tab route to dedicated dhikr screen.
 * The real dhikr experience lives at /dhikr/[categoryId].
 */
export default function CategoryRedirect() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  return <Redirect href={`/dhikr/${categoryId || "1"}`} />;
}
