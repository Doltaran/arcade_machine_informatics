"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KnowledgeLevel } from "@/lib/placement-test";

interface HelperQuestion {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface LevelAIHelperProps {
  levelId: number;
  levelTitle: string;
  topic: string;
  currentTask: string;
  knowledgeLevel?: KnowledgeLevel | null;
  playerState?: {
    collectedItems?: string[];
    currentError?: string;
    status?: string;
  };
}

const MAX_QUESTION_LENGTH = 300;

export default function LevelAIHelper({
  levelId,
  levelTitle,
  topic,
  currentTask,
  knowledgeLevel,
  playerState,
}: LevelAIHelperProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<HelperQuestion[]>([]);
  const [remaining, setRemaining] = useState(3);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadHistory = async () => {
      setLoadingHistory(true);
      setError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("auth");

        const response = await fetch(`/api/ai-helper?levelId=${levelId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "history");

        if (!cancelled) {
          setHistory(data.questions ?? []);
          setRemaining(data.remaining ?? 0);
        }
      } catch {
        if (!cancelled) {
          setError("Не получилось загрузить историю помощника.");
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [open, levelId]);

  const askQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setError("Напиши вопрос, и я попробую помочь подсказкой.");
      return;
    }
    if (trimmed.length > MAX_QUESTION_LENGTH) {
      setError("Вопрос слишком длинный. Попробуй уложиться в 300 символов.");
      return;
    }
    if (remaining <= 0) {
      setError("Лимит подсказок на этом уровне закончился. Попробуй применить то, что уже узнал!");
      return;
    }

    setAsking(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("auth");

      const response = await fetch("/api/ai-helper", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          levelId,
          levelTitle,
          topic,
          currentTask,
          knowledgeLevel: knowledgeLevel ?? null,
          playerState,
          question: trimmed,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "ask");
      }

      setHistory((prev) => [...prev, data.question]);
      setRemaining(data.remaining ?? 0);
      setQuestion("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Помощник временно не отвечает. Попробуй ещё раз."
      );
    } finally {
      setAsking(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-20 right-4 z-20 rounded-full border border-cyan-400/50 bg-slate-900/90 px-4 py-3 text-sm font-bold text-cyan-100 shadow-2xl transition-colors hover:bg-slate-800"
      >
        Космо-помощник
      </button>
    );
  }

  return (
    <div className="absolute bottom-20 right-4 z-20 w-[360px] rounded-xl border border-cyan-400/40 bg-slate-900/95 p-4 text-white shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-cyan-300">Космо-помощник</h3>
          <p className="mt-1 text-xs text-slate-400">
            Я могу помочь подсказкой, но не дам готовый ответ.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
        >
          Свернуть
        </button>
      </div>

      <div className="mb-3 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
        {remaining > 0
          ? remaining === 1
            ? "Остался 1 вопрос"
            : `Осталось вопросов: ${remaining}`
          : "Вопросы закончились"}
      </div>

      <div className="mb-3 max-h-56 space-y-3 overflow-y-auto pr-1">
        {loadingHistory ? (
          <p className="text-sm text-slate-400">Загружаю историю...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">История подсказок пока пустая.</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="space-y-2 rounded-lg bg-slate-800/70 p-3 text-sm">
              <p className="text-slate-200">
                <span className="font-bold text-cyan-300">Ты:</span> {item.question}
              </p>
              <p className="text-slate-300">
                <span className="font-bold text-yellow-300">Помощник:</span> {item.answer}
              </p>
            </div>
          ))
        )}
      </div>

      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION_LENGTH))}
        disabled={asking || remaining <= 0}
        placeholder="Например: почему дверь не открывается?"
        className="mb-2 h-20 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400 disabled:opacity-50"
      />
      <div className="mb-3 text-right text-[11px] text-slate-500">
        {question.length}/{MAX_QUESTION_LENGTH}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={askQuestion}
        disabled={asking || remaining <= 0 || question.trim().length === 0}
        className="w-full rounded-lg bg-cyan-600 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        {asking ? "Думаю..." : "Спросить"}
      </button>
    </div>
  );
}
