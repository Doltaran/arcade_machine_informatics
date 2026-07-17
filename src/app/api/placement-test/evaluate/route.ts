import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getFallbackPlacementEvaluation,
  type KnowledgeLevel,
  type PlacementEvaluation,
} from "@/lib/placement-test";

const answerSchema = z.object({
  questionId: z.string().min(1),
  topic: z.enum(["number_systems", "logic_conditions", "algorithms_structures"]),
  question: z.string().min(1),
  selectedAnswer: z.string().min(1),
  correctAnswer: z.string().min(1),
  isCorrect: z.boolean(),
});

const requestSchema = z.object({
  userId: z.string().uuid().optional(),
  answers: z.array(answerSchema).length(10),
});

const deepSeekResponseSchema = z.object({
  knowledgeLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  score: z.number().int().min(0).max(100).optional(),
  correctAnswers: z.number().int().min(0).max(10).optional(),
  summary: z.string().min(1),
  topicBreakdown: z.record(
    z.enum(["number_systems", "logic_conditions", "algorithms_structures"]),
    z.object({
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      comment: z.string().min(1),
    })
  ),
  recommendations: z.array(z.string()).default([]),
});

function getSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function extractJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced?.[1] ?? trimmed;
}

async function withTimeout<T>(promise: PromiseLike<T>, ms = 20000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Request timed out")), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function mergeWithLocalScore(
  answers: z.infer<typeof answerSchema>[],
  aiEvaluation: Omit<PlacementEvaluation, "score" | "correctAnswers" | "usedFallback">
): PlacementEvaluation {
  const localEvaluation = getFallbackPlacementEvaluation(answers);

  return {
    ...aiEvaluation,
    score: localEvaluation.score,
    correctAnswers: localEvaluation.correctAnswers,
    usedFallback: false,
  };
}

async function evaluateWithDeepSeek(
  answers: z.infer<typeof answerSchema>[]
): Promise<PlacementEvaluation> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com/chat/completions";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

  if (!apiKey) {
    throw new Error("DeepSeek API key is missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  const response = await fetch(apiUrl, {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ты являешься помощником образовательной игры по информатике для младших школьников. Оцени уровень подготовки ученика по результатам входного теста. Темы: системы счисления и кодирование, логика и условия, алгоритмы и структуры. Оцени по шкале 1, 2 или 3. Верни только JSON без markdown. Тон должен быть поддерживающим, без школьных оценок и без слов о провале.",
        },
        {
          role: "user",
          content: JSON.stringify({
            rules: {
              level1: "слабая подготовка, нужны простые задания и больше подсказок",
              level2: "средний уровень, база понятна, но нужны тренировки",
              level3: "хорошая подготовка, можно давать более сложные задания",
            },
            requiredFormat: {
              knowledgeLevel: 1,
              score: 20,
              correctAnswers: 2,
              summary: "Короткое объяснение результата для ребёнка.",
              topicBreakdown: {
                number_systems: { level: 1, comment: "Краткий комментарий" },
                logic_conditions: { level: 1, comment: "Краткий комментарий" },
                algorithms_structures: { level: 1, comment: "Краткий комментарий" },
              },
              recommendations: ["Короткая рекомендация 1", "Короткая рекомендация 2"],
            },
            answers,
          }),
        },
      ],
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error("DeepSeek API request failed");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("DeepSeek response content is missing");
  }

  const parsed = deepSeekResponseSchema.parse(JSON.parse(extractJson(content)));
  return mergeWithLocalScore(answers, parsed);
}

async function saveResult(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
  answers: z.infer<typeof answerSchema>[],
  evaluation: PlacementEvaluation
) {
  const { error: insertError } = await withTimeout(
    supabase.from("placement_test_results").insert({
      user_id: userId,
      score: evaluation.score,
      knowledge_level: evaluation.knowledgeLevel,
      total_questions: 10,
      correct_answers: evaluation.correctAnswers,
      ai_summary: evaluation.usedFallback
        ? `Использована локальная оценка. ${evaluation.summary}`
        : evaluation.summary,
      topic_breakdown: {
        ...evaluation.topicBreakdown,
        recommendations: evaluation.recommendations,
        usedFallback: evaluation.usedFallback,
      },
      answers,
    })
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: existingProgress, error: selectError } = await withTimeout(
    supabase
      .from("user_progress")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
  );

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existingProgress) {
    const { error: updateError } = await withTimeout(
      supabase
        .from("user_progress")
        .update({
          knowledge_level: evaluation.knowledgeLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
    );

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { error: progressInsertError } = await withTimeout(
    supabase.from("user_progress").insert({
      user_id: userId,
      max_level_completed: 0,
      knowledge_level: evaluation.knowledgeLevel,
    })
  );

  if (progressInsertError) {
    throw new Error(progressInsertError.message);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return NextResponse.json({ error: "Пользователь не авторизован" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());
    const supabase = getSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Пользователь не авторизован" }, { status: 401 });
    }

    const userId = authData.user.id;
    if (payload.userId && payload.userId !== userId) {
      return NextResponse.json({ error: "Нельзя сохранить тест другого пользователя" }, { status: 403 });
    }

    let evaluation: PlacementEvaluation;
    try {
      evaluation = await evaluateWithDeepSeek(payload.answers);
    } catch {
      evaluation = getFallbackPlacementEvaluation(payload.answers);
    }

    await saveResult(supabase, userId, payload.answers, evaluation);

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("Placement test evaluation failed:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Некорректные ответы теста" }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          "Мы не смогли сохранить результат теста. Проверь подключение к Supabase и попробуй ещё раз.",
      },
      { status: 500 }
    );
  }
}
