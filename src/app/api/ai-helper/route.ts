import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { KnowledgeLevel } from "@/lib/placement-test";

const MAX_QUESTIONS_PER_LEVEL = 3;
const MAX_QUESTION_LENGTH = 300;

const helperRequestSchema = z.object({
  levelId: z.number().int().min(1).max(99),
  levelTitle: z.string().min(1).max(120),
  topic: z.string().min(1).max(120),
  currentTask: z.string().min(1).max(300),
  knowledgeLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  playerState: z
    .object({
      currentError: z.string().max(200).optional(),
      collectedItems: z.array(z.string()).max(12).optional(),
      status: z.string().max(200).optional(),
    })
    .optional(),
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
});

type HelperRequest = z.infer<typeof helperRequestSchema>;

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

function getLocalHint(topic: string, knowledgeLevel: KnowledgeLevel | null) {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes("алгоритм")) {
    return knowledgeLevel === 3
      ? "Проверь шаг, на котором исполнитель меняет состояние. Что должно быть верно перед следующим действием?"
      : "Посмотри, на каком шаге робот остановился. Обычно ошибку проще найти, если проверить команды по одной.";
  }

  if (normalizedTopic.includes("счислен") || normalizedTopic.includes("кодирован")) {
    return knowledgeLevel === 3
      ? "Разбей число на разряды и проверь, где меняется старший бит."
      : "Попробуй разобрать число справа налево. Каждый следующий разряд становится важнее предыдущего.";
  }

  return knowledgeLevel === 3
    ? "Раздели условие на части. Какая часть сейчас не выполнена?"
    : "Проверь условие по частям. Если там «И», должны выполняться обе части. Если «ИЛИ» — достаточно одной. Если «НЕ» — нужного признака быть не должно.";
}

function looksTooDirect(answer: string) {
  const normalized = answer.toLowerCase();
  return [
    "правильный ответ",
    "выбери",
    "нажми именно",
    "сделай так:",
    "готовое решение",
    "ответ:",
  ].some((phrase) => normalized.includes(phrase));
}

function getPromptStyle(knowledgeLevel: KnowledgeLevel | null) {
  if (knowledgeLevel === 1) {
    return "Подсказка должна быть более подробной: объясни правило простыми словами и дай маленький пример без решения текущей задачи.";
  }
  if (knowledgeLevel === 3) {
    return "Подсказка должна быть краткой: минимум объяснений, больше наводящих вопросов.";
  }
  return "Подсказка должна быть стандартной: задай наводящий вопрос и подскажи, какую часть задачи проверить.";
}

async function askDeepSeek(payload: HelperRequest) {
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
      messages: [
        {
          role: "system",
          content:
            "Ты — доброжелательный ИИ-помощник в образовательной игре по информатике для младших школьников. Игрок проходит уровень в роли космонавта-инженера. Твоя задача — помочь игроку подумать, но не давать готовый ответ. Правила: не называй точное решение, не перечисляй готовую последовательность команд, не говори какой вариант выбрать, не решай задачу за игрока, давай наводящие вопросы, объясняй простыми словами, отвечай 2–5 предложениями, если игрок просит прямой ответ — мягко откажись и дай подсказку.",
        },
        {
          role: "user",
          content: `Текущий уровень:
- Номер: ${payload.levelId}
- Название: ${payload.levelTitle}
- Тема: ${payload.topic}
- Уровень подготовки игрока: ${payload.knowledgeLevel ?? 2}
- Текущая задача: ${payload.currentTask}
- Собранные предметы: ${payload.playerState?.collectedItems?.join(", ") || "нет данных"}
- Статус игрока: ${payload.playerState?.status || "нет данных"}
- Последняя ошибка: ${payload.playerState?.currentError || "нет"}

Стиль помощи: ${getPromptStyle(payload.knowledgeLevel)}

Вопрос игрока:
${payload.question}

Дай подсказку без готового ответа.`,
        },
      ],
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error("DeepSeek API request failed");
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || answer.trim().length === 0) {
    throw new Error("DeepSeek response content is missing");
  }

  const trimmed = answer.trim();
  if (looksTooDirect(trimmed)) {
    return getLocalHint(payload.topic, payload.knowledgeLevel);
  }

  return trimmed;
}

async function getAuthorizedUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return { error: NextResponse.json({ error: "Пользователь не авторизован" }, { status: 401 }) };
  }

  const supabase = getSupabaseClient(accessToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "Пользователь не авторизован" }, { status: 401 }) };
  }

  return { supabase, user: data.user };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthorizedUser(request);
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const levelId = Number(url.searchParams.get("levelId"));
    if (!Number.isInteger(levelId) || levelId < 1) {
      return NextResponse.json({ error: "Некорректный уровень" }, { status: 400 });
    }

    const { data, error } = await withTimeout(
      auth.supabase
        .from("ai_helper_questions")
        .select("id, question, answer, created_at")
        .eq("user_id", auth.user.id)
        .eq("level_id", levelId)
        .order("created_at", { ascending: true })
    );

    if (error) throw new Error(error.message);

    const questions = data ?? [];
    return NextResponse.json({
      questions,
      remaining: Math.max(0, MAX_QUESTIONS_PER_LEVEL - questions.length),
      limit: MAX_QUESTIONS_PER_LEVEL,
    });
  } catch (error) {
    console.error("AI helper history failed:", error);
    return NextResponse.json({ error: "Не получилось загрузить историю помощника" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthorizedUser(request);
    if ("error" in auth) return auth.error;

    const payload = helperRequestSchema.parse(await request.json());

    const { count, error: countError } = await withTimeout(
      auth.supabase
        .from("ai_helper_questions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("level_id", payload.levelId)
    );

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= MAX_QUESTIONS_PER_LEVEL) {
      return NextResponse.json(
        {
          error: "Лимит подсказок на этом уровне закончился. Попробуй применить то, что уже узнал!",
          limitReached: true,
        },
        { status: 429 }
      );
    }

    let answer: string;
    let usedFallback = false;
    try {
      answer = await askDeepSeek(payload);
    } catch {
      answer = getLocalHint(payload.topic, payload.knowledgeLevel);
      usedFallback = true;
    }

    const { data, error: insertError } = await withTimeout(
      auth.supabase
        .from("ai_helper_questions")
        .insert({
          user_id: auth.user.id,
          level_id: payload.levelId,
          question: payload.question,
          answer,
        })
        .select("id, question, answer, created_at")
        .single()
    );

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({
      question: data,
      remaining: Math.max(0, MAX_QUESTIONS_PER_LEVEL - (count ?? 0) - 1),
      limit: MAX_QUESTIONS_PER_LEVEL,
      usedFallback,
    });
  } catch (error) {
    console.error("AI helper question failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Проверь вопрос: он должен быть от 1 до 300 символов." }, { status: 400 });
    }

    return NextResponse.json({ error: "Помощник временно не отвечает. Попробуй ещё раз." }, { status: 500 });
  }
}
