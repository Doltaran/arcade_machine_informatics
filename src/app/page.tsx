"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Position, SpawnParticle, GameState } from "@/game/types";
import {
  drawAstronaut,
  drawCombatRobot,
  drawSparks,
  drawCombatSparks,
  drawSpawnParticles,
  drawBackground,
  drawExit,
  drawTerminal,
  drawStartZone,
  drawLevel1Robot,
  drawGenerator,
  drawWires,
  drawWireAnimation,
  drawBarrier,
  drawBullets,
  drawSpawnBeam,
  drawMaterializeRing,
  drawLevelLabel,
} from "@/game/render";
import {
  updateGame,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ROBOT_WIDTH,
  ROBOT_HEIGHT,
  EXIT_WIDTH,
  EXIT_HEIGHT,
  GROUND_HEIGHT,
  BARRIER_MAX_TIME,
  BULLET_WIDTH,
  BULLET_HEIGHT,
  COMBAT_ROBOT_WIDTH,
  COMBAT_ROBOT_HEIGHT,
  type InputState,
  type WorldConfig,
} from "@/game/engine";

// ==================== LOCAL CONSTANTS ====================
const TERMINAL_WIDTH = 50;
const TERMINAL_HEIGHT = 60;
const INTERACTION_DISTANCE = 70;

// ==================== MAIN COMPONENT ====================
export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number>(0);

  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;

  // Level 1 positions
  const robotPos: Position = { x: 550, y: groundY - ROBOT_HEIGHT };
  const terminalPos: Position = { x: 430, y: groundY - TERMINAL_HEIGHT };
  const exitPos: Position = { x: CANVAS_WIDTH - EXIT_WIDTH - 30, y: groundY - EXIT_HEIGHT };

  // Level 2 positions
  const combatRobotPos: Position = { x: 500, y: groundY - COMBAT_ROBOT_HEIGHT }; // Робот левее
  const generatorPos: Position = { x: CANVAS_WIDTH - 180, y: groundY - 120 }; // Генератор справа
  const level2TerminalPos: Position = { x: 200, y: groundY - TERMINAL_HEIGHT };
  const level2ExitPos: Position = { x: CANVAS_WIDTH - EXIT_WIDTH - 30, y: groundY - EXIT_HEIGHT };
  const barrierX = 380; // Позиция барьера

  function initGameState(level: number = 1): GameState {
    const initialParticles: SpawnParticle[] = [];
    for (let i = 0; i < 20; i++) {
      initialParticles.push({
        x: 80 + PLAYER_WIDTH / 2 + (Math.random() - 0.5) * 60,
        y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 1,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? "#60a5fa" : "#34d399",
      });
    }

    const num1 = Math.floor(Math.random() * 27) + 5;
    let num2 = Math.floor(Math.random() * 27) + 5;
    while (num2 === num1) {
      num2 = Math.floor(Math.random() * 27) + 5;
    }

    return {
      currentLevel: level,
      playerPos: { x: 80, y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT },
      playerVelocityY: 0,
      isGrounded: true,
      isMoving: false,
      facingRight: true,
      animationTime: 0,
      robotDisabled: level === 2,
      robotColliderActive: level === 1,
      targetNumber: Math.floor(Math.random() * 27) + 5,
      showTerminal: false,
      terminalInput: "",
      terminalMessage: "",
      terminalMessageType: "",
      errorMessageTimer: 0,
      levelComplete: false,
      levelCompletePhase: "none",
      levelCompleteOpacity: 0,
      currentGoal: level === 1 ? "Отключить робота через терминал" : "Отключить боевого робота",
      taskPanelExpanded: true,
      robotAnimationPhase: "none",
      robotFlashCount: 0,
      robotFlashOn: false,
      robotCollapseOffset: 0,
      sparks: [],
      spawnPhase: "beam",
      spawnProgress: 0,
      spawnParticles: initialParticles,
      level2: {
        combatRobotDisabled: false,
        combatRobotAnimPhase: "none",
        combatRobotFlashCount: 0,
        combatRobotCollapseOffset: 0,
        barrierActive: level === 2,
        barrierAnimPhase: "none",
        barrierTimeLeft: BARRIER_MAX_TIME,
        bullets: [],
        shootTimer: 0,
        displayNumber1: num1,
        displayNumber2: num2,
        playerDead: false,
        deathReason: "",
        narratorMessage: level === 2 ? {
          text: "ВНИМАНИЕ! Боевой робот обнаружил угрозу! Я активировал защитный барьер, но он продержится недолго. Посмотри на дисплеи — числа и цвета проводов подскажут, что делать!",
          duration: 5000,
          timer: 5000,
        } : null,
        narratorShown: false,
        terminalTarget: null,
        sparks: [],
        wireAnimationActive: "none",
        wireAnimationProgress: 0,
        wireParticles: [],
      },
    };
  }

  const [gameState, setGameState] = useState<GameState>(() => initGameState());

  function binaryToDecimal(binary: string): number {
    if (!/^[01]+$/.test(binary) || binary.length === 0) return -1;
    return parseInt(binary, 2);
  }

  const isNearTerminal = useCallback(
    (x: number, y: number, level: number): boolean => {
      const playerCenter = { x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 };
      const tPos = level === 1 ? terminalPos : level2TerminalPos;
      const terminalCenter = {
        x: tPos.x + TERMINAL_WIDTH / 2,
        y: tPos.y + TERMINAL_HEIGHT / 2,
      };
      const distance = Math.sqrt(
        Math.pow(playerCenter.x - terminalCenter.x, 2) + Math.pow(playerCenter.y - terminalCenter.y, 2)
      );
      return distance < INTERACTION_DISTANCE;
    },
    [terminalPos, level2TerminalPos]
  );

  const handleTerminalSubmit = useCallback(() => {
    const input = gameState.terminalInput.trim();
    if (input.length === 0) return;

    const enteredValue = binaryToDecimal(input);

    if (gameState.currentLevel === 1) {
      if (enteredValue === gameState.targetNumber) {
        setGameState((prev) => ({
          ...prev,
          robotDisabled: true,
          showTerminal: false,
          terminalInput: "",
          terminalMessage: "",
          terminalMessageType: "",
          currentGoal: "Дойти до выхода",
          robotAnimationPhase: "flashing",
          robotFlashCount: 0,
          robotFlashOn: true,
        }));
      } else {
        setGameState((prev) => ({
          ...prev,
          terminalMessage: "Неверно, попробуй ещё раз",
          terminalMessageType: "error",
          errorMessageTimer: 1500,
        }));
      }
      } else {
        const target = gameState.level2.terminalTarget;
        if (!target) return;

        if (target === "robot") {
          if (enteredValue === gameState.level2.displayNumber1) {
            // Запускаем анимацию тока по красному проводу к роботу
            setGameState((prev) => ({
              ...prev,
              showTerminal: false,
              terminalInput: "",
              terminalMessage: "",
              terminalMessageType: "",
              level2: {
                ...prev.level2,
                terminalTarget: null,
                wireAnimationActive: "robot",
                wireAnimationProgress: 0,
                wireParticles: [],
              },
            }));
          } else if (enteredValue === gameState.level2.displayNumber2) {
            // Запускаем анимацию тока по синему проводу к барьеру (ошибка - барьер отключится)
            setGameState((prev) => ({
              ...prev,
              showTerminal: false,
              terminalInput: "",
              level2: {
                ...prev.level2,
                terminalTarget: null,
                wireAnimationActive: "barrier",
                wireAnimationProgress: 0,
                wireParticles: [],
              },
            }));
          } else {
            setGameState((prev) => ({
              ...prev,
              terminalMessage: "Неверный код! Проверь числа на дисплеях.",
              terminalMessageType: "error",
              errorMessageTimer: 1500,
            }));
          }
        } else if (target === "barrier") {
          if (enteredValue === gameState.level2.displayNumber2) {
            // Запускаем анимацию тока по синему проводу к барьеру
            setGameState((prev) => ({
              ...prev,
              showTerminal: false,
              terminalInput: "",
              terminalMessage: "",
              terminalMessageType: "",
              level2: {
                ...prev.level2,
                terminalTarget: null,
                wireAnimationActive: "barrier",
                wireAnimationProgress: 0,
                wireParticles: [],
              },
            }));
          } else if (enteredValue === gameState.level2.displayNumber1) {
            setGameState((prev) => ({
              ...prev,
              terminalMessage: "Это код робота, а не барьера!",
              terminalMessageType: "error",
              errorMessageTimer: 1500,
            }));
          } else {
            setGameState((prev) => ({
              ...prev,
              terminalMessage: "Неверный код! Проверь числа на дисплеях.",
              terminalMessageType: "error",
              errorMessageTimer: 1500,
            }));
          }
        }
      }
  }, [gameState.terminalInput, gameState.targetNumber, gameState.currentLevel, gameState.level2.terminalTarget, gameState.level2.displayNumber1, gameState.level2.displayNumber2]);

  // ==================== KEYBOARD HANDLING ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setGameState((prev) => ({
          ...prev,
          taskPanelExpanded: !prev.taskPanelExpanded,
        }));
        return;
      }

      if (gameState.showTerminal) {
        if (e.key === "Escape") {
          setGameState((prev) => ({
            ...prev,
            showTerminal: false,
            terminalInput: "",
            terminalMessage: "",
            terminalMessageType: "",
          }));
        } else if (e.key === "Enter") {
          handleTerminalSubmit();
        }
        return;
      }

      if (e.key === "e" || e.key === "E" || e.key === "у" || e.key === "У") {
        if (gameState.currentLevel === 1) {
          if (
            isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 1) &&
            !gameState.robotDisabled &&
            gameState.spawnPhase === "ready"
          ) {
            setGameState((prev) => ({
              ...prev,
              showTerminal: true,
              terminalMessage: "",
              terminalMessageType: "",
            }));
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        } else {
          if (
            isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 2) &&
            gameState.spawnPhase === "ready" &&
            !gameState.level2.playerDead
          ) {
            if (!gameState.level2.combatRobotDisabled) {
              setGameState((prev) => ({
                ...prev,
                showTerminal: true,
                terminalMessage: "",
                terminalMessageType: "",
                level2: {
                  ...prev.level2,
                  terminalTarget: "robot",
                },
              }));
            } else if (gameState.level2.barrierActive) {
              setGameState((prev) => ({
                ...prev,
                showTerminal: true,
                terminalMessage: "",
                terminalMessageType: "",
                level2: {
                  ...prev.level2,
                  terminalTarget: "barrier",
                },
              }));
            }
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
      }

      keysPressed.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    gameState.showTerminal,
    gameState.playerPos,
    gameState.robotDisabled,
    gameState.spawnPhase,
    gameState.currentLevel,
    gameState.level2.combatRobotDisabled,
    gameState.level2.barrierActive,
    gameState.level2.playerDead,
    isNearTerminal,
    handleTerminalSubmit,
  ]);

  // ==================== WORLD CONFIG ====================
  const worldConfig: WorldConfig = {
    robotPos,
    exitPos,
    combatRobotPos,
    level2ExitPos,
    barrierX,
    groundY,
  };

  // ==================== GAME LOOP ====================
  useEffect(() => {
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 50);
      lastTime = currentTime;

      // Build input state from keysPressed
      const input: InputState = {
        left: keysPressed.current.has("a") || keysPressed.current.has("arrowleft") || keysPressed.current.has("ф"),
        right: keysPressed.current.has("d") || keysPressed.current.has("arrowright") || keysPressed.current.has("в"),
        jump: keysPressed.current.has(" "),
      };

      setGameState((prev) => updateGame(prev, input, deltaTime, worldConfig));

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [worldConfig]);

  // ==================== RENDERING ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Фон
    drawBackground(ctx, CANVAS_WIDTH, groundY, GROUND_HEIGHT, gameState.currentLevel);

    if (gameState.currentLevel === 1) {
      // ==================== LEVEL 1 RENDERING ====================
      
      // Exit
      drawExit(ctx, exitPos, EXIT_WIDTH, EXIT_HEIGHT, !gameState.robotColliderActive);

      // Terminal
      const showTerminalHint = isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 1) &&
        !gameState.robotDisabled &&
        gameState.spawnPhase === "ready";
      drawTerminal(ctx, terminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminalHint);

      // Robot
      drawLevel1Robot(
        ctx,
        robotPos,
        ROBOT_WIDTH,
        ROBOT_HEIGHT,
        gameState.robotDisabled,
        gameState.robotAnimationPhase,
        gameState.robotFlashOn,
        gameState.robotCollapseOffset,
        gameState.targetNumber
      );

      // Sparks
      drawSparks(ctx, gameState.sparks);

      // Start zone
      drawStartZone(ctx, groundY);

    } else {
      // ==================== LEVEL 2 RENDERING ====================

      const genHeight = 120;
      
      // Генератор
      drawGenerator(
        ctx,
        generatorPos,
        gameState.level2.combatRobotDisabled,
        gameState.level2.barrierActive,
        gameState.level2.displayNumber1,
        gameState.level2.displayNumber2
      );
      
      // Провода
      const redWirePoints: Position[] = [
        { x: generatorPos.x + 37, y: generatorPos.y + genHeight },
        { x: generatorPos.x + 37, y: groundY - 20 },
        { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: groundY - 20 },
        { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: combatRobotPos.y + COMBAT_ROBOT_HEIGHT },
      ];
      
      const blueWirePoints: Position[] = [
        { x: generatorPos.x + 102, y: generatorPos.y + genHeight },
        { x: generatorPos.x + 102, y: groundY - 40 },
        { x: barrierX + 10, y: groundY - 40 },
        { x: barrierX + 10, y: groundY },
      ];

      drawWires(ctx, redWirePoints, blueWirePoints, gameState.level2.combatRobotDisabled, gameState.level2.barrierActive);

      // Анимация тока по проводам
      if (gameState.level2.wireAnimationActive !== "none") {
        const wirePoints = gameState.level2.wireAnimationActive === "robot" ? redWirePoints : blueWirePoints;
        const wireColor = gameState.level2.wireAnimationActive === "robot" ? "#fef08a" : "#93c5fd";
        drawWireAnimation(ctx, wirePoints, wireColor, gameState.level2.wireAnimationProgress);
      }

      // Терминал Level 2
      const showTerminal2Hint = isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 2) &&
        gameState.spawnPhase === "ready" &&
        !gameState.level2.playerDead &&
        (!gameState.level2.combatRobotDisabled || gameState.level2.barrierActive) &&
        gameState.level2.wireAnimationActive === "none";
      drawTerminal(ctx, level2TerminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminal2Hint);

      // Барьер
      if (gameState.level2.barrierActive) {
        drawBarrier(ctx, barrierX, groundY, gameState.level2.barrierTimeLeft, BARRIER_MAX_TIME, gameState.level2.combatRobotDisabled);
      }

      // Пули
      drawBullets(ctx, gameState.level2.bullets, BULLET_WIDTH, BULLET_HEIGHT);

      // Боевой робот
      drawCombatRobot(
        ctx,
        combatRobotPos.x,
        combatRobotPos.y,
        gameState.level2.combatRobotDisabled,
        gameState.level2.combatRobotAnimPhase,
        gameState.level2.combatRobotFlashCount,
        gameState.level2.combatRobotCollapseOffset,
        COMBAT_ROBOT_WIDTH,
        COMBAT_ROBOT_HEIGHT
      );

      // Искры боевого робота
      drawCombatSparks(ctx, gameState.level2.sparks);

      // Exit Level 2
      const exitActive = gameState.level2.combatRobotDisabled && !gameState.level2.barrierActive;
      drawExit(ctx, level2ExitPos, EXIT_WIDTH, EXIT_HEIGHT, exitActive);

      // Стартовая зона
      drawStartZone(ctx, groundY);
    }

    // ==================== SPAWN ANIMATION ====================
    const playerCenterX = gameState.playerPos.x + PLAYER_WIDTH / 2;
    const playerCenterY = gameState.playerPos.y + PLAYER_HEIGHT / 2;

    if (gameState.spawnPhase === "beam") {
      drawSpawnBeam(ctx, playerCenterX, groundY, gameState.spawnProgress);
      drawSpawnParticles(ctx, gameState.spawnParticles);

      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
      drawAstronaut(ctx, gameState.playerPos.x, gameState.playerPos.y, gameState.facingRight, false, true, 0, "ready", 1, PLAYER_WIDTH, PLAYER_HEIGHT);
      ctx.globalAlpha = 1;
    } else if (gameState.spawnPhase === "materialize") {
      const materializedHeight = PLAYER_HEIGHT * gameState.spawnProgress;

      ctx.save();
      ctx.beginPath();
      ctx.rect(gameState.playerPos.x - 20, gameState.playerPos.y + PLAYER_HEIGHT - materializedHeight, PLAYER_WIDTH + 40, materializedHeight + 20);
      ctx.clip();

      drawAstronaut(ctx, gameState.playerPos.x, gameState.playerPos.y, gameState.facingRight, false, true, 0, "materialize", gameState.spawnProgress, PLAYER_WIDTH, PLAYER_HEIGHT);
      ctx.restore();

      drawMaterializeRing(ctx, playerCenterX, playerCenterY, gameState.spawnProgress);
    } else if (!gameState.level2.playerDead) {
      drawAstronaut(
        ctx,
        gameState.playerPos.x,
        gameState.playerPos.y,
        gameState.facingRight,
        gameState.isMoving,
        gameState.isGrounded,
        gameState.animationTime,
        gameState.spawnPhase,
        gameState.spawnProgress,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      );
    }

    // Номер уровня
    drawLevelLabel(ctx, gameState.currentLevel);

  }, [gameState, isNearTerminal, robotPos, terminalPos, exitPos, level2ExitPos, combatRobotPos, level2TerminalPos, groundY, barrierX, generatorPos]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = e.target.value.replace(/[^01]/g, "");
    setGameState((prev) => ({ ...prev, terminalInput: filtered }));
  };

  const handleRestart = () => {
    setGameState(initGameState(gameState.currentLevel));
    keysPressed.current.clear();
  };

  const handleNextLevel = () => {
    setGameState(initGameState(2));
    keysPressed.current.clear();
  };

  // Получаем текущее число для терминала
  const getTerminalNumber = () => {
    if (gameState.currentLevel === 1) {
      return gameState.targetNumber;
    }
    if (gameState.level2.terminalTarget === "robot") {
      return gameState.level2.displayNumber1;
    }
    return gameState.level2.displayNumber2;
  };

  const getTerminalLabel = () => {
    if (gameState.currentLevel === 1) {
      return "";
    }
    if (gameState.level2.terminalTarget === "robot") {
      return "(красный провод - РОБОТ)";
    }
    return "(синий провод - БАРЬЕР)";
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-lg border-4 border-slate-700 shadow-2xl"
      />

      {/* Панель задания */}
      <div className="absolute top-4 right-4 z-10">
        {gameState.taskPanelExpanded ? (
          <div className="w-80 rounded-lg bg-slate-800 p-4 text-white shadow-xl border border-slate-600">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-yellow-400">
                {gameState.currentLevel === 1 ? "Задание" : "ВНИМАНИЕ: Боевая зона!"}
              </h3>
              <span className="text-xs text-slate-400">[Tab] свернуть</span>
            </div>
            {gameState.currentLevel === 1 ? (
              <>
                <p className="mb-3 text-sm">
                  Перед роботом число{" "}
                  <span className="font-bold text-yellow-400">{gameState.targetNumber}</span>.
                  Переведи его в двоичную систему и введи в терминал.
                </p>
                <div className="rounded bg-slate-700 p-2 text-xs">
                  <p className="text-slate-300">Напоминание:</p>
                  <p className="font-mono text-green-400">13₍₁₀₎ = 1101₍₂₎</p>
                </div>
              </>
              ) : (
                <>
                  <p className="mb-3 text-sm text-red-300">
                    Боевой робот атакует! Барьер защищает тебя, но ненадолго.
                  </p>
                  <p className="mb-3 text-sm">
                    Справа генератор с двумя числами. Введи число в терминал — ток пойдёт по проводу и отключит цель.
                  </p>
                  <div className="rounded bg-slate-700 p-2 text-xs mb-2">
                    <p className="text-red-400">
                      <span className="font-bold">{gameState.level2.combatRobotDisabled ? "---" : gameState.level2.displayNumber1}</span> — красный → РОБОТ
                    </p>
                    <p className="text-blue-400">
                      <span className="font-bold">{!gameState.level2.barrierActive ? "---" : gameState.level2.displayNumber2}</span> — синий → БАРЬЕР
                    </p>
                  </div>
                  <p className="text-xs text-yellow-300">
                    Подсказка: сначала отключи угрозу, потом — защиту!
                  </p>
                </>
              )}
            <div className="mt-3 text-xs text-slate-400">
              <p>A/D или ←/→ — движение</p>
              <p>Space — прыжок</p>
              <p>E — взаимодействие</p>
            </div>
          </div>
        ) : (
          <div className="cursor-pointer rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600">
            Задание [Tab]
          </div>
        )}
      </div>

      {/* Сообщение диктора */}
      {gameState.level2.narratorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-xl">
          <div className="rounded-lg bg-slate-900 border-2 border-cyan-500 p-4 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🎙</span>
              </div>
              <div>
                <p className="text-sm text-cyan-400 font-bold mb-1">ДИКТОР</p>
                <p className="text-sm">{gameState.level2.narratorMessage.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Текущая цель */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-600 bg-slate-800 px-6 py-2 text-white">
        <span className="text-slate-400">Цель:</span>{" "}
        <span className="font-medium text-yellow-400">{gameState.currentGoal}</span>
      </div>

      {/* УРОВЕНЬ ПРОЙДЕН */}
      {gameState.levelComplete &&
        gameState.levelCompletePhase !== "none" &&
        gameState.levelCompletePhase !== "showButton" &&
        gameState.levelCompletePhase !== "transition" && (
          <div
            className="absolute left-1/2 top-16 -translate-x-1/2 text-5xl font-bold text-green-400 drop-shadow-lg"
            style={{ opacity: gameState.levelCompleteOpacity }}
          >
            УРОВЕНЬ {gameState.currentLevel} ПРОЙДЕН!
          </div>
        )}

      {/* Переход на следующий уровень (Level 1 -> Level 2) */}
      {gameState.levelCompletePhase === "transition" && gameState.currentLevel === 1 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border-2 border-green-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-400 mb-4">Уровень 1 пройден!</h2>
            <p className="mb-6 text-slate-300">
              Ты успешно перевёл {gameState.targetNumber}₍₁₀₎ в двоичную систему!
            </p>
            <button
              onClick={handleNextLevel}
              className="rounded-lg bg-green-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-green-500"
            >
              Перейти на уровень 2
            </button>
          </div>
        </div>
      )}

      {/* Кнопка перезапуска (Level 2 complete) */}
      {gameState.levelCompletePhase === "showButton" && gameState.currentLevel === 2 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border-2 border-green-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-400 mb-4">Поздравляем!</h2>
            <p className="mb-6 text-slate-300">
              Ты успешно прошёл оба уровня и освоил двоичную систему счисления!
            </p>
            <button
              onClick={() => setGameState(initGameState(1))}
              className="rounded-lg bg-green-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-green-500"
            >
              Играть снова
            </button>
          </div>
        </div>
      )}

      {/* Смерть игрока */}
      {gameState.level2.playerDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="rounded-2xl border-2 border-red-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-red-500 mb-4">ПРОВАЛ</h2>
            <p className="mb-6 text-slate-300">{gameState.level2.deathReason}</p>
            <button
              onClick={handleRestart}
              className="rounded-lg bg-red-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-red-500"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}

      {/* Терминал */}
      {gameState.showTerminal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="relative w-96 rounded-xl border-2 border-blue-500 bg-slate-800 p-6 shadow-2xl">
            <button
              onClick={() =>
                setGameState((prev) => ({
                  ...prev,
                  showTerminal: false,
                  terminalInput: "",
                  terminalMessage: "",
                  terminalMessageType: "",
                }))
              }
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="mb-4 text-xl font-bold text-blue-400">
              Терминал {getTerminalLabel()}
            </h2>
            <p className="mb-2 text-slate-300">
              Введите число{" "}
              <span className="font-bold text-yellow-400">{getTerminalNumber()}</span>{" "}
              в двоичной системе:
            </p>

            <div className="mb-4 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={gameState.terminalInput}
                onChange={handleInputChange}
                placeholder="например: 1101"
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-4 py-3 font-mono text-lg text-white focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleTerminalSubmit}
                className="rounded bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500"
              >
                Ввести
              </button>
            </div>

            {gameState.terminalMessage && gameState.terminalMessageType === "error" && (
              <p className="mb-2 font-medium text-red-400">{gameState.terminalMessage}</p>
            )}

            <p className="text-xs text-slate-500">
              Допустимы только символы 0 и 1. Enter для отправки, Esc или ✕ для выхода.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
