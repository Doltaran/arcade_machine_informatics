import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function withTimeout<T>(promise: PromiseLike<T>, ms = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Supabase request timed out")), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export interface UserProgress {
  id: string;
  user_id: string;
  max_level_completed: number;
  knowledge_level: 1 | 2 | 3 | null;
  created_at: string;
  updated_at: string;
}

export async function getUserProgress(userId: string): Promise<UserProgress | null> {
  const { data, error } = await withTimeout(
    supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
  );

  if (error) {
    console.error("Error fetching user progress:", error);
    return null;
  }

  if (!data) {
    const { data: newData, error: insertError } = await withTimeout(
      supabase
        .from("user_progress")
        .insert({ user_id: userId, max_level_completed: 0, knowledge_level: null })
        .select()
        .single()
    );

    if (insertError) {
      console.error("Error creating user progress:", insertError);
      return null;
    }
    return newData;
  }

  return data;
}

export async function updateUserProgress(userId: string, levelCompleted: number): Promise<boolean> {
  // First get current progress
  const current = await getUserProgress(userId);
  if (!current) return false;

  // Only update if new level is higher
  if (levelCompleted > current.max_level_completed) {
    const { error } = await supabase
      .from("user_progress")
      .update({
        max_level_completed: levelCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating user progress:", error);
      return false;
    }
  }

  return true;
}

export async function updateUserKnowledgeLevel(
  userId: string,
  knowledgeLevel: 1 | 2 | 3
): Promise<boolean> {
  const current = await getUserProgress(userId);
  if (!current) return false;

  const { error } = await supabase
    .from("user_progress")
    .update({
      knowledge_level: knowledgeLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Error updating user knowledge level:", error);
    return false;
  }

  return true;
}
