import AsyncStorage from "@react-native-async-storage/async-storage";

const getKey = (kidId: string) => {
  const today = new Date().toISOString().split("T")[0];
  return `completed_cats_${kidId}_${today}`;
};

export const completedCategoriesService = {
  async getCompleted(kidId: string): Promise<Set<number>> {
    const raw = await AsyncStorage.getItem(getKey(kidId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  },

  async markCompleted(kidId: string, categoryId: number): Promise<void> {
    const existing = await this.getCompleted(kidId);
    existing.add(categoryId);
    await AsyncStorage.setItem(getKey(kidId), JSON.stringify([...existing]));
  },
};
