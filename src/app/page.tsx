"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ==================== GAME CONSTANTS ====================
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
const PLAYER_WIDTH = 36;
const PLAYER_HEIGHT = 52;
const PLAYER_SPEED = 1;
const JUMP_FORCE = 8;
const GRAVITY = 0.6;
const ROBOT_WIDTH = 60;
const ROBOT_HEIGHT = 80;
const TERMINAL_WIDTH = 50;
const TERMINAL_HEIGHT = 60;
const EXIT_WIDTH = 60;
const EXIT_HEIGHT = 90;
const GROUND_HEIGHT = 80;
const INTERACTION_DISTANCE = 70;

// Level 2 constants
const BARRIER_MAX_TIME = 15000; // 15 seconds barrier duration
const BULLET_SPEED = 4;
const BULLET_WIDTH = 20;
const BULLET_HEIGHT = 8;
const COMBAT_ROBOT_WIDTH = 80;
const COMBAT_ROBOT_HEIGHT = 100;
const SHOOT_INTERVAL = 1200; // ms between shots

// ==================== GAME STATE TYPES ====================
interface Position {
  x: number;
  y: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface SpawnParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
}

interface NarratorMessage {
  text: string;
  duration: number;
  timer: number;
}

// Электрическая частица для анимации провода
interface WireParticle {
  x: number;
  y: number;
  progress: number; // 0-1 прогресс по проводу
  color: string;
}

interface GameState {
  currentLevel: number;
  playerPos: Position;
  playerVelocityY: number;
  isGrounded: boolean;
  isMoving: boolean;
  facingRight: boolean;
  animationTime: number;
  robotDisabled: boolean;
  robotColliderActive: boolean;
  targetNumber: number;
  showTerminal: boolean;
  terminalInput: string;
  terminalMessage: string;
  terminalMessageType: "error" | "success" | "";
  errorMessageTimer: number;
  levelComplete: boolean;
  levelCompletePhase: "none" | "fadeIn" | "hold" | "fadeOut" | "showButton" | "transition";
  levelCompleteOpacity: number;
  currentGoal: string;
  taskPanelExpanded: boolean;
  robotAnimationPhase: "none" | "flashing" | "sparks" | "collapse" | "done";
  robotFlashCount: number;
  robotFlashOn: boolean;
  robotCollapseOffset: number;
  sparks: Spark[];
  spawnPhase: "beam" | "materialize" | "ready";
  spawnProgress: number;
  spawnParticles: SpawnParticle[];
  level2: {
    combatRobotDisabled: boolean;
    combatRobotAnimPhase: "none" | "flashing" | "sparks" | "collapse" | "done";
    combatRobotFlashCount: number;
    combatRobotCollapseOffset: number;
    barrierActive: boolean;
    barrierAnimPhase: "none" | "disabling" | "done";
    barrierTimeLeft: number;
    bullets: Bullet[];
    shootTimer: number;
    displayNumber1: number;
    displayNumber2: number;
    playerDead: boolean;
    deathReason: string;
    narratorMessage: NarratorMessage | null;
    narratorShown: boolean;
    terminalTarget: "robot" | "barrier" | null;
    sparks: Spark[];
    // Анимация тока по проводам
    wireAnimationActive: "none" | "robot" | "barrier";
    wireAnimationProgress: number;
    wireParticles: WireParticle[];
  };
}

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

  // ==================== GAME LOOP ====================
  useEffect(() => {
    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 50);
      lastTime = currentTime;

      setGameState((prev) => {
        if (prev.showTerminal) {
          return prev;
        }

        let newState = { ...prev, level2: { ...prev.level2 } };

        // ==================== SPAWN ANIMATION ====================
        if (newState.spawnPhase === "beam") {
          newState.spawnProgress += deltaTime / 800;
          newState.spawnParticles = newState.spawnParticles
            .map((p) => ({
              ...p,
              x: p.x + p.vx * 0.5,
              y: p.y + p.vy * 0.5 - 1,
              life: p.life - deltaTime / 1000,
            }))
            .filter((p) => p.life > 0);

          if (newState.spawnProgress >= 1) {
            newState.spawnPhase = "materialize";
            newState.spawnProgress = 0;
          }
        } else if (newState.spawnPhase === "materialize") {
          newState.spawnProgress += deltaTime / 600;
          if (newState.spawnProgress >= 1) {
            newState.spawnPhase = "ready";
            newState.spawnProgress = 1;
          }
        }

        // ==================== ERROR MESSAGE TIMER ====================
        if (newState.errorMessageTimer > 0) {
          newState.errorMessageTimer -= deltaTime;
          if (newState.errorMessageTimer <= 0) {
            newState.terminalMessage = "";
            newState.terminalMessageType = "";
          }
        }

        // ==================== NARRATOR MESSAGE TIMER (Level 2) ====================
        if (newState.level2.narratorMessage) {
          newState.level2.narratorMessage = {
            ...newState.level2.narratorMessage,
            timer: newState.level2.narratorMessage.timer - deltaTime,
          };
          if (newState.level2.narratorMessage.timer <= 0) {
            newState.level2.narratorMessage = null;
          }
        }

        // ==================== LEVEL 1 ROBOT ANIMATION ====================
        if (newState.currentLevel === 1) {
          if (newState.robotAnimationPhase === "flashing") {
            const flashInterval = 100;
            const totalFlashes = 6;
            newState.robotFlashCount += deltaTime / flashInterval;
            newState.robotFlashOn = Math.floor(newState.robotFlashCount) % 2 === 0;
            if (newState.robotFlashCount >= totalFlashes) {
              newState.robotAnimationPhase = "sparks";
              newState.robotFlashOn = false;
              const newSparks: Spark[] = [];
              for (let i = 0; i < 12; i++) {
                newSparks.push({
                  x: robotPos.x + ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 40,
                  y: robotPos.y + 20 + Math.random() * 30,
                  vx: (Math.random() - 0.5) * 8,
                  vy: -Math.random() * 6 - 2,
                  life: 1,
                });
              }
              newState.sparks = newSparks;
            }
          } else if (newState.robotAnimationPhase === "sparks") {
            const updatedSparks = newState.sparks
              .map((s) => ({
                ...s,
                x: s.x + s.vx,
                y: s.y + s.vy,
                vy: s.vy + 0.3,
                life: s.life - deltaTime / 500,
              }))
              .filter((s) => s.life > 0);
            newState.sparks = updatedSparks;
            if (updatedSparks.length === 0) {
              newState.robotAnimationPhase = "collapse";
            }
          } else if (newState.robotAnimationPhase === "collapse") {
            newState.robotCollapseOffset += deltaTime * 0.05;
            if (newState.robotCollapseOffset >= 15) {
              newState.robotCollapseOffset = 15;
              newState.robotAnimationPhase = "done";
              newState.robotColliderActive = false;
            }
          }
        }

          // ==================== LEVEL 2 COMBAT ROBOT ANIMATION ====================
          if (newState.currentLevel === 2) {
            // ==================== WIRE ANIMATION ====================
            if (newState.level2.wireAnimationActive !== "none") {
              newState.level2.wireAnimationProgress += deltaTime / 1000; // 1 секунда на анимацию
              
              // Добавляем частицы тока
              if (Math.random() < 0.3) {
                const color = newState.level2.wireAnimationActive === "robot" ? "#ef4444" : "#3b82f6";
                newState.level2.wireParticles = [
                  ...newState.level2.wireParticles,
                  {
                    x: 0,
                    y: 0,
                    progress: newState.level2.wireAnimationProgress - Math.random() * 0.1,
                    color,
                  },
                ];
              }
              
              // Убираем старые частицы
              newState.level2.wireParticles = newState.level2.wireParticles.filter(
                (p) => p.progress < newState.level2.wireAnimationProgress + 0.1
              );
              
              // Когда анимация завершена
              if (newState.level2.wireAnimationProgress >= 1) {
                if (newState.level2.wireAnimationActive === "robot") {
                  // Отключаем робота
                  newState.level2.combatRobotDisabled = true;
                  newState.level2.combatRobotAnimPhase = "flashing";
                  newState.level2.combatRobotFlashCount = 0;
                  newState.currentGoal = "Теперь отключи барьер (синий провод)";
                  newState.level2.narratorMessage = {
                    text: "Отлично! Робот отключён. Теперь отключи барьер, пока он не исчез!",
                    duration: 3000,
                    timer: 3000,
                  };
                } else {
                  // Отключаем барьер
                  newState.level2.barrierActive = false;
                  newState.level2.barrierAnimPhase = "disabling";
                  if (newState.level2.combatRobotDisabled) {
                    newState.currentGoal = "Дойди до выхода!";
                    newState.level2.narratorMessage = {
                      text: "Барьер деактивирован. Путь свободен!",
                      duration: 2500,
                      timer: 2500,
                    };
                  }
                  // Если робот ещё активен - пули начнут попадать в игрока
                }
                newState.level2.wireAnimationActive = "none";
                newState.level2.wireAnimationProgress = 0;
                newState.level2.wireParticles = [];
              }
            }

            if (newState.level2.combatRobotAnimPhase === "flashing") {
              const flashInterval = 100;
              const totalFlashes = 6;
              newState.level2.combatRobotFlashCount += deltaTime / flashInterval;
              if (newState.level2.combatRobotFlashCount >= totalFlashes) {
                newState.level2.combatRobotAnimPhase = "sparks";
                const newSparks: Spark[] = [];
                for (let i = 0; i < 15; i++) {
                  newSparks.push({
                    x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 50,
                    y: combatRobotPos.y + 30 + Math.random() * 40,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -Math.random() * 8 - 2,
                    life: 1,
                  });
                }
                newState.level2.sparks = newSparks;
              }
            } else if (newState.level2.combatRobotAnimPhase === "sparks") {
              const updatedSparks = newState.level2.sparks
                .map((s) => ({
                  ...s,
                  x: s.x + s.vx,
                  y: s.y + s.vy,
                  vy: s.vy + 0.3,
                  life: s.life - deltaTime / 500,
                }))
                .filter((s) => s.life > 0);
              newState.level2.sparks = updatedSparks;
              if (updatedSparks.length === 0) {
                newState.level2.combatRobotAnimPhase = "collapse";
              }
            } else if (newState.level2.combatRobotAnimPhase === "collapse") {
              newState.level2.combatRobotCollapseOffset += deltaTime * 0.04;
              if (newState.level2.combatRobotCollapseOffset >= 25) {
                newState.level2.combatRobotCollapseOffset = 25;
                newState.level2.combatRobotAnimPhase = "done";
              }
            }

            // ==================== LEVEL 2 SHOOTING & BARRIER ====================
            if (!newState.level2.combatRobotDisabled && newState.spawnPhase === "ready" && !newState.level2.playerDead) {
              // Робот стреляет
              newState.level2.shootTimer += deltaTime;
              if (newState.level2.shootTimer >= SHOOT_INTERVAL) {
                newState.level2.shootTimer = 0;
                newState.level2.bullets = [
                  ...newState.level2.bullets,
                  {
                    x: combatRobotPos.x - BULLET_WIDTH,
                    y: combatRobotPos.y + COMBAT_ROBOT_HEIGHT / 2 - BULLET_HEIGHT / 2,
                    vx: -BULLET_SPEED,
                  },
                ];
              }
            }

            // Обновляем пули (всегда, даже если робот отключён - для пуль в воздухе)
            newState.level2.bullets = newState.level2.bullets
              .map((b) => ({ ...b, x: b.x + b.vx }))
              .filter((b) => b.x > -BULLET_WIDTH);

            // Проверяем столкновение пуль с барьером или игроком
            if (newState.level2.barrierActive) {
              // Пули останавливаются на барьере
              newState.level2.bullets = newState.level2.bullets.filter((b) => b.x > barrierX);
            } else if (!newState.level2.playerDead) {
              // Проверяем попадание в игрока
              const playerRect = {
                left: newState.playerPos.x,
                right: newState.playerPos.x + PLAYER_WIDTH,
                top: newState.playerPos.y,
                bottom: newState.playerPos.y + PLAYER_HEIGHT,
              };
              for (const bullet of newState.level2.bullets) {
                if (
                  bullet.x < playerRect.right &&
                  bullet.x + BULLET_WIDTH > playerRect.left &&
                  bullet.y < playerRect.bottom &&
                  bullet.y + BULLET_HEIGHT > playerRect.top
                ) {
                  newState.level2.playerDead = true;
                  newState.level2.deathReason = "Ты был поражён пулей боевого робота!";
                  break;
                }
              }
            }

            // Уменьшаем время барьера (только если робот ещё активен)
            if (newState.level2.barrierActive && !newState.level2.combatRobotDisabled) {
              newState.level2.barrierTimeLeft -= deltaTime;
              if (newState.level2.barrierTimeLeft <= 0) {
                newState.level2.barrierActive = false;
                newState.level2.barrierTimeLeft = 0;
              }
            }
          }

        // ==================== LEVEL COMPLETE ANIMATION ====================
        if (newState.levelCompletePhase === "fadeIn") {
          newState.levelCompleteOpacity += deltaTime / 250;
          if (newState.levelCompleteOpacity >= 1) {
            newState.levelCompleteOpacity = 1;
            newState.levelCompletePhase = "hold";
          }
        } else if (newState.levelCompletePhase === "hold") {
          newState.robotFlashCount += deltaTime;
          if (newState.robotFlashCount >= 1200) {
            newState.levelCompletePhase = "fadeOut";
            newState.robotFlashCount = 0;
          }
        } else if (newState.levelCompletePhase === "fadeOut") {
          newState.levelCompleteOpacity -= deltaTime / 500;
          if (newState.levelCompleteOpacity <= 0) {
            newState.levelCompleteOpacity = 0;
            if (newState.currentLevel === 1) {
              newState.levelCompletePhase = "transition";
            } else {
              newState.levelCompletePhase = "showButton";
            }
          }
        }

        if (newState.levelComplete || newState.level2.playerDead) {
          return newState;
        }

        if (newState.spawnPhase !== "ready") {
          return newState;
        }

        // ==================== PLAYER PHYSICS ====================
        let newX = newState.playerPos.x;
        let newY = newState.playerPos.y;
        let newVelY = newState.playerVelocityY;
        let grounded = newState.isGrounded;
        let moving = false;
        let facingRight = newState.facingRight;

        newState.animationTime += deltaTime;

        if (
          keysPressed.current.has("a") ||
          keysPressed.current.has("arrowleft") ||
          keysPressed.current.has("ф")
        ) {
          newX -= PLAYER_SPEED;
          moving = true;
          facingRight = false;
        }
        if (
          keysPressed.current.has("d") ||
          keysPressed.current.has("arrowright") ||
          keysPressed.current.has("в")
        ) {
          newX += PLAYER_SPEED;
          moving = true;
          facingRight = true;
        }

        if (keysPressed.current.has(" ") && grounded) {
          newVelY = -JUMP_FORCE;
          grounded = false;
        }

        newVelY += GRAVITY;
        newY += newVelY;

        if (newY + PLAYER_HEIGHT >= groundY) {
          newY = groundY - PLAYER_HEIGHT;
          newVelY = 0;
          grounded = true;
        }

        if (newX < 0) newX = 0;
        if (newX + PLAYER_WIDTH > CANVAS_WIDTH) newX = CANVAS_WIDTH - PLAYER_WIDTH;

          // ==================== LEVEL 1 ROBOT COLLIDER ====================
          if (newState.currentLevel === 1 && newState.robotColliderActive) {
            const playerRect = {
              left: newX,
              right: newX + PLAYER_WIDTH,
              top: newY,
              bottom: newY + PLAYER_HEIGHT,
            };
            const robotRect = {
              left: robotPos.x,
              right: robotPos.x + ROBOT_WIDTH,
              top: robotPos.y,
              bottom: robotPos.y + ROBOT_HEIGHT,
            };

            if (
              playerRect.left < robotRect.right &&
              playerRect.right > robotRect.left &&
              playerRect.top < robotRect.bottom &&
              playerRect.bottom > robotRect.top
            ) {
              if (newState.playerPos.x < robotPos.x) {
                newX = robotRect.left - PLAYER_WIDTH;
              } else {
                newX = robotRect.right;
              }
            }
          }

          // ==================== LEVEL 2 BARRIER COLLIDER ====================
          if (newState.currentLevel === 2 && newState.level2.barrierActive) {
            // Игрок не может пройти через барьер
            if (newX + PLAYER_WIDTH > barrierX - 10 && newState.playerPos.x + PLAYER_WIDTH <= barrierX - 10) {
              newX = barrierX - 10 - PLAYER_WIDTH;
            }
            if (newX < barrierX + 30 && newState.playerPos.x >= barrierX + 30) {
              newX = barrierX + 30;
            }
          }

          // ==================== CHECK EXIT ====================
        const currentExitPos = newState.currentLevel === 1 ? exitPos : level2ExitPos;
        const canExit = newState.currentLevel === 1
          ? !newState.robotColliderActive
          : newState.level2.combatRobotDisabled && !newState.level2.barrierActive;

        if (canExit) {
          const playerCenter = { x: newX + PLAYER_WIDTH / 2, y: newY + PLAYER_HEIGHT / 2 };
          if (
            playerCenter.x > currentExitPos.x &&
            playerCenter.x < currentExitPos.x + EXIT_WIDTH &&
            playerCenter.y > currentExitPos.y &&
            playerCenter.y < currentExitPos.y + EXIT_HEIGHT
          ) {
            newState.levelComplete = true;
            newState.levelCompletePhase = "fadeIn";
            newState.levelCompleteOpacity = 0;
            newState.robotFlashCount = 0;
          }
        }

        newState.playerPos = { x: newX, y: newY };
        newState.playerVelocityY = newVelY;
        newState.isGrounded = grounded;
        newState.isMoving = moving;
        newState.facingRight = facingRight;

        return newState;
      });

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [robotPos, exitPos, combatRobotPos, level2ExitPos, groundY, barrierX, generatorPos]);

  // ==================== DRAW ASTRONAUT ====================
  const drawAstronaut = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    facingRight: boolean,
    isMoving: boolean,
    isGrounded: boolean,
    animTime: number,
    spawnPhase: string,
    spawnProgress: number
  ) => {
    const dir = facingRight ? 1 : -1;
    const centerX = x + PLAYER_WIDTH / 2;

    const walkCycle = isMoving && isGrounded ? Math.sin(animTime * 0.015) : 0;
    const armSwing = walkCycle * 25;
    const legSwing = walkCycle * 20;

    let alpha = 1;
    if (spawnPhase === "materialize") {
      alpha = spawnProgress;
    } else if (spawnPhase === "beam") {
      alpha = 0;
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Ноги
    ctx.save();
    ctx.translate(centerX - 6, y + 38);
    ctx.rotate(((-legSwing) * Math.PI) / 180);
    ctx.fillStyle = "#1e40af";
    ctx.fillRect(-4, 0, 8, 10);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(-4, 10, 8, 8);
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.roundRect(-5, 18, 10, 6, 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX + 6, y + 38);
    ctx.rotate((legSwing * Math.PI) / 180);
    ctx.fillStyle = "#1e40af";
    ctx.fillRect(-4, 0, 8, 10);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(-4, 10, 8, 8);
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.roundRect(-5, 18, 10, 6, 2);
    ctx.fill();
    ctx.restore();

    // Тело
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.roundRect(centerX - 10, y + 18, 20, 22, 4);
    ctx.fill();

    ctx.fillStyle = "#e5e5e5";
    ctx.fillRect(centerX - 6, y + 22, 12, 14);

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(centerX - 2, y + 26, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(centerX + 3, y + 26, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6b7280";
    ctx.fillRect(centerX - 10, y + 36, 20, 4);

    // Руки
    ctx.save();
    ctx.translate(centerX - 12, y + 22);
    ctx.rotate((armSwing * Math.PI) / 180);
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#d4d4d4";
    ctx.beginPath();
    ctx.roundRect(-3, 12, 6, 6, 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(centerX + 12, y + 22);
    ctx.rotate(((-armSwing) * Math.PI) / 180);
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#d4d4d4";
    ctx.beginPath();
    ctx.roundRect(-3, 12, 6, 6, 2);
    ctx.fill();
    ctx.restore();

    // Шлем
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.arc(centerX, y + 12, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e3a8a";
    ctx.beginPath();
    ctx.arc(centerX + dir * 2, y + 12, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(147, 197, 253, 0.5)";
    ctx.beginPath();
    ctx.arc(centerX + dir * 5, y + 9, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(centerX + dir * 3, y + 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 8, y + 4);
    ctx.lineTo(centerX - 10, y - 4);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(centerX - 10, y - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d4d4d4";
    ctx.beginPath();
    ctx.roundRect(centerX - dir * 14, y + 20, 6, 16, 2);
    ctx.fill();

    ctx.restore();
  };

  // ==================== DRAW COMBAT ROBOT (Level 2) ====================
  const drawCombatRobot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    disabled: boolean,
    animPhase: string,
    flashCount: number,
    collapseOffset: number
  ) => {
    const robotY = y + collapseOffset;
    let bodyColor = "#dc2626";
    
    if (animPhase === "flashing") {
      bodyColor = Math.floor(flashCount) % 2 === 0 ? "#fef08a" : "#dc2626";
    } else if (disabled && animPhase !== "flashing") {
      bodyColor = "#4b5563";
    }

    // Тело
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x, robotY, COMBAT_ROBOT_WIDTH, COMBAT_ROBOT_HEIGHT - collapseOffset, 8);
    ctx.fill();

    // Голова
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x + 15, robotY - 25, COMBAT_ROBOT_WIDTH - 30, 30, 5);
    ctx.fill();

    // Глаза (красные лазеры когда активен)
    const eyeColor = disabled ? "#374151" : "#ff0000";
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(x + 25, robotY - 10, 8, 0, Math.PI * 2);
    ctx.arc(x + COMBAT_ROBOT_WIDTH - 25, robotY - 10, 8, 0, Math.PI * 2);
    ctx.fill();

    if (!disabled) {
      // Свечение глаз
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ff6666";
      ctx.beginPath();
      ctx.arc(x + 25, robotY - 10, 4, 0, Math.PI * 2);
      ctx.arc(x + COMBAT_ROBOT_WIDTH - 25, robotY - 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Пушка
    ctx.fillStyle = disabled ? "#374151" : "#991b1b";
    ctx.fillRect(x - 30, robotY + 30, 35, 15);
    ctx.beginPath();
    ctx.arc(x - 30, robotY + 37, 7, 0, Math.PI * 2);
    ctx.fill();

    // Ноги/гусеницы
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(x + 5, robotY + COMBAT_ROBOT_HEIGHT - collapseOffset - 15, 25, 15);
    ctx.fillRect(x + COMBAT_ROBOT_WIDTH - 30, robotY + COMBAT_ROBOT_HEIGHT - collapseOffset - 15, 25, 15);

    // Надпись "COMBAT"
    if (!disabled) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("COMBAT", x + COMBAT_ROBOT_WIDTH / 2, robotY + 50);
    }
  };

  // ==================== RENDERING ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Фон
    const skyGradient = ctx.createLinearGradient(0, 0, 0, groundY);
    if (gameState.currentLevel === 1) {
      skyGradient.addColorStop(0, "#0f172a");
      skyGradient.addColorStop(1, "#1e293b");
    } else {
      skyGradient.addColorStop(0, "#1a0a0a");
      skyGradient.addColorStop(1, "#2d1515");
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, groundY);

    // Звёзды
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 50; i++) {
      const starX = (i * 137) % CANVAS_WIDTH;
      const starY = (i * 89) % (groundY - 20);
      const starSize = (i % 3) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Пол
    ctx.fillStyle = gameState.currentLevel === 1 ? "#334155" : "#3d2020";
    ctx.fillRect(0, groundY, CANVAS_WIDTH, GROUND_HEIGHT);
    ctx.strokeStyle = gameState.currentLevel === 1 ? "#475569" : "#5c3030";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_WIDTH, groundY);
    ctx.stroke();

    ctx.fillStyle = gameState.currentLevel === 1 ? "#1e293b" : "#2a1515";
    for (let i = 0; i < CANVAS_WIDTH; i += 60) {
      ctx.fillRect(i + 5, groundY + 8, 50, 4);
      ctx.fillRect(i + 10, groundY + 20, 40, 3);
    }

    if (gameState.currentLevel === 1) {
      // ==================== LEVEL 1 RENDERING ====================
      
      // Exit
      const exitActive = !gameState.robotColliderActive;
      ctx.fillStyle = exitActive ? "#22c55e" : "#4b5563";
      ctx.fillRect(exitPos.x, exitPos.y, EXIT_WIDTH, EXIT_HEIGHT);
      ctx.fillStyle = exitActive ? "#166534" : "#374151";
      ctx.fillRect(exitPos.x + 10, exitPos.y + 20, EXIT_WIDTH - 20, EXIT_HEIGHT - 20);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", exitPos.x + EXIT_WIDTH / 2, exitPos.y + 14);
      if (exitActive) {
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(exitPos.x + EXIT_WIDTH / 2, exitPos.y - 15, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Terminal
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(terminalPos.x, terminalPos.y, TERMINAL_WIDTH, TERMINAL_HEIGHT);
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(terminalPos.x + 5, terminalPos.y + 5, TERMINAL_WIDTH - 10, 30);
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(terminalPos.x + 15, terminalPos.y + TERMINAL_HEIGHT - 15, TERMINAL_WIDTH - 30, 15);
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(terminalPos.x + 10, terminalPos.y + 15, 8, 12);
      }
      if (
        isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 1) &&
        !gameState.robotDisabled &&
        gameState.spawnPhase === "ready"
      ) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("[E]", terminalPos.x + TERMINAL_WIDTH / 2, terminalPos.y - 10);
      }

      // Robot
      const robotY = robotPos.y + gameState.robotCollapseOffset;
      let robotColor = "#ef4444";
      if (gameState.robotAnimationPhase === "flashing" && gameState.robotFlashOn) {
        robotColor = "#fef08a";
      } else if (gameState.robotDisabled && gameState.robotAnimationPhase !== "flashing") {
        robotColor = "#4b5563";
      }

      ctx.fillStyle = robotColor;
      ctx.fillRect(robotPos.x, robotY, ROBOT_WIDTH, ROBOT_HEIGHT - gameState.robotCollapseOffset);
      ctx.fillRect(robotPos.x + 10, robotY - 15, ROBOT_WIDTH - 20, 20);

      const eyeColor =
        gameState.robotDisabled && gameState.robotAnimationPhase !== "flashing"
          ? "#374151"
          : "#fef08a";
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(robotPos.x + 18, robotY + 25, 8, 0, Math.PI * 2);
      ctx.arc(robotPos.x + ROBOT_WIDTH - 18, robotY + 25, 8, 0, Math.PI * 2);
      ctx.fill();

      if (!gameState.robotDisabled || gameState.robotAnimationPhase === "flashing") {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(robotPos.x + 18, robotY + 25, 3, 0, Math.PI * 2);
        ctx.arc(robotPos.x + ROBOT_WIDTH - 18, robotY + 25, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle =
        gameState.robotDisabled && gameState.robotAnimationPhase !== "flashing"
          ? "#374151"
          : "#000";
      ctx.fillRect(robotPos.x + 15, robotY + 50, ROBOT_WIDTH - 30, 8);

      ctx.fillStyle = robotColor;
      ctx.fillRect(robotPos.x - 12, robotY + 20, 12, 35);
      ctx.fillRect(robotPos.x + ROBOT_WIDTH, robotY + 20, 12, 35);

      ctx.fillStyle =
        gameState.robotDisabled && gameState.robotAnimationPhase === "done"
          ? "#6b7280"
          : "#fff";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        gameState.robotDisabled && gameState.robotAnimationPhase === "done"
          ? "---"
          : gameState.targetNumber.toString(),
        robotPos.x + ROBOT_WIDTH / 2,
        robotY - 25
      );

      // Sparks
      gameState.sparks.forEach((spark) => {
        ctx.fillStyle = `rgba(254, 240, 138, ${spark.life})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251, 191, 36, ${spark.life * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x - spark.vx * 2, spark.y - spark.vy * 2);
        ctx.stroke();
      });

      // Start zone
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(30, groundY - 65, 90, 65);
      ctx.setLineDash([]);
      ctx.fillStyle = "#60a5fa";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("ТЕЛЕПОРТ", 75, groundY + 20);

      } else {
        // ==================== LEVEL 2 RENDERING ====================

        // Генератор справа (большой блок с дисплеями)
        const genX = generatorPos.x;
        const genY = generatorPos.y;
        const genWidth = 140;
        const genHeight = 120;
        
        // Корпус генератора
        ctx.fillStyle = "#374151";
        ctx.beginPath();
        ctx.roundRect(genX, genY, genWidth, genHeight, 8);
        ctx.fill();
        
        // Верхняя панель
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(genX + 10, genY + 10, genWidth - 20, 30);
        
        // Красный дисплей (слева на генераторе) - для робота
        ctx.fillStyle = gameState.level2.combatRobotDisabled ? "#374151" : "#7f1d1d";
        ctx.fillRect(genX + 10, genY + 50, 55, 40);
        ctx.fillStyle = gameState.level2.combatRobotDisabled ? "#1f2937" : "#450a0a";
        ctx.fillRect(genX + 15, genY + 55, 45, 25);
        ctx.fillStyle = gameState.level2.combatRobotDisabled ? "#6b7280" : "#ef4444";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(gameState.level2.combatRobotDisabled ? "--" : gameState.level2.displayNumber1.toString(), genX + 37, genY + 75);
        
        // Синий дисплей (справа на генераторе) - для барьера  
        ctx.fillStyle = !gameState.level2.barrierActive ? "#374151" : "#1e3a8a";
        ctx.fillRect(genX + 75, genY + 50, 55, 40);
        ctx.fillStyle = !gameState.level2.barrierActive ? "#1f2937" : "#1e1b4b";
        ctx.fillRect(genX + 80, genY + 55, 45, 25);
        ctx.fillStyle = !gameState.level2.barrierActive ? "#6b7280" : "#3b82f6";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.fillText(!gameState.level2.barrierActive ? "--" : gameState.level2.displayNumber2.toString(), genX + 102, genY + 75);
        
        // Индикаторы под дисплеями
        ctx.fillStyle = gameState.level2.combatRobotDisabled ? "#22c55e" : "#ef4444";
        ctx.beginPath();
        ctx.arc(genX + 37, genY + 98, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = !gameState.level2.barrierActive ? "#22c55e" : "#3b82f6";
        ctx.beginPath();
        ctx.arc(genX + 102, genY + 98, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Надпись "ГЕНЕРАТОР"
        ctx.fillStyle = "#9ca3af";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText("ГЕНЕРАТОР", genX + genWidth / 2, genY + 25);
        
        // Детали генератора (вентиляция)
        ctx.fillStyle = "#1f2937";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(genX + genWidth - 15, genY + 15 + i * 8, 10, 4);
        }
        
        // Красный провод: от генератора к роботу (снизу)
        const redWirePoints = [
          { x: genX + 37, y: genY + genHeight },
          { x: genX + 37, y: groundY - 20 },
          { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: groundY - 20 },
          { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: combatRobotPos.y + COMBAT_ROBOT_HEIGHT },
        ];
        
        ctx.strokeStyle = gameState.level2.combatRobotDisabled ? "#4b5563" : "#ef4444";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(redWirePoints[0].x, redWirePoints[0].y);
        for (let i = 1; i < redWirePoints.length; i++) {
          ctx.lineTo(redWirePoints[i].x, redWirePoints[i].y);
        }
        ctx.stroke();

        // Синий провод: от генератора к барьеру (снизу)
        const blueWirePoints = [
          { x: genX + 102, y: genY + genHeight },
          { x: genX + 102, y: groundY - 40 },
          { x: barrierX + 10, y: groundY - 40 },
          { x: barrierX + 10, y: groundY },
        ];
        
        ctx.strokeStyle = !gameState.level2.barrierActive ? "#4b5563" : "#3b82f6";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(blueWirePoints[0].x, blueWirePoints[0].y);
        for (let i = 1; i < blueWirePoints.length; i++) {
          ctx.lineTo(blueWirePoints[i].x, blueWirePoints[i].y);
        }
        ctx.stroke();

        // Анимация тока по проводам
        if (gameState.level2.wireAnimationActive !== "none") {
          const wirePoints = gameState.level2.wireAnimationActive === "robot" ? redWirePoints : blueWirePoints;
          const wireColor = gameState.level2.wireAnimationActive === "robot" ? "#fef08a" : "#93c5fd";
          const progress = gameState.level2.wireAnimationProgress;
          
          // Вычисляем общую длину провода
          let totalLength = 0;
          for (let i = 1; i < wirePoints.length; i++) {
            totalLength += Math.sqrt(
              Math.pow(wirePoints[i].x - wirePoints[i-1].x, 2) +
              Math.pow(wirePoints[i].y - wirePoints[i-1].y, 2)
            );
          }
          
          // Рисуем светящуюся часть провода
          const targetLength = totalLength * progress;
          let currentLength = 0;
          
          ctx.strokeStyle = wireColor;
          ctx.lineWidth = 6;
          ctx.shadowColor = wireColor;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(wirePoints[0].x, wirePoints[0].y);
          
          for (let i = 1; i < wirePoints.length; i++) {
            const segmentLength = Math.sqrt(
              Math.pow(wirePoints[i].x - wirePoints[i-1].x, 2) +
              Math.pow(wirePoints[i].y - wirePoints[i-1].y, 2)
            );
            
            if (currentLength + segmentLength <= targetLength) {
              ctx.lineTo(wirePoints[i].x, wirePoints[i].y);
              currentLength += segmentLength;
            } else {
              const remaining = targetLength - currentLength;
              const ratio = remaining / segmentLength;
              const endX = wirePoints[i-1].x + (wirePoints[i].x - wirePoints[i-1].x) * ratio;
              const endY = wirePoints[i-1].y + (wirePoints[i].y - wirePoints[i-1].y) * ratio;
              ctx.lineTo(endX, endY);
              
              // Рисуем искру на конце
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(endX, endY, 8 + Math.sin(Date.now() * 0.02) * 3, 0, Math.PI * 2);
              ctx.fillStyle = wireColor;
              ctx.fill();
              break;
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Терминал Level 2 (такой же как Level 1)
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(level2TerminalPos.x, level2TerminalPos.y, TERMINAL_WIDTH, TERMINAL_HEIGHT);
        ctx.fillStyle = "#1e3a5f";
        ctx.fillRect(level2TerminalPos.x + 5, level2TerminalPos.y + 5, TERMINAL_WIDTH - 10, 30);
        ctx.fillStyle = "#1e40af";
        ctx.fillRect(level2TerminalPos.x + 15, level2TerminalPos.y + TERMINAL_HEIGHT - 15, TERMINAL_WIDTH - 30, 15);
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          ctx.fillStyle = "#4ade80";
          ctx.fillRect(level2TerminalPos.x + 10, level2TerminalPos.y + 15, 8, 12);
        }

        if (
          isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 2) &&
          gameState.spawnPhase === "ready" &&
          !gameState.level2.playerDead &&
          (!gameState.level2.combatRobotDisabled || gameState.level2.barrierActive) &&
          gameState.level2.wireAnimationActive === "none"
        ) {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.fillText("[E]", level2TerminalPos.x + TERMINAL_WIDTH / 2, level2TerminalPos.y - 10);
        }

        // Барьер (энергетический щит)
        if (gameState.level2.barrierActive) {
          const barrierAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
          const gradient = ctx.createLinearGradient(barrierX, 0, barrierX + 20, 0);
          gradient.addColorStop(0, `rgba(59, 130, 246, 0)`);
          gradient.addColorStop(0.5, `rgba(59, 130, 246, ${barrierAlpha})`);
          gradient.addColorStop(1, `rgba(59, 130, 246, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(barrierX - 10, 0, 40, groundY);

          // Линии энергии
          ctx.strokeStyle = `rgba(147, 197, 253, ${0.5 + Math.sin(Date.now() * 0.01) * 0.3})`;
          ctx.lineWidth = 2;
          for (let i = 0; i < groundY; i += 30) {
            const offset = Math.sin((Date.now() + i * 10) * 0.005) * 5;
            ctx.beginPath();
            ctx.moveTo(barrierX + offset, i);
            ctx.lineTo(barrierX + offset, i + 20);
            ctx.stroke();
          }

          // Таймер барьера (только если робот ещё активен)
          if (!gameState.level2.combatRobotDisabled) {
            const timePercent = gameState.level2.barrierTimeLeft / BARRIER_MAX_TIME;
            ctx.fillStyle = "#1e3a8a";
            ctx.fillRect(barrierX - 40, 20, 100, 25);
            ctx.fillStyle = timePercent > 0.3 ? "#3b82f6" : "#ef4444";
            ctx.fillRect(barrierX - 38, 22, 96 * timePercent, 21);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${Math.ceil(gameState.level2.barrierTimeLeft / 1000)}с`, barrierX + 10, 38);
          }
        }

        // Пули
        ctx.fillStyle = "#fbbf24";
        gameState.level2.bullets.forEach((bullet) => {
          ctx.beginPath();
          ctx.ellipse(bullet.x + BULLET_WIDTH / 2, bullet.y + BULLET_HEIGHT / 2, BULLET_WIDTH / 2, BULLET_HEIGHT / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          // След пули
          const trailGradient = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x + 40, bullet.y);
          trailGradient.addColorStop(0, "rgba(251, 191, 36, 0.5)");
          trailGradient.addColorStop(1, "rgba(251, 191, 36, 0)");
          ctx.fillStyle = trailGradient;
          ctx.fillRect(bullet.x + BULLET_WIDTH, bullet.y + 2, 30, BULLET_HEIGHT - 4);
        });

        // Боевой робот
        drawCombatRobot(
        ctx,
        combatRobotPos.x,
        combatRobotPos.y,
        gameState.level2.combatRobotDisabled,
        gameState.level2.combatRobotAnimPhase,
        gameState.level2.combatRobotFlashCount,
        gameState.level2.combatRobotCollapseOffset
      );

      // Искры боевого робота
      gameState.level2.sparks.forEach((spark) => {
        ctx.fillStyle = `rgba(254, 240, 138, ${spark.life})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(239, 68, 68, ${spark.life * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x - spark.vx * 2, spark.y - spark.vy * 2);
        ctx.stroke();
      });

      // Exit Level 2
      const exitActive = gameState.level2.combatRobotDisabled && !gameState.level2.barrierActive;
      ctx.fillStyle = exitActive ? "#22c55e" : "#4b5563";
      ctx.fillRect(level2ExitPos.x, level2ExitPos.y, EXIT_WIDTH, EXIT_HEIGHT);
      ctx.fillStyle = exitActive ? "#166534" : "#374151";
      ctx.fillRect(level2ExitPos.x + 10, level2ExitPos.y + 20, EXIT_WIDTH - 20, EXIT_HEIGHT - 20);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", level2ExitPos.x + EXIT_WIDTH / 2, level2ExitPos.y + 14);
      if (exitActive) {
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(level2ExitPos.x + EXIT_WIDTH / 2, level2ExitPos.y - 15, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Стартовая зона
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(30, groundY - 65, 90, 65);
      ctx.setLineDash([]);
      ctx.fillStyle = "#60a5fa";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("ТЕЛЕПОРТ", 75, groundY + 20);
    }

    // ==================== SPAWN ANIMATION ====================
    const playerCenterX = gameState.playerPos.x + PLAYER_WIDTH / 2;
    const playerCenterY = gameState.playerPos.y + PLAYER_HEIGHT / 2;

    if (gameState.spawnPhase === "beam") {
      const beamWidth = 40 * (1 - gameState.spawnProgress * 0.3);
      const gradient = ctx.createLinearGradient(playerCenterX, 0, playerCenterX, groundY);
      gradient.addColorStop(0, "rgba(96, 165, 250, 0)");
      gradient.addColorStop(0.3, `rgba(96, 165, 250, ${0.6 * (1 - gameState.spawnProgress)})`);
      gradient.addColorStop(0.7, `rgba(52, 211, 153, ${0.8 * (1 - gameState.spawnProgress)})`);
      gradient.addColorStop(1, "rgba(52, 211, 153, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(playerCenterX - beamWidth / 2, 0);
      ctx.lineTo(playerCenterX + beamWidth / 2, 0);
      ctx.lineTo(playerCenterX + beamWidth / 4, groundY);
      ctx.lineTo(playerCenterX - beamWidth / 4, groundY);
      ctx.closePath();
      ctx.fill();

      gameState.spawnParticles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
      drawAstronaut(ctx, gameState.playerPos.x, gameState.playerPos.y, gameState.facingRight, false, true, 0, "ready", 1);
      ctx.globalAlpha = 1;
    } else if (gameState.spawnPhase === "materialize") {
      const materializedHeight = PLAYER_HEIGHT * gameState.spawnProgress;

      ctx.save();
      ctx.beginPath();
      ctx.rect(gameState.playerPos.x - 20, gameState.playerPos.y + PLAYER_HEIGHT - materializedHeight, PLAYER_WIDTH + 40, materializedHeight + 20);
      ctx.clip();

      drawAstronaut(ctx, gameState.playerPos.x, gameState.playerPos.y, gameState.facingRight, false, true, 0, "materialize", gameState.spawnProgress);
      ctx.restore();

      ctx.strokeStyle = `rgba(96, 165, 250, ${1 - gameState.spawnProgress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(playerCenterX, playerCenterY, 30 + gameState.spawnProgress * 20, 0, Math.PI * 2);
      ctx.stroke();
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
        gameState.spawnProgress
      );
    }

    // Номер уровня
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Уровень ${gameState.currentLevel}`, 20, 30);

  }, [gameState, isNearTerminal, robotPos, terminalPos, exitPos, level2ExitPos, combatRobotPos, level2TerminalPos, groundY, barrierX, drawAstronaut, drawCombatRobot]);

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
