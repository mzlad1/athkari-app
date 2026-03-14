import useSWR from "swr";
import { friendsService } from "@/services/friends";

export function useFriends(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `friends-${kidId}` : null,
    () => friendsService.getFriends(kidId!)
  );
  return { friends: data || [], loading: !error && !data, error, refresh: mutate };
}
