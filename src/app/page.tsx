"use client";

import { useEffect, useState } from "react";
import { supabase, getUserProgress, updateUserProgress } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Game from "@/components/Game";
import PlacementTest from "@/components/PlacementTest";
import {
  knowledgeLevelLabels,
  type KnowledgeLevel,
  type PlacementEvaluation,
} from "@/lib/placement-test";

type Screen = "auth" | "menu" | "themes" | "levels" | "game" | "placement";

const TOTAL_LEVELS = 7;
const THEMES = [
  {
    id: "coding",
    title: "Системы счисления и кодирование",
    subtitle: "Уровни по двоичной логике и кодированию",
    levels: [1, 2, 3],
  },
  {
    id: "logic",
    title: "Логика и условия",
    subtitle: "Логические ворота и таблицы истинности",
    levels: [4, 5],
  },
  {
    id: "algorithms",
    title: "Алгоритмы и структуры",
    subtitle: "Исполнитель и пошаговые алгоритмы",
    levels: [6, 7],
  },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("auth");
  const [maxLevelCompleted, setMaxLevelCompleted] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0].id);
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel | null>(null);
  const [pendingStartLevel, setPendingStartLevel] = useState<number | null>(null);
  const [placementRetake, setPlacementRetake] = useState(false);

  const activeTheme = THEMES.find((theme) => theme.id === selectedTheme) ?? THEMES[0];

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Check auth on load
  useEffect(() => {
    let mounted = true;

    const handleSession = async (sessionUser: User | null) => {
      if (!mounted) return;

      setUser(sessionUser);
      if (sessionUser) {
        const progress = await loadProgress(sessionUser.id);
        if (!mounted) return;
        setScreen(progress?.knowledge_level ? "menu" : "placement");
      } else {
        setScreen("auth");
        setMaxLevelCompleted(0);
        setKnowledgeLevel(null);
        setPendingStartLevel(null);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => handleSession(session?.user ?? null))
      .catch(() => {
        if (mounted) {
          setScreen("auth");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session?.user ?? null);
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadProgress = async (userId: string) => {
    const progress = await getUserProgress(userId);
    if (progress) {
      setMaxLevelCompleted(progress.max_level_completed);
      setKnowledgeLevel(progress.knowledge_level);
    }
    return progress;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleLevelComplete = async (level: number) => {
    if (user && level > maxLevelCompleted) {
      setMaxLevelCompleted(level);
      await updateUserProgress(user.id, level);
    }
  };

  const handleStartGame = (level: number) => {
    if (!knowledgeLevel) {
      setPendingStartLevel(level);
      setPlacementRetake(false);
      setScreen("placement");
      return;
    }

    setSelectedLevel(level);
    setScreen("game");
  };

  const handleExitGame = () => {
    setScreen("menu");
  };

  const handlePlacementComplete = (result: PlacementEvaluation) => {
    setKnowledgeLevel(result.knowledgeLevel);

    if (pendingStartLevel) {
      setSelectedLevel(pendingStartLevel);
      setPendingStartLevel(null);
      setScreen("game");
      return;
    }

    setPlacementRetake(false);
    setScreen("menu");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-2xl text-white">Загрузка...</div>
      </div>
    );
  }

  // Game screen
  if (screen === "game") {
    return (
      <Game
        startLevel={selectedLevel}
        knowledgeLevel={knowledgeLevel}
        onLevelComplete={handleLevelComplete}
        onExit={handleExitGame}
      />
    );
  }

  if (screen === "placement" && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(80)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 100}%`,
                width: `${(i % 3) + 1}px`,
                height: `${(i % 3) + 1}px`,
                opacity: 0.25 + (i % 5) * 0.12,
              }}
            />
          ))}
        </div>
        <PlacementTest
          user={user}
          retake={placementRetake}
          onComplete={handlePlacementComplete}
          onCancel={
            placementRetake
              ? () => {
                  setPlacementRetake(false);
                  setPendingStartLevel(null);
                  setScreen("menu");
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              opacity: Math.random() * 0.8 + 0.2,
            }}
          />
        ))}
      </div>

      {/* Auth Screen */}
      {screen === "auth" && (
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 shadow-2xl backdrop-blur">
            <h1 className="mb-2 text-center text-3xl font-bold text-cyan-400">
              Binary Robot Challenge
            </h1>
            <p className="mb-6 text-center text-slate-400">
              Образовательный платформер по информатике
            </p>

            <div className="mb-6 flex rounded-lg bg-slate-700 p-1">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  authMode === "login"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Вход
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  authMode === "register"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Регистрация
              </button>
            </div>

            <form onSubmit={handleAuth}>
              <div className="mb-4">
                <label className="mb-1 block text-sm text-slate-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="example@mail.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="mb-1 block text-sm text-slate-300">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {authError && (
                <p className="mb-4 text-center text-sm text-red-400">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
              >
                {authLoading
                  ? "Загрузка..."
                  : authMode === "login"
                  ? "Войти"
                  : "Зарегистрироваться"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {screen === "menu" && (
        <div className="relative z-10 w-full max-w-lg">
          <div className="rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 shadow-2xl backdrop-blur">
            <h1 className="mb-2 text-center text-4xl font-bold text-cyan-400">
              Binary Robot Challenge
            </h1>
            <p className="mb-8 text-center text-slate-400">
              Изучай двоичную систему счисления!
            </p>

            {user && (
              <p className="mb-6 text-center text-sm text-slate-400">
                Вы вошли как: <span className="text-cyan-400">{user.email}</span>
              </p>
            )}

            {knowledgeLevel && (
              <div className="mb-6 rounded-lg bg-slate-700/50 p-4 text-center text-sm text-slate-300">
                Уровень подготовки:{" "}
                <span className="font-bold text-cyan-400">
                  {knowledgeLevelLabels[knowledgeLevel]}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={() => handleStartGame(1)}
                className="w-full rounded-lg bg-green-600 py-4 text-xl font-bold text-white transition-colors hover:bg-green-500"
              >
                Новая игра
              </button>

              <button
                onClick={() => setScreen("themes")}
                className="w-full rounded-lg bg-blue-600 py-4 text-xl font-bold text-white transition-colors hover:bg-blue-500"
              >
                Выбор темы
              </button>

              <button
                onClick={() => {
                  setPendingStartLevel(null);
                  setPlacementRetake(true);
                  setScreen("placement");
                }}
                className="w-full rounded-lg bg-cyan-700 py-4 text-xl font-bold text-white transition-colors hover:bg-cyan-600"
              >
                Пройти тест заново
              </button>

              <button
                onClick={handleLogout}
                className="w-full rounded-lg bg-slate-600 py-4 text-xl font-bold text-white transition-colors hover:bg-slate-500"
              >
                Выход из аккаунта
              </button>
            </div>

            <div className="mt-8 rounded-lg bg-slate-700/50 p-4">
              <p className="text-center text-sm text-slate-300">
                Прогресс: {maxLevelCompleted}/{TOTAL_LEVELS} уровней пройдено
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-600">
                <div
                  className="h-2 rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${(maxLevelCompleted / TOTAL_LEVELS) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Themes Screen */}
      {screen === "themes" && (
        <div className="relative z-10 w-full max-w-lg">
          <div className="rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 shadow-2xl backdrop-blur">
            <h2 className="mb-6 text-center text-3xl font-bold text-cyan-400">
              Темы
            </h2>

            <div className="space-y-4 mb-6">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setSelectedTheme(theme.id);
                    setScreen("levels");
                  }}
                  className="w-full rounded-xl border border-slate-600 bg-slate-700/60 p-4 text-left transition-colors hover:bg-slate-700"
                >
                  <div className="text-lg font-bold text-white">{theme.title}</div>
                  <div className="text-sm text-slate-300">{theme.subtitle}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setScreen("menu")}
              className="w-full rounded-lg bg-slate-600 py-3 font-bold text-white transition-colors hover:bg-slate-500"
            >
              Назад
            </button>
          </div>
        </div>
      )}

      {/* Level Select Screen */}
      {screen === "levels" && (
        <div className="relative z-10 w-full max-w-lg">
          <div className="rounded-2xl border-2 border-slate-700 bg-slate-800/90 p-8 shadow-2xl backdrop-blur">
            <h2 className="mb-2 text-center text-3xl font-bold text-cyan-400">
              {activeTheme.title}
            </h2>
            <p className="mb-6 text-center text-sm text-slate-400">
              {activeTheme.subtitle}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {activeTheme.levels.map((levelNum) => {
                const isUnlocked = levelNum === 1 || maxLevelCompleted >= levelNum - 1;
                const isCompleted = maxLevelCompleted >= levelNum;

                return (
                  <button
                    key={levelNum}
                    onClick={() => isUnlocked && handleStartGame(levelNum)}
                    disabled={!isUnlocked}
                    className={`relative rounded-xl p-6 text-center transition-all ${
                      isUnlocked
                        ? isCompleted
                          ? "bg-green-600 hover:bg-green-500"
                          : "bg-blue-600 hover:bg-blue-500"
                        : "cursor-not-allowed bg-slate-700 opacity-50"
                    }`}
                  >
                    <div className="text-3xl font-bold text-white">{levelNum}</div>
                    <div className="mt-1 text-sm text-white/80">
                      {levelNum === 1
                        ? "Робот-охранник"
                        : levelNum === 2
                        ? "Боевой робот"
                        : levelNum === 3
                        ? "Платформы"
                        : levelNum === 4
                        ? "Логические ворота"
                        : levelNum === 5
                        ? "Авария на станции"
                        : levelNum === 6
                        ? "Робот-доставщик"
                        : "Ремонт спутников"}
                    </div>
                    {isCompleted && (
                      <div className="absolute -right-2 -top-2 rounded-full bg-yellow-400 p-1">
                        <svg className="h-5 w-5 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50">
                        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setScreen("menu")}
              className="w-full rounded-lg bg-slate-600 py-3 font-bold text-white transition-colors hover:bg-slate-500"
            >
              Назад
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
