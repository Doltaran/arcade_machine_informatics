"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  PLACEMENT_QUESTIONS,
  knowledgeLevelLabels,
  type KnowledgeLevel,
  type PlacementAnswer,
  type PlacementEvaluation,
} from "@/lib/placement-test";

interface PlacementTestProps {
  user: User;
  onComplete: (result: PlacementEvaluation) => void;
  onCancel?: () => void;
  retake?: boolean;
}

export default function PlacementTest({
  user,
  onComplete,
  onCancel,
  retake = false,
}: PlacementTestProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PlacementEvaluation | null>(null);

  const currentQuestion = PLACEMENT_QUESTIONS[currentIndex];
  const progress = Math.round(((currentIndex + 1) / PLACEMENT_QUESTIONS.length) * 100);
  const answeredCount = Object.keys(selectedAnswers).length;

  const answers: PlacementAnswer[] = useMemo(
    () =>
      PLACEMENT_QUESTIONS.map((question) => {
        const selectedAnswer = selectedAnswers[question.id] ?? "";
        return {
          questionId: question.id,
          topic: question.topic,
          question: question.question,
          selectedAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: selectedAnswer === question.correctAnswer,
        };
      }),
    [selectedAnswers]
  );

  const submitTest = async () => {
    if (answeredCount !== PLACEMENT_QUESTIONS.length) return;

    setSubmitting(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("auth");
      }

      const response = await fetch("/api/placement-test/evaluate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          answers,
        }),
      }).finally(() => clearTimeout(timeout));

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "request");
      }

      setResult(data);
    } catch {
      setError("Не получилось сохранить результат. Проверь подключение и попробуй ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const level = result.knowledgeLevel as KnowledgeLevel;
    return (
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 text-white shadow-2xl backdrop-blur">
        <p className="mb-2 text-center text-sm uppercase tracking-wide text-cyan-300">
          Диагностика завершена
        </p>
        <h1 className="mb-3 text-center text-3xl font-bold text-cyan-400">
          {knowledgeLevelLabels[level]}
        </h1>
        <p className="mb-6 text-center text-slate-300">
          Твой стартовый уровень: {level} из 3
        </p>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-slate-900/60 p-4 text-center">
            <div className="text-2xl font-bold text-white">{result.correctAnswers}/10</div>
            <div className="text-xs text-slate-400">правильных ответов</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-4 text-center">
            <div className="text-2xl font-bold text-white">{result.score}</div>
            <div className="text-xs text-slate-400">игровых баллов</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-4 text-center">
            <div className="text-2xl font-bold text-white">{level}</div>
            <div className="text-xs text-slate-400">уровень подготовки</div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-200">
          {result.summary}
        </div>

        <div className="mb-6 space-y-2">
          {result.recommendations.map((recommendation) => (
            <div
              key={recommendation}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100"
            >
              {recommendation}
            </div>
          ))}
        </div>

        {result.usedFallback && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Мы оценили результат по встроенным правилам. Можно начинать игру!
          </p>
        )}

        <button
          onClick={() => onComplete(result)}
          className="w-full rounded-lg bg-green-600 py-3 font-bold text-white transition-colors hover:bg-green-500"
        >
          Начать игру
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-2xl rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 text-white shadow-2xl backdrop-blur">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm uppercase tracking-wide text-cyan-300">
            {retake ? "Повторный тест" : "Входной тест"}
          </p>
          <h1 className="text-3xl font-bold text-cyan-400">Проверка перед стартом</h1>
        </div>
        <div className="rounded-lg bg-slate-900/60 px-4 py-2 text-sm text-slate-300">
          {currentIndex + 1}/10
        </div>
      </div>

      <div className="mb-6 h-2 rounded-full bg-slate-700">
        <div className="h-2 rounded-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/50 p-5">
        <p className="mb-5 text-xl font-bold text-white">{currentQuestion.question}</p>
        <div className="grid gap-3">
          {currentQuestion.options.map((option) => {
            const selected = selectedAnswers[currentQuestion.id] === option;
            return (
              <button
                key={option}
                onClick={() =>
                  setSelectedAnswers((prev) => ({
                    ...prev,
                    [currentQuestion.id]: option,
                  }))
                }
                className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  selected
                    ? "border-cyan-400 bg-cyan-500/20 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg bg-slate-600 px-5 py-3 font-bold text-white transition-colors hover:bg-slate-500 disabled:opacity-50"
          >
            Назад
          </button>
        )}
        <button
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0 || submitting}
          className="rounded-lg bg-slate-600 px-5 py-3 font-bold text-white transition-colors hover:bg-slate-500 disabled:opacity-50"
        >
          Назад
        </button>
        {currentIndex < PLACEMENT_QUESTIONS.length - 1 ? (
          <button
            onClick={() => setCurrentIndex((index) => Math.min(PLACEMENT_QUESTIONS.length - 1, index + 1))}
            disabled={!selectedAnswers[currentQuestion.id] || submitting}
            className="flex-1 rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            Далее
          </button>
        ) : (
          <button
            onClick={submitTest}
            disabled={answeredCount !== PLACEMENT_QUESTIONS.length || submitting}
            className="flex-1 rounded-lg bg-green-600 py-3 font-bold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {submitting ? "Проверяем..." : "Завершить тест"}
          </button>
        )}
      </div>
    </div>
  );
}
