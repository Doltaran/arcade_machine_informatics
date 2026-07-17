"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type {
  Position,
  SpawnParticle,
  GameState,
  SatelliteCommand,
  StationOperand,
  StationTerminalId,
} from "@/game/types";
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
  drawLevel3Platforms,
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
import LevelAIHelper from "@/components/LevelAIHelper";
import {
  getLevel4GateOutput,
  getLevel4Layout,
  getLevel4Platforms,
  type Level4Gate,
} from "@/game/levels/level4";
import {
  STATION_OPERAND_META,
  getStationDoors,
  getStationExitPos,
  getStationPlatforms,
  getStationTerminals,
} from "@/game/levels/level5";
import { getLevelDifficulty } from "@/game/difficulty";
import type { KnowledgeLevel } from "@/lib/placement-test";

// ==================== LOCAL CONSTANTS ====================
const TERMINAL_WIDTH = 50;
const TERMINAL_HEIGHT = 60;
const INTERACTION_DISTANCE = 70;
const LEVEL3_PLATFORM_WIDTH = 120;
const LEVEL3_PLATFORM_HEIGHT = 26;
const LEVEL5_CELL_SIZE = 60;
const LEVEL5_GRID_OFFSET = { x: 180, y: 120 };
const LEVEL5_GRID_RAW = [
  "##########",
  "#S..K...##",
  "#..#.#.!.#",
  "#..#.#..##",
  "#..#...D.#",
  "#..####..#",
  "#.!....!.#",
  "##########",
];

const buildLevel5Grid = () => LEVEL5_GRID_RAW.map((row) => row.split(""));

const SATELLITE_POSITIONS: Position[] = [
  { x: 360, y: 250 },
  { x: 700, y: 170 },
  { x: 1040, y: 280 },
];
const SATELLITE_BASE_POS: Position = { x: 190, y: 220 };

const SATELLITE_COMMAND_META: Record<
  SatelliteCommand["type"],
  { label: string; short: string; color: string }
> = {
  forward: { label: "Лететь вперёд", short: "→", color: "bg-cyan-600" },
  left: { label: "Повернуть налево", short: "↺", color: "bg-indigo-600" },
  right: { label: "Повернуть направо", short: "↻", color: "bg-indigo-600" },
  dock: { label: "Остановиться у спутника", short: "⦿", color: "bg-amber-500" },
  open: { label: "Открыть панель", short: "🔓", color: "bg-orange-500" },
  replace: { label: "Заменить модуль", short: "⚙", color: "bg-emerald-600" },
  close: { label: "Закрыть панель", short: "🔒", color: "bg-orange-600" },
  signal: { label: "Отправить сигнал", short: "📡", color: "bg-fuchsia-600" },
  repeat: { label: "Повторить", short: "⟲", color: "bg-violet-600" },
};

const getSatelliteStageTargetCount = (stage: 1 | 2 | 3) => (stage === 1 ? 1 : 3);
const getSatelliteProgramLimit = (stage: 1 | 2 | 3) =>
  stage === 1 ? 8 : stage === 2 ? 12 : 10;
const countSatelliteCommands = (commands: SatelliteCommand[]): number =>
  commands.reduce(
    (total, command) =>
      total +
      1 +
      (command.type === "repeat"
        ? countSatelliteCommands(command.children ?? [])
        : 0),
    0
  );
const hasSatelliteRepeat = (commands: SatelliteCommand[]): boolean =>
  commands.some(
    (command) =>
      command.type === "repeat" ||
      (command.children ? hasSatelliteRepeat(command.children) : false)
  );

const findGridCell = (grid: string[][], value: string): Position => {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      if (grid[y][x] === value) {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
};

const EMPTY_STATION_BUILDER = {
  left: null as StationOperand | null,
  right: null as StationOperand | null,
  operator: null as "AND" | "OR" | null,
  notLeft: false,
  notRight: false,
};

const getNextStationGoal = (solved: Record<StationTerminalId, boolean>) => {
  if (!solved.airlock) return "Открой шлюз A-1";
  if (!solved.generator) return "Запусти резервный генератор";
  if (!solved.sector) return "Разреши вход в отсек C";
  if (!solved.life_support) return "Восстанови жизнеобеспечение";
  if (!solved.final_airlock) return "Открой финальный шлюз";
  return "Доберись до выходного шлюза";
};

const createSatelliteCommand = (
  type: SatelliteCommand["type"],
  overrides: Partial<SatelliteCommand> = {}
): SatelliteCommand => ({
  id: `${type}-${Math.random().toString(36).slice(2, 9)}`,
  type,
  ...overrides,
});

const buildSatelliteRepairSequence = () => [
  createSatelliteCommand("forward"),
  createSatelliteCommand("dock"),
  createSatelliteCommand("open"),
  createSatelliteCommand("replace"),
  createSatelliteCommand("close"),
  createSatelliteCommand("signal"),
];

const buildStage3SatelliteProgram = () => [
  ...buildSatelliteRepairSequence(),
  ...buildSatelliteRepairSequence(),
  ...buildSatelliteRepairSequence(),
];
const getStage3LongProgram = () => buildStage3SatelliteProgram();

const getSatelliteStageGoal = (stage: 1 | 2 | 3) => {
  if (stage === 1) return "Отремонтируй один спутник";
  if (stage === 2) return "Отремонтируй три одинаковых спутника";
  return "Сократи алгоритм с помощью блока Повторить";
};

const randomInteger = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getLevelMeta = (level: number) => {
  if (level === 1) {
    return { title: "Робот-охранник", topic: "Системы счисления и кодирование" };
  }
  if (level === 2) {
    return { title: "Боевой робот", topic: "Системы счисления и кодирование" };
  }
  if (level === 3) {
    return { title: "Платформы", topic: "Системы счисления и кодирование" };
  }
  if (level === 4) {
    return { title: "Логические ворота", topic: "Логика и условия" };
  }
  if (level === 5) {
    return { title: "Авария на космической станции", topic: "Логика и условия" };
  }
  if (level === 6) {
    return { title: "Робот-доставщик", topic: "Алгоритмы и структуры" };
  }
  return { title: "Ремонт спутников", topic: "Алгоритмы и структуры" };
};

interface GameProps {
  startLevel: number;
  knowledgeLevel?: KnowledgeLevel | null;
  onLevelComplete: (level: number) => void;
  onExit: () => void;
}

export default function Game({ startLevel, knowledgeLevel, onLevelComplete, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number>(0);
  const difficulty = getLevelDifficulty(knowledgeLevel);

  const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;

  // Level 1 positions
  const robotPos: Position = { x: 850, y: groundY - ROBOT_HEIGHT };
  const terminalPos: Position = { x: 430, y: groundY - TERMINAL_HEIGHT };
  const exitPos: Position = { x: CANVAS_WIDTH - EXIT_WIDTH - 30, y: groundY - EXIT_HEIGHT };

  // Level 2 positions
  const combatRobotPos: Position = { x: 750, y: groundY - COMBAT_ROBOT_HEIGHT };
  const generatorPos: Position = { x: CANVAS_WIDTH - 300, y: groundY - 120 };
  const level2TerminalPos: Position = { x: 200, y: groundY - TERMINAL_HEIGHT };
  const level2ExitPos: Position = { x: CANVAS_WIDTH - EXIT_WIDTH - 30, y: groundY - EXIT_HEIGHT };
  const barrierX = 380;

  // Level 3 positions
  const level3ExitPos: Position = { x: 860, y: 210 };
  const level3TerminalPos: Position = { x: 120, y: groundY - TERMINAL_HEIGHT };

  // Level 5 positions
  const stationExitPos = getStationExitPos(groundY);
  const stationTerminals = getStationTerminals(groundY);

  const createLevel3Platforms = () => {
    const numbers = difficulty.platformNumbers;
    return [
      { id: "p1", x: 140, y: 700, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[0], active: false },
      { id: "p2", x: 340, y: 640, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[1], active: false },
      { id: "p3", x: 540, y: 580, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[2], active: false },
      { id: "p4", x: 740, y: 520, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[3], active: false },
      { id: "p5", x: 980, y: 460, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[4], active: false },
      { id: "p6", x: 760, y: 400, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[5], active: false },
      { id: "p7", x: 520, y: 340, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[6], active: false },
      { id: "p8", x: 820, y: 300, width: LEVEL3_PLATFORM_WIDTH, height: LEVEL3_PLATFORM_HEIGHT, number: numbers[7], active: false },
    ];
  };

  function initGameState(level: number = 1): GameState {
    const level5Grid = buildLevel5Grid();
    const level5Start = findGridCell(level5Grid, "S");
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

    const { min, max } = difficulty.binaryNumberRange;
    const num1 = randomInteger(min, max);
    let num2 = randomInteger(min, max);
    while (num2 === num1) {
      num2 = randomInteger(min, max);
    }

    return {
      currentLevel: level,
      playerPos: { x: 80, y: CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT },
      playerVelocityY: 0,
      isGrounded: true,
      isMoving: false,
      facingRight: true,
      animationTime: 0,
      robotDisabled: level !== 1,
      robotColliderActive: level === 1,
      targetNumber: randomInteger(min, max),
      showTerminal: false,
      terminalInput: "",
      terminalMessage: "",
      terminalMessageType: "",
      errorMessageTimer: 0,
      levelComplete: false,
      levelCompletePhase: "none",
      levelCompleteOpacity: 0,
      currentGoal:
        level === 1
          ? "Отключить робота через терминал"
          : level === 2
          ? "Отключить боевого робота"
          : level === 3
          ? "Активируй платформы через терминал"
          : level === 4
          ? "Переключи рычаги A и B"
          : level === 5
          ? "Открой шлюз A-1"
          : level === 6
          ? "Запрограммируй робота: ключ → дверь"
          : "Отремонтируй один спутник",
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
      level3: {
        platforms:
          level === 3 ? createLevel3Platforms() : level === 5 ? getStationPlatforms(groundY) : [],
      },
      level4: {
        stage: 1,
        leverA: false,
        leverB: false,
        platforms: level === 4 ? getLevel4Platforms(1, groundY, false, false) : [],
        puzzleSelections: {
          "00": false,
          "01": false,
          "10": false,
          "11": false,
        },
        puzzleSolved: false,
      },
      station: {
        tutorialSeen: level !== 5,
        activeTerminal: null,
        solved: {
          airlock: false,
          generator: false,
          sector: false,
          life_support: false,
          final_airlock: false,
        },
        builder: { ...EMPTY_STATION_BUILDER },
        feedback: "",
        feedbackType: "",
      },
      level5: {
        grid: level5Grid,
        robotPos: level5Start,
        direction: "E",
        hasKey: false,
        program: [],
        stepIndex: 0,
        running: false,
        message: "",
        messageType: "",
        messageTimer: 0,
        maxCommands: Math.max(8, 12 + difficulty.recommendedCommandLimitModifier),
      },
      satellite: {
        tutorialSeen: level !== 7,
        stage: 1,
        program: [],
        selectedRepeatId: null,
        running: false,
        currentCommandId: null,
        currentSatellite: 1,
        currentRepeat: 0,
        totalActions: 0,
        repairedCount: 0,
        docked: false,
        openPanel: false,
        replacedCurrent: false,
        stageMessage: "",
        stageMessageType: "",
        droneDirection: "E",
        dronePos: SATELLITE_BASE_POS,
      },
    };
  }

  const [gameState, setGameState] = useState<GameState>(() => initGameState(startLevel));
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const level5RunRef = useRef<NodeJS.Timeout | null>(null);
  const level5ResetRef = useRef<NodeJS.Timeout | null>(null);
  const level5ErrorHandledRef = useRef(false);
  const satelliteRunRef = useRef<NodeJS.Timeout | null>(null);

  const level4Layout = getLevel4Layout(gameState.level4.stage, groundY);
  const level4GateOutput =
    level4Layout.gate !== "FINAL"
      ? getLevel4GateOutput(
          level4Layout.gate as Level4Gate,
          gameState.level4.leverA,
          gameState.level4.leverB
        )
      : false;
  const stationDoors = getStationDoors(groundY, gameState.station.solved);
  const activeStationTerminal =
    stationTerminals.find((terminal) => terminal.id === gameState.station.activeTerminal) ?? null;

  const flattenSatelliteProgram = (
    commands: SatelliteCommand[],
    repeatStack: number[] = []
  ): Array<{
    command: SatelliteCommand;
    repeatIndex: number;
  }> => {
    const flat: Array<{ command: SatelliteCommand; repeatIndex: number }> = [];

    commands.forEach((command) => {
      if (command.type === "repeat") {
        const count = command.repeatCount ?? 2;
        for (let index = 1; index <= count; index += 1) {
          flat.push(
            ...flattenSatelliteProgram(command.children ?? [], [...repeatStack, index]).map(
              (item) => ({
                ...item,
                repeatIndex: item.repeatIndex || index,
              })
            )
          );
        }
      } else {
        flat.push({
          command,
          repeatIndex: repeatStack[repeatStack.length - 1] ?? 0,
        });
      }
    });

    return flat;
  };

  const resetSatelliteStage = useCallback(
    (
      stage: 1 | 2 | 3,
      options?: {
        keepProgram?: boolean;
        stageMessage?: string;
        stageMessageType?: "error" | "success" | "";
      }
    ) => {
      setGameState((prev) => {
        const defaultProgram = options?.keepProgram
          ? prev.satellite.program
          : stage === 3
          ? getStage3LongProgram()
          : [];

        return {
          ...prev,
          currentGoal: getSatelliteStageGoal(stage),
          satellite: {
            ...prev.satellite,
            stage,
            program: options?.keepProgram ? prev.satellite.program : defaultProgram,
            selectedRepeatId: null,
            running: false,
            currentCommandId: null,
            currentSatellite: 0,
            currentRepeat: 0,
            totalActions: 0,
            repairedCount: 0,
            docked: false,
            openPanel: false,
            replacedCurrent: false,
            stageMessage: options?.stageMessage ?? "",
            stageMessageType: options?.stageMessageType ?? "",
            droneDirection: "E",
            dronePos: SATELLITE_BASE_POS,
          },
        };
      });
    },
    []
  );

  const updateSatelliteProgramTree = useCallback(
    (
      commands: SatelliteCommand[],
      targetId: string | null,
      updater: (items: SatelliteCommand[]) => SatelliteCommand[]
    ): SatelliteCommand[] => {
      if (!targetId) {
        return updater(commands);
      }

      return commands.map((command) => {
        if (command.id === targetId && command.type === "repeat") {
          return {
            ...command,
            children: updater(command.children ?? []),
          };
        }

        if (command.children) {
          return {
            ...command,
            children: updateSatelliteProgramTree(command.children, targetId, updater),
          };
        }

        return command;
      });
    },
    []
  );

  const addSatelliteCommand = useCallback(
    (type: SatelliteCommand["type"]) => {
      setGameState((prev) => {
        if (prev.currentLevel !== 7) return prev;
        if (prev.satellite.running) return prev;
        if (countSatelliteCommands(prev.satellite.program) >= getSatelliteProgramLimit(prev.satellite.stage)) {
          return {
            ...prev,
            satellite: {
              ...prev.satellite,
              stageMessage: "Лимит команд достигнут. Попробуй сократить алгоритм.",
              stageMessageType: "error",
            },
          };
        }

        const nextCommand =
          type === "repeat"
            ? createSatelliteCommand("repeat", { repeatCount: 2, children: [] })
            : createSatelliteCommand(type);

        return {
          ...prev,
          satellite: {
            ...prev.satellite,
            program: updateSatelliteProgramTree(
              prev.satellite.program,
              prev.satellite.selectedRepeatId,
              (items) => [...items, nextCommand]
            ),
            stageMessage: "",
            stageMessageType: "",
          },
        };
      });
    },
    [updateSatelliteProgramTree]
  );

  const removeSatelliteCommand = useCallback((commandId: string) => {
    const removeFromTree = (commands: SatelliteCommand[]): SatelliteCommand[] =>
      commands
        .filter((command) => command.id !== commandId)
        .map((command) =>
          command.children
            ? { ...command, children: removeFromTree(command.children) }
            : command
        );

    setGameState((prev) => {
      if (prev.currentLevel !== 7 || prev.satellite.running) return prev;

      return {
        ...prev,
        satellite: {
          ...prev.satellite,
          program: removeFromTree(prev.satellite.program),
          selectedRepeatId:
            prev.satellite.selectedRepeatId === commandId
              ? null
              : prev.satellite.selectedRepeatId,
          stageMessage: "",
          stageMessageType: "",
        },
      };
    });
  }, []);

  const updateSatelliteRepeatCount = useCallback(
    (commandId: string, repeatCount: 2 | 3 | 4 | 5) => {
      const updateTree = (commands: SatelliteCommand[]): SatelliteCommand[] =>
        commands.map((command) => {
          if (command.id === commandId && command.type === "repeat") {
            return { ...command, repeatCount };
          }
          if (command.children) {
            return { ...command, children: updateTree(command.children) };
          }
          return command;
        });

      setGameState((prev) => ({
        ...prev,
        satellite: {
          ...prev.satellite,
          program: updateTree(prev.satellite.program),
          stageMessage: "",
          stageMessageType: "",
        },
      }));
    },
    []
  );

  const clearSatelliteProgram = useCallback(() => {
    resetSatelliteStage(gameState.satellite.stage, {
      keepProgram: false,
      stageMessage:
        gameState.satellite.stage === 3
          ? "Длинный алгоритм очищен. Теперь собери короткую версию."
          : "",
      stageMessageType: gameState.satellite.stage === 3 ? "success" : "",
    });
  }, [gameState.satellite.stage, resetSatelliteStage]);

  const restoreSatelliteLongProgram = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      satellite: {
        ...prev.satellite,
        program: getStage3LongProgram(),
        selectedRepeatId: null,
        running: false,
        currentCommandId: null,
        currentSatellite: 0,
        currentRepeat: 0,
        totalActions: 0,
        repairedCount: 0,
        docked: false,
        openPanel: false,
        replacedCurrent: false,
        stageMessage: "Длинный алгоритм восстановлен. Сократи его через Повторить.",
        stageMessageType: "success",
        droneDirection: "E",
        dronePos: SATELLITE_BASE_POS,
      },
    }));
  }, []);

  // Track level completions to notify parent
  const levelCompletedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const shouldNotify =
      gameState.levelComplete &&
      (gameState.levelCompletePhase === "showButton" ||
        (gameState.levelCompletePhase === "transition" && gameState.currentLevel !== 7));
    if (shouldNotify) {
      const level = gameState.currentLevel;
      if (!levelCompletedRef.current.has(level)) {
        levelCompletedRef.current.add(level);
        onLevelComplete(level);
      }
    }
  }, [gameState.levelComplete, gameState.levelCompletePhase, gameState.currentLevel, onLevelComplete]);

  function binaryToDecimal(binary: string): number {
    if (!/^[01]+$/.test(binary) || binary.length === 0) return -1;
    return parseInt(binary, 2);
  }

  const isNearTerminal = useCallback(
    (x: number, y: number, level: number): boolean => {
      const playerCenter = { x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 };
      const tPos =
        level === 1
          ? terminalPos
          : level === 2
          ? level2TerminalPos
          : level === 3
          ? level3TerminalPos
          : level4Layout.terminalPos;

      if (!tPos) return false;

      const terminalCenter = {
        x: tPos.x + TERMINAL_WIDTH / 2,
        y: tPos.y + TERMINAL_HEIGHT / 2,
      };
      const distance = Math.sqrt(
        Math.pow(playerCenter.x - terminalCenter.x, 2) + Math.pow(playerCenter.y - terminalCenter.y, 2)
      );
      return distance < INTERACTION_DISTANCE;
    },
    [terminalPos, level2TerminalPos, level3TerminalPos, level4Layout]
  );

  const isNearLever = useCallback(
    (x: number, y: number, leverPos: Position | null): boolean => {
      if (!leverPos) return false;
      const playerCenter = { x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 };
      const leverCenter = {
        x: leverPos.x + 18,
        y: leverPos.y + 18,
      };
      const distance = Math.sqrt(
        Math.pow(playerCenter.x - leverCenter.x, 2) + Math.pow(playerCenter.y - leverCenter.y, 2)
      );
      return distance < INTERACTION_DISTANCE;
    },
    []
  );

  const getNearbyStationTerminal = useCallback(
    (x: number, y: number) => {
      const playerCenter = { x: x + PLAYER_WIDTH / 2, y: y + PLAYER_HEIGHT / 2 };

      return (
        stationTerminals.find((terminal) => {
          const terminalCenter = {
            x: terminal.pos.x + TERMINAL_WIDTH / 2,
            y: terminal.pos.y + TERMINAL_HEIGHT / 2,
          };
          const distance = Math.sqrt(
            Math.pow(playerCenter.x - terminalCenter.x, 2) +
              Math.pow(playerCenter.y - terminalCenter.y, 2)
          );
          return distance < INTERACTION_DISTANCE;
        }) ?? null
      );
    },
    [stationTerminals]
  );

  const handleTerminalSubmit = useCallback(() => {
    const input = gameState.terminalInput.trim();
    if (input.length === 0) return;

    if (gameState.currentLevel === 4 || gameState.currentLevel === 5 || gameState.currentLevel === 6) {
      return;
    }

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
    } else if (gameState.currentLevel === 2) {
      const target = gameState.level2.terminalTarget;
      if (!target) return;

      if (target === "robot") {
        if (enteredValue === gameState.level2.displayNumber1) {
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
    } else {
      const platform = gameState.level3.platforms.find(
        (p) => p.number === enteredValue
      );

      if (!platform) {
        setGameState((prev) => ({
          ...prev,
          terminalMessage: "Такой платформы нет. Проверь номер!",
          terminalMessageType: "error",
          errorMessageTimer: 1500,
        }));
        return;
      }

      if (platform.active) {
        setGameState((prev) => ({
          ...prev,
          terminalMessage: "Платформа уже активна!",
          terminalMessageType: "success",
          errorMessageTimer: 1200,
        }));
        return;
      }

      setGameState((prev) => {
        const updatedPlatforms = prev.level3.platforms.map((p) =>
          p.number === platform.number ? { ...p, active: true } : p
        );
        const allActive = updatedPlatforms.every((p) => p.active);

        return {
          ...prev,
          terminalInput: "",
          terminalMessage: `Платформа ${platform.number} активирована`,
          terminalMessageType: "success",
          errorMessageTimer: 1500,
          currentGoal: allActive ? "Дойди до выхода" : prev.currentGoal,
          level3: {
            ...prev.level3,
            platforms: updatedPlatforms,
          },
        };
      });
    }
  }, [
    gameState.terminalInput,
    gameState.targetNumber,
    gameState.currentLevel,
    gameState.level2.terminalTarget,
    gameState.level2.displayNumber1,
    gameState.level2.displayNumber2,
    gameState.level3.platforms,
  ]);

  // ==================== KEYBOARD HANDLING ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (gameState.showTerminal) {
          setGameState((prev) => ({
            ...prev,
            showTerminal: false,
            terminalInput: "",
            terminalMessage: "",
            terminalMessageType: "",
          }));
        } else {
          setShowExitConfirm(true);
        }
        return;
      }

      if (showExitConfirm) return;

      if (e.key === "Tab") {
        e.preventDefault();
        setGameState((prev) => ({
          ...prev,
          taskPanelExpanded: !prev.taskPanelExpanded,
        }));
        return;
      }

      if (gameState.showTerminal) {
        if (
          e.key === "Enter" &&
          !(gameState.currentLevel === 4 && gameState.level4.stage === 4)
        ) {
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
        } else if (gameState.currentLevel === 2) {
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
        } else if (gameState.currentLevel === 3) {
          if (
            isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 3) &&
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
        } else if (gameState.currentLevel === 4) {
          const nearLeverA = isNearLever(
            gameState.playerPos.x,
            gameState.playerPos.y,
            level4Layout.leverA
          );
          const nearLeverB = isNearLever(
            gameState.playerPos.x,
            gameState.playerPos.y,
            level4Layout.leverB
          );

          if (nearLeverA) {
            setGameState((prev) => ({
              ...prev,
              level4: {
                ...prev.level4,
                leverA: !prev.level4.leverA,
                platforms: getLevel4Platforms(
                  prev.level4.stage,
                  groundY,
                  !prev.level4.leverA,
                  prev.level4.leverB
                ),
              },
            }));
            return;
          }

          if (nearLeverB) {
            setGameState((prev) => ({
              ...prev,
              level4: {
                ...prev.level4,
                leverB: !prev.level4.leverB,
                platforms: getLevel4Platforms(
                  prev.level4.stage,
                  groundY,
                  prev.level4.leverA,
                  !prev.level4.leverB
                ),
              },
            }));
            return;
          }

          if (
            gameState.level4.stage === 4 &&
            isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 4) &&
            gameState.spawnPhase === "ready"
          ) {
            setGameState((prev) => ({
              ...prev,
              showTerminal: true,
              terminalMessage: "",
              terminalMessageType: "",
            }));
          }
        } else if (gameState.currentLevel === 5) {
          if (!gameState.station.tutorialSeen) {
            return;
          }

          const nearbyTerminal = getNearbyStationTerminal(
            gameState.playerPos.x,
            gameState.playerPos.y
          );

          if (nearbyTerminal && gameState.spawnPhase === "ready") {
            setGameState((prev) => ({
              ...prev,
              showTerminal: true,
              terminalMessage: "",
              terminalMessageType: "",
              station: {
                ...prev.station,
                activeTerminal: nearbyTerminal.id,
                builder: { ...EMPTY_STATION_BUILDER },
                feedback: "",
                feedbackType: "",
              },
            }));
          }
        } else if (gameState.currentLevel === 6) {
          return;
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
    gameState.level4.stage,
    gameState.level4.leverA,
    gameState.level4.leverB,
    gameState.station.tutorialSeen,
    level4Layout,
    isNearTerminal,
    isNearLever,
    getNearbyStationTerminal,
    handleTerminalSubmit,
    showExitConfirm,
  ]);

  // ==================== WORLD CONFIG ====================
  const worldConfig: WorldConfig = {
    robotPos,
    exitPos,
    combatRobotPos,
    level2ExitPos,
    level3ExitPos,
    level5ExitPos: stationExitPos,
    barrierX,
    groundY,
  };

  // ==================== GAME LOOP ====================
  useEffect(() => {
    if (showExitConfirm) return;

    let lastTime = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min(currentTime - lastTime, 50);
      lastTime = currentTime;

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
  }, [worldConfig, showExitConfirm]);

  // ==================== RENDERING ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawBackground(ctx, CANVAS_WIDTH, groundY, GROUND_HEIGHT, gameState.currentLevel);

    if (gameState.currentLevel === 1) {
      drawExit(ctx, exitPos, EXIT_WIDTH, EXIT_HEIGHT, !gameState.robotColliderActive);

      const showTerminalHint = isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 1) &&
        !gameState.robotDisabled &&
        gameState.spawnPhase === "ready";
      drawTerminal(ctx, terminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminalHint);

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

      drawSparks(ctx, gameState.sparks);
      drawStartZone(ctx, groundY);

    } else if (gameState.currentLevel === 2) {
      const genHeight = 120;

      drawGenerator(
        ctx,
        generatorPos,
        gameState.level2.combatRobotDisabled,
        gameState.level2.barrierActive,
        gameState.level2.displayNumber1,
        gameState.level2.displayNumber2
      );

      const redWirePoints: Position[] = [
        { x: generatorPos.x + 37, y: generatorPos.y + genHeight },
        { x: generatorPos.x + 37, y: groundY + 20 },
        { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: groundY + 20 },
        { x: combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2, y: combatRobotPos.y + COMBAT_ROBOT_HEIGHT },
      ];

      const blueWirePoints: Position[] = [
        { x: generatorPos.x + 102, y: generatorPos.y + genHeight },
        { x: generatorPos.x + 102, y: groundY + 40 },
        { x: barrierX + 10, y: groundY + 40 },
        { x: barrierX + 10, y: groundY },
      ];

      drawWires(ctx, redWirePoints, blueWirePoints, gameState.level2.combatRobotDisabled, gameState.level2.barrierActive);

      if (gameState.level2.wireAnimationActive !== "none") {
        const wirePoints = gameState.level2.wireAnimationActive === "robot" ? redWirePoints : blueWirePoints;
        const wireColor = gameState.level2.wireAnimationActive === "robot" ? "#fef08a" : "#93c5fd";
        drawWireAnimation(ctx, wirePoints, wireColor, gameState.level2.wireAnimationProgress);
      }

      const showTerminal2Hint = isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 2) &&
        gameState.spawnPhase === "ready" &&
        !gameState.level2.playerDead &&
        (!gameState.level2.combatRobotDisabled || gameState.level2.barrierActive) &&
        gameState.level2.wireAnimationActive === "none";
      drawTerminal(ctx, level2TerminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminal2Hint);

      if (gameState.level2.barrierActive) {
        drawBarrier(ctx, barrierX, groundY, gameState.level2.barrierTimeLeft, BARRIER_MAX_TIME, gameState.level2.combatRobotDisabled);
      }

      drawBullets(ctx, gameState.level2.bullets, BULLET_WIDTH, BULLET_HEIGHT);

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

      drawCombatSparks(ctx, gameState.level2.sparks);

      const exitActive = gameState.level2.combatRobotDisabled && !gameState.level2.barrierActive;
      drawExit(ctx, level2ExitPos, EXIT_WIDTH, EXIT_HEIGHT, exitActive);

      drawStartZone(ctx, groundY);
    } else if (gameState.currentLevel === 3) {
      drawLevel3Platforms(ctx, gameState.level3.platforms);

      const showTerminal3Hint =
        isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 3) &&
        gameState.spawnPhase === "ready";
      drawTerminal(ctx, level3TerminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminal3Hint);

      drawExit(ctx, level3ExitPos, EXIT_WIDTH, EXIT_HEIGHT, true);

      drawStartZone(ctx, groundY);
    } else if (gameState.currentLevel === 4) {
      drawLevel3Platforms(ctx, gameState.level4.platforms);

      const leverA = level4Layout.leverA;
      const leverB = level4Layout.leverB;

      if (leverA) {
        ctx.fillStyle = gameState.level4.leverA ? "#22c55e" : "#6b7280";
        ctx.fillRect(leverA.x, leverA.y, 30, 30);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("A", leverA.x + 15, leverA.y + 20);
      }

      if (leverB) {
        ctx.fillStyle = gameState.level4.leverB ? "#22c55e" : "#6b7280";
        ctx.fillRect(leverB.x, leverB.y, 30, 30);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText("B", leverB.x + 15, leverB.y + 20);
      }

      if (level4Layout.barrierX !== null) {
        const barrierActive =
          level4Layout.gate === "FINAL"
            ? !gameState.level4.puzzleSolved
            : !level4GateOutput;
        if (barrierActive) {
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(level4Layout.barrierX, 80);
          ctx.lineTo(level4Layout.barrierX, groundY - 20);
          ctx.stroke();
        }
      }

      if (level4Layout.terminalPos) {
        const showTerminal4Hint =
          isNearTerminal(gameState.playerPos.x, gameState.playerPos.y, 4) &&
          gameState.spawnPhase === "ready";
        drawTerminal(ctx, level4Layout.terminalPos, TERMINAL_WIDTH, TERMINAL_HEIGHT, showTerminal4Hint);
      }

      const exitActive =
        level4Layout.gate === "FINAL" ? gameState.level4.puzzleSolved : level4GateOutput;
      drawExit(ctx, level4Layout.exitPos, EXIT_WIDTH, EXIT_HEIGHT, exitActive);

      drawStartZone(ctx, groundY);
    } else if (gameState.currentLevel === 5) {
      // Station hull and compartments
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 90, CANVAS_WIDTH, groundY - 110);

      const compartmentBands = [
        { x: 40, y: groundY - 190, w: 300, h: 130, label: "Тех. отсек A" },
        { x: 360, y: groundY - 270, w: 300, h: 150, label: "Генераторная" },
        { x: 680, y: groundY - 350, w: 300, h: 170, label: "Сектор C" },
        { x: 980, y: groundY - 440, w: 300, h: 190, label: "Жизнеобеспечение" },
      ];

      compartmentBands.forEach((band, index) => {
        ctx.fillStyle = index % 2 === 0 ? "#1f2937" : "#273449";
        ctx.fillRect(band.x, band.y, band.w, band.h);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(band.x, band.y, band.w, band.h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.fillText(band.label, band.x + 14, band.y + 24);
      });

      gameState.level3.platforms.forEach((platform) => {
        ctx.fillStyle = "#475569";
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(platform.x + 8, platform.y + 5, platform.width - 16, platform.height - 10);
        ctx.fillStyle = "#38bdf8";
        for (let offset = 12; offset < platform.width - 12; offset += 26) {
          ctx.fillRect(platform.x + offset, platform.y + platform.height - 5, 12, 3);
        }
      });

      // Damaged cables
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      const cableSegments = [
        [
          { x: 250, y: groundY - 220 },
          { x: 300, y: groundY - 240 },
          { x: 350, y: groundY - 210 },
          { x: 390, y: groundY - 260 },
        ],
        [
          { x: 820, y: groundY - 380 },
          { x: 860, y: groundY - 340 },
          { x: 900, y: groundY - 370 },
          { x: 940, y: groundY - 330 },
        ],
      ];
      cableSegments.forEach((segment) => {
        ctx.beginPath();
        ctx.moveTo(segment[0].x, segment[0].y);
        segment.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.stroke();
      });

      // Generators and oxygen modules
      ctx.fillStyle = gameState.station.solved.generator ? "#22c55e" : "#f59e0b";
      ctx.fillRect(520, groundY - 240, 70, 70);
      ctx.fillStyle = "#0f172a";
      ctx.fillText("GEN", 536, groundY - 198);

      ctx.fillStyle = gameState.station.solved.life_support ? "#22c55e" : "#38bdf8";
      ctx.fillRect(1100, groundY - 405, 70, 84);
      ctx.fillStyle = "#0f172a";
      ctx.fillText("O2", 1122, groundY - 358);

      // Emergency lamps
      stationTerminals.forEach((terminal) => {
        const solved = gameState.station.solved[terminal.id];
        ctx.fillStyle = solved ? "#22c55e" : "#ef4444";
        ctx.beginPath();
        ctx.arc(terminal.pos.x + 24, terminal.pos.y - 16, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Terminals
      stationTerminals.forEach((terminal) => {
        const nearbyTerminal = getNearbyStationTerminal(
          gameState.playerPos.x,
          gameState.playerPos.y
        );
        drawTerminal(
          ctx,
          terminal.pos,
          TERMINAL_WIDTH,
          TERMINAL_HEIGHT,
          nearbyTerminal?.id === terminal.id && gameState.spawnPhase === "ready"
        );
      });

      // Airlock doors
      stationDoors.forEach((door) => {
        ctx.fillStyle = door.open ? "#22c55e" : "#ef4444";
        ctx.fillRect(door.x, door.y, door.width, door.height);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(door.label, door.x + door.width / 2, door.y - 8);
      });

      const exitActive = gameState.station.solved.final_airlock;
      drawExit(ctx, stationExitPos, EXIT_WIDTH, EXIT_HEIGHT, exitActive);
      drawStartZone(ctx, groundY);
    } else if (gameState.currentLevel === 6) {
      // Monitor frame
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(120, 80, 860, 560);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 6;
      ctx.strokeRect(120, 80, 860, 560);

      const { grid } = gameState.level5;
      grid.forEach((row, y) => {
        row.forEach((cell, x) => {
          const px = LEVEL5_GRID_OFFSET.x + x * LEVEL5_CELL_SIZE;
          const py = LEVEL5_GRID_OFFSET.y + y * LEVEL5_CELL_SIZE;
          ctx.fillStyle = cell === "#" ? "#1f2937" : "#111827";
          ctx.fillRect(px, py, LEVEL5_CELL_SIZE, LEVEL5_CELL_SIZE);
          ctx.strokeStyle = "#1e293b";
          ctx.strokeRect(px, py, LEVEL5_CELL_SIZE, LEVEL5_CELL_SIZE);

          if (cell === "K") {
            ctx.font = "24px Arial";
            ctx.fillStyle = "#facc15";
            ctx.fillText("🔑", px + 16, py + 36);
          } else if (cell === "D") {
            ctx.font = "24px Arial";
            ctx.fillStyle = "#38bdf8";
            ctx.fillText("🚪", px + 16, py + 36);
          } else if (cell === "!") {
            ctx.font = "24px Arial";
            ctx.fillStyle = "#f43f5e";
            ctx.fillText("⚠️", px + 14, py + 34);
          } else if (cell === "S") {
            ctx.font = "18px Arial";
            ctx.fillStyle = "#f8fafc";
            ctx.fillText("S", px + 22, py + 34);
          }
        });
      });

      // Robot
      const robotCellX = LEVEL5_GRID_OFFSET.x + gameState.level5.robotPos.x * LEVEL5_CELL_SIZE;
      const robotCellY = LEVEL5_GRID_OFFSET.y + gameState.level5.robotPos.y * LEVEL5_CELL_SIZE;
      const robotX = robotCellX + LEVEL5_CELL_SIZE / 2;
      const robotY = robotCellY + LEVEL5_CELL_SIZE / 2;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.strokeRect(robotCellX + 4, robotCellY + 4, LEVEL5_CELL_SIZE - 8, LEVEL5_CELL_SIZE - 8);
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(robotX, robotY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      const dirSymbol =
        gameState.level5.direction === "N"
          ? "↑"
          : gameState.level5.direction === "S"
          ? "↓"
          : gameState.level5.direction === "E"
          ? "→"
          : "←";
      ctx.fillText(dirSymbol, robotX, robotY + 5);
    } else if (gameState.currentLevel === 7) {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      for (let index = 0; index < 90; index += 1) {
        const x = (index * 149) % CANVAS_WIDTH;
        const y = (index * 97) % CANVAS_HEIGHT;
        ctx.fillStyle = index % 3 === 0 ? "#38bdf8" : "#f8fafc";
        ctx.globalAlpha = 0.25 + (index % 5) * 0.12;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(160, 220, 76, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.arc(160, 220, 36, 0, Math.PI * 2);
      ctx.fill();

      SATELLITE_POSITIONS.forEach((satellitePos, index) => {
        const active = index < getSatelliteStageTargetCount(gameState.satellite.stage);
        const repaired = index < gameState.satellite.repairedCount;
        ctx.strokeStyle = active ? "#334155" : "#1e293b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(180, 220);
        ctx.lineTo(satellitePos.x - 40, satellitePos.y);
        ctx.stroke();

        ctx.fillStyle = repaired ? "#22c55e" : active ? "#475569" : "#1f2937";
        ctx.fillRect(satellitePos.x - 44, satellitePos.y - 34, 88, 68);
        ctx.strokeStyle = repaired ? "#86efac" : "#64748b";
        ctx.strokeRect(satellitePos.x - 44, satellitePos.y - 34, 88, 68);

        ctx.fillStyle = repaired ? "#bbf7d0" : "#facc15";
        ctx.fillRect(satellitePos.x - 14, satellitePos.y - 10, 28, 20);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(String(index + 1), satellitePos.x, satellitePos.y + 4);

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "12px Arial";
        ctx.fillText(
          repaired ? "Сигнал OK" : active ? "Повреждён" : "Резерв",
          satellitePos.x,
          satellitePos.y + 52
        );
      });

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(gameState.satellite.dronePos.x, gameState.satellite.dronePos.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#082f49";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      const droneDirectionSymbol =
        gameState.satellite.droneDirection === "N"
          ? "↑"
          : gameState.satellite.droneDirection === "S"
          ? "↓"
          : gameState.satellite.droneDirection === "E"
          ? "→"
          : "←";
      ctx.fillText(droneDirectionSymbol, gameState.satellite.dronePos.x, gameState.satellite.dronePos.y + 5);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Орбитальная карта ремонта", 36, 56);
      ctx.fillText("Планета связи", 98, 286);
    }

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
    } else if (
      !gameState.level2.playerDead &&
      gameState.currentLevel !== 6 &&
      gameState.currentLevel !== 7
    ) {
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

    drawLevelLabel(ctx, gameState.currentLevel);

  }, [
    gameState,
    isNearTerminal,
    robotPos,
    terminalPos,
    exitPos,
    level2ExitPos,
    level3ExitPos,
    combatRobotPos,
    level2TerminalPos,
    level3TerminalPos,
    groundY,
    barrierX,
    generatorPos,
    stationTerminals,
    stationDoors,
    stationExitPos,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = e.target.value.replace(/[^01]/g, "");
    setGameState((prev) => ({ ...prev, terminalInput: filtered }));
  };

  const handleRestart = () => {
    setGameState(initGameState(gameState.currentLevel));
    keysPressed.current.clear();
  };

  const handleNextLevel = (nextLevel: number) => {
    setGameState(initGameState(nextLevel));
    keysPressed.current.clear();
  };

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
    if (
      gameState.currentLevel === 3 ||
      gameState.currentLevel === 4 ||
      gameState.currentLevel === 5 ||
      gameState.currentLevel === 6
    ) {
      return "";
    }
    if (gameState.level2.terminalTarget === "robot") {
      return "(красный провод - РОБОТ)";
    }
    return "(синий провод - БАРЬЕР)";
  };

  const togglePuzzleRow = (key: "00" | "01" | "10" | "11") => {
    setGameState((prev) => ({
      ...prev,
      level4: {
        ...prev.level4,
        puzzleSelections: {
          ...prev.level4.puzzleSelections,
          [key]: !prev.level4.puzzleSelections[key],
        },
      },
    }));
  };

  const checkPuzzleSolution = () => {
    const correct = { "00": false, "01": true, "10": true, "11": false };
    const isCorrect =
      gameState.level4.puzzleSelections["00"] === correct["00"] &&
      gameState.level4.puzzleSelections["01"] === correct["01"] &&
      gameState.level4.puzzleSelections["10"] === correct["10"] &&
      gameState.level4.puzzleSelections["11"] === correct["11"];

    setGameState((prev) => ({
      ...prev,
      showTerminal: isCorrect ? false : prev.showTerminal,
      terminalMessage: isCorrect
        ? "Верно! Дверь открыта."
        : "Есть ошибки. Проверь строки.",
      terminalMessageType: isCorrect ? "success" : "error",
      level4: {
        ...prev.level4,
        puzzleSolved: isCorrect ? true : prev.level4.puzzleSolved,
      },
      currentGoal: isCorrect ? "Дойди до выхода" : prev.currentGoal,
    }));
  };

  const selectStationOperand = (
    side: "left" | "right",
    operand: StationOperand
  ) => {
    setGameState((prev) => ({
      ...prev,
      station: {
        ...prev.station,
        builder: {
          ...prev.station.builder,
          [side]: operand,
        },
        feedback: "",
        feedbackType: "",
      },
    }));
  };

  const setStationOperator = (operator: "AND" | "OR" | null) => {
    setGameState((prev) => ({
      ...prev,
      station: {
        ...prev.station,
        builder: {
          ...prev.station.builder,
          operator,
        },
        feedback: "",
        feedbackType: "",
      },
    }));
  };

  const toggleStationNot = (side: "left" | "right") => {
    setGameState((prev) => ({
      ...prev,
      station: {
        ...prev.station,
        builder: {
          ...prev.station.builder,
          [side === "left" ? "notLeft" : "notRight"]:
            !prev.station.builder[side === "left" ? "notLeft" : "notRight"],
        },
        feedback: "",
        feedbackType: "",
      },
    }));
  };

  const checkStationCondition = () => {
    if (!activeStationTerminal) return;

    const builder = gameState.station.builder;
    const correct = activeStationTerminal.correct;
    const isCorrect =
      builder.left === correct.left &&
      builder.right === correct.right &&
      builder.operator === correct.operator &&
      builder.notLeft === correct.notLeft &&
      builder.notRight === correct.notRight;

    setGameState((prev) => {
      const nextSolved = isCorrect
        ? { ...prev.station.solved, [activeStationTerminal.id]: true }
        : prev.station.solved;

      return {
        ...prev,
        showTerminal: isCorrect ? false : prev.showTerminal,
        currentGoal: isCorrect ? getNextStationGoal(nextSolved) : prev.currentGoal,
        station: {
          ...prev.station,
          solved: nextSolved,
          feedback: isCorrect
            ? "Система активирована. Проход открыт."
            : activeStationTerminal.explanation,
          feedbackType: isCorrect ? "success" : "error",
          activeTerminal: isCorrect ? null : prev.station.activeTerminal,
          builder: isCorrect ? { ...EMPTY_STATION_BUILDER } : prev.station.builder,
        },
      };
    });
  };

  const addLevel5Command = useCallback((command: "F" | "L" | "R") => {
    level5ErrorHandledRef.current = false;
    setGameState((prev) => {
      if (prev.currentLevel !== 6) return prev;
      if (prev.level5.running) return prev;
      if (prev.level5.program.length >= prev.level5.maxCommands) return prev;

      const freshGrid = buildLevel5Grid();
      const start = findGridCell(freshGrid, "S");
      return {
        ...prev,
        currentGoal: "Запрограммируй робота: ключ → дверь",
        level5: {
          ...prev.level5,
          grid: freshGrid,
          program: [...prev.level5.program, command],
          robotPos: start,
          direction: "E",
          hasKey: false,
          stepIndex: 0,
          running: false,
          message: "",
          messageType: "",
        },
      };
    });
  }, []);

  const removeLevel5Command = useCallback(() => {
    level5ErrorHandledRef.current = false;
    setGameState((prev) => {
      if (prev.currentLevel !== 6) return prev;
      if (prev.level5.running) return prev;
      if (prev.level5.program.length === 0) return prev;

      const freshGrid = buildLevel5Grid();
      const start = findGridCell(freshGrid, "S");
      const nextProgram = prev.level5.program.slice(0, -1);
      return {
        ...prev,
        currentGoal: "Запрограммируй робота: ключ → дверь",
        level5: {
          ...prev.level5,
          grid: freshGrid,
          program: nextProgram,
          robotPos: start,
          direction: "E",
          hasKey: false,
          stepIndex: 0,
          running: false,
          message: "",
          messageType: "",
        },
      };
    });
  }, []);

  const clearLevel5Program = useCallback(() => {
    level5ErrorHandledRef.current = false;
    setGameState((prev) => {
      if (prev.currentLevel !== 6) return prev;
      if (prev.level5.running) return prev;

      const freshGrid = buildLevel5Grid();
      const start = findGridCell(freshGrid, "S");
      return {
        ...prev,
        currentGoal: "Запрограммируй робота: ключ → дверь",
        level5: {
          ...prev.level5,
          grid: freshGrid,
          program: [],
          robotPos: start,
          direction: "E",
          hasKey: false,
          stepIndex: 0,
          running: false,
          message: "",
          messageType: "",
        },
      };
    });
  }, []);

  const resetLevel5Robot = useCallback(() => {
    level5ErrorHandledRef.current = false;
    if (level5RunRef.current) {
      clearInterval(level5RunRef.current);
      level5RunRef.current = null;
    }
    if (level5ResetRef.current) {
      clearTimeout(level5ResetRef.current);
      level5ResetRef.current = null;
    }
    setGameState((prev) => {
      const freshGrid = buildLevel5Grid();
      const start = findGridCell(freshGrid, "S");
      return {
        ...prev,
        currentGoal: "Запрограммируй робота: ключ → дверь",
        level5: {
          ...prev.level5,
          grid: freshGrid,
          robotPos: start,
          direction: "E",
          hasKey: false,
          stepIndex: 0,
          running: false,
          message: "",
          messageType: "",
          messageTimer: 0,
        },
      };
    });
  }, []);


  const failLevel5 = useCallback((message: string) => {
    if (level5ErrorHandledRef.current) return;
    level5ErrorHandledRef.current = true;
    if (level5RunRef.current) {
      clearInterval(level5RunRef.current);
      level5RunRef.current = null;
    }
    setGameState((prev) => ({
      ...prev,
      level5: {
        ...prev.level5,
        running: false,
        message,
        messageType: "error",
      },
    }));
    if (level5ResetRef.current) {
      clearTimeout(level5ResetRef.current);
    }
    level5ResetRef.current = setTimeout(() => {
      resetLevel5Robot();
    }, 1200);
  }, [resetLevel5Robot]);

  const completeLevel5 = useCallback(() => {
    if (level5RunRef.current) {
      clearInterval(level5RunRef.current);
      level5RunRef.current = null;
    }
    setGameState((prev) => ({
      ...prev,
      level5: {
        ...prev.level5,
        running: false,
        message: "Уровень пройден!",
        messageType: "success",
      },
      currentGoal: "Уровень пройден",
      levelComplete: true,
      levelCompletePhase: "transition",
      levelCompleteOpacity: 1,
    }));
  }, []);

  const executeLevel5Step = useCallback(() => {
    setGameState((prev) => {
      if (prev.level5.messageType === "error" || prev.level5.messageType === "success") {
        return prev;
      }
      const { program, stepIndex, grid } = prev.level5;
      const height = grid.length;
      const width = grid[0]?.length ?? 0;
      let nextGrid = grid;

      if (stepIndex >= program.length) {
        if (prev.level5.hasKey && grid[prev.level5.robotPos.y][prev.level5.robotPos.x] === "D") {
          return prev;
        }
        return {
          ...prev,
          level5: {
            ...prev.level5,
            running: false,
            message: "Алгоритм неполный",
            messageType: "error",
          },
        };
      }

      const command = program[stepIndex];
      let { direction } = prev.level5;
      let { robotPos } = prev.level5;
      let hasKey = prev.level5.hasKey;

      if (command === "L") {
        direction =
          direction === "N" ? "W" : direction === "W" ? "S" : direction === "S" ? "E" : "N";
      } else if (command === "R") {
        direction =
          direction === "N" ? "E" : direction === "E" ? "S" : direction === "S" ? "W" : "N";
      } else if (command === "F") {
        const delta =
          direction === "N"
            ? { x: 0, y: -1 }
            : direction === "S"
            ? { x: 0, y: 1 }
            : direction === "E"
            ? { x: 1, y: 0 }
            : { x: -1, y: 0 };
        const nextPos = { x: robotPos.x + delta.x, y: robotPos.y + delta.y };
        if (nextPos.x < 0 || nextPos.y < 0 || nextPos.x >= width || nextPos.y >= height) {
          return {
            ...prev,
            level5: {
              ...prev.level5,
              running: false,
              message: "Ошибка: столкновение",
              messageType: "error",
            },
          };
        }
        const cell = grid[nextPos.y][nextPos.x];
        if (cell === "#") {
          return {
            ...prev,
            level5: {
              ...prev.level5,
              running: false,
              message: "Ошибка: столкновение",
              messageType: "error",
            },
          };
        }
        if (cell === "!") {
          return {
            ...prev,
            level5: {
              ...prev.level5,
              running: false,
              message: "Ошибка: ловушка",
              messageType: "error",
            },
          };
        }
        robotPos = nextPos;
        if (cell === "K") {
          hasKey = true;
          nextGrid = grid.map((row) => [...row]);
          nextGrid[nextPos.y][nextPos.x] = ".";
        }
      }

      return {
        ...prev,
        level5: {
          ...prev.level5,
          grid: nextGrid,
          robotPos,
          direction,
          hasKey,
          stepIndex: prev.level5.stepIndex + 1,
        },
      };
    });
  }, []);

  const handleLevel5Run = useCallback(() => {
    level5ErrorHandledRef.current = false;
    if (level5ResetRef.current) {
      clearTimeout(level5ResetRef.current);
      level5ResetRef.current = null;
    }
    setGameState((prev) => {
      if (prev.currentLevel !== 6) return prev;
      if (prev.level5.program.length === 0) return prev;

      if (prev.level5.running) {
        return {
          ...prev,
          level5: {
            ...prev.level5,
            running: false,
          },
        };
      }

      const shouldReset =
        prev.level5.stepIndex >= prev.level5.program.length || prev.level5.messageType !== "";
      const freshGrid = shouldReset ? buildLevel5Grid() : prev.level5.grid;
      const start = findGridCell(freshGrid, "S");

      return {
        ...prev,
        currentGoal: "Запрограммируй робота: ключ → дверь",
        level5: {
          ...prev.level5,
          running: true,
          message: "",
          messageType: "",
          ...(shouldReset
            ? {
                grid: freshGrid,
                robotPos: start,
                direction: "E",
                hasKey: false,
                stepIndex: 0,
              }
            : {}),
        },
      };
    });
  }, []);

  const handleLevel5Step = useCallback(() => {
    if (gameState.currentLevel !== 6) return;
    if (gameState.level5.running) return;
    if (gameState.level5.program.length === 0) return;
    if (level5ResetRef.current) {
      clearTimeout(level5ResetRef.current);
      level5ResetRef.current = null;
    }
    level5ErrorHandledRef.current = false;
    executeLevel5Step();
  }, [gameState.currentLevel, gameState.level5.running, gameState.level5.program.length, executeLevel5Step]);

  const handleLevel5Reset = useCallback(() => {
    resetLevel5Robot();
  }, [resetLevel5Robot]);

  useEffect(() => {
    if (gameState.currentLevel !== 6) return;

    if (gameState.level5.messageType === "error" && gameState.level5.message) {
      failLevel5(gameState.level5.message);
      return;
    }

    const cell = gameState.level5.grid[gameState.level5.robotPos.y][gameState.level5.robotPos.x];
    if (gameState.level5.hasKey && cell === "D") {
      completeLevel5();
      return;
    }

    if (
      !gameState.level5.running &&
      gameState.level5.stepIndex >= gameState.level5.program.length &&
      gameState.level5.program.length > 0
    ) {
      if (!gameState.level5.hasKey || cell !== "D") {
        failLevel5("Алгоритм неполный");
      }
    }
  }, [
    gameState.currentLevel,
    gameState.level5.messageType,
    gameState.level5.message,
    gameState.level5.robotPos,
    gameState.level5.grid,
    gameState.level5.hasKey,
    gameState.level5.running,
    gameState.level5.stepIndex,
    gameState.level5.program.length,
    failLevel5,
    completeLevel5,
  ]);

  useEffect(() => {
    if (gameState.currentLevel !== 6) return;

    if (gameState.level5.running) {
      if (level5RunRef.current) return;
      level5RunRef.current = setInterval(() => {
        executeLevel5Step();
      }, 600);
    } else if (level5RunRef.current) {
      clearInterval(level5RunRef.current);
      level5RunRef.current = null;
    }

    return () => {
      if (level5RunRef.current) {
        clearInterval(level5RunRef.current);
        level5RunRef.current = null;
      }
    };
  }, [gameState.currentLevel, gameState.level5.running, executeLevel5Step]);

  useEffect(() => {
    if (gameState.currentLevel === 6) return;
    if (level5RunRef.current) {
      clearInterval(level5RunRef.current);
      level5RunRef.current = null;
    }
    if (level5ResetRef.current) {
      clearTimeout(level5ResetRef.current);
      level5ResetRef.current = null;
    }
    level5ErrorHandledRef.current = false;
  }, [gameState.currentLevel]);

  useEffect(() => {
    return () => {
      if (level5RunRef.current) {
        clearInterval(level5RunRef.current);
        level5RunRef.current = null;
      }
      if (level5ResetRef.current) {
        clearTimeout(level5ResetRef.current);
        level5ResetRef.current = null;
      }
    };
  }, []);

  const completeSatelliteStage = useCallback(() => {
    const currentStage = gameState.satellite.stage;
    if (satelliteRunRef.current) {
      clearInterval(satelliteRunRef.current);
      satelliteRunRef.current = null;
    }

    if (currentStage < 3) {
      const nextStage = (currentStage + 1) as 2 | 3;
      setGameState((prev) => ({
        ...prev,
        satellite: {
          ...prev.satellite,
          running: false,
          stageMessage:
            nextStage === 2
              ? "Отлично. Теперь почини три спутника и попробуй использовать Повторить."
              : "Теперь сократи длинный алгоритм: замени повторяющиеся группы блоком Повторить.",
          stageMessageType: "success",
        },
        levelComplete: true,
        levelCompletePhase: "transition",
        levelCompleteOpacity: 1,
      }));
      return;
    }

    setGameState((prev) => ({
      ...prev,
      satellite: {
        ...prev.satellite,
        running: false,
        stageMessage: "Все спутники снова в сети.",
        stageMessageType: "success",
      },
      currentGoal: "Уровень пройден",
      levelComplete: true,
      levelCompletePhase: "showButton",
      levelCompleteOpacity: 1,
    }));
  }, [gameState.satellite.stage]);

  const executeSatelliteStep = useCallback(() => {
    setGameState((prev) => {
      if (prev.currentLevel !== 7) return prev;

      const flatProgram = flattenSatelliteProgram(prev.satellite.program);
      if (flatProgram.length === 0) {
        return {
          ...prev,
          satellite: {
            ...prev.satellite,
            running: false,
            stageMessage: "Сначала собери программу.",
            stageMessageType: "error",
          },
        };
      }

      if (prev.satellite.totalActions >= flatProgram.length) {
        const needsRepeat = prev.satellite.stage !== 1;
        const repairedEnough =
          prev.satellite.repairedCount >= getSatelliteStageTargetCount(prev.satellite.stage);
        const compressedEnough =
          prev.satellite.stage !== 3 ||
          countSatelliteCommands(prev.satellite.program) < getStage3LongProgram().length;

        if (!repairedEnough) {
          return {
            ...prev,
            satellite: {
              ...prev.satellite,
              running: false,
              stageMessage: "Не все спутники отремонтированы. Проверь последовательность.",
              stageMessageType: "error",
            },
          };
        }

        if (needsRepeat && !hasSatelliteRepeat(prev.satellite.program)) {
          return {
            ...prev,
            satellite: {
              ...prev.satellite,
              running: false,
              stageMessage: "Здесь выгодно использовать блок Повторить.",
              stageMessageType: "error",
            },
          };
        }

        if (!compressedEnough) {
          return {
            ...prev,
            satellite: {
              ...prev.satellite,
              running: false,
              stageMessage: "Алгоритм всё ещё длинный. Сократи повторяющиеся команды.",
              stageMessageType: "error",
            },
          };
        }

        return {
          ...prev,
          satellite: {
            ...prev.satellite,
            running: false,
          },
          levelComplete: true,
          levelCompletePhase: prev.satellite.stage === 3 ? "showButton" : "transition",
          levelCompleteOpacity: 1,
        };
      }

      const { command, repeatIndex } = flatProgram[prev.satellite.totalActions];
      const targetCount = getSatelliteStageTargetCount(prev.satellite.stage);
      let nextDirection = prev.satellite.droneDirection;
      let nextPos = prev.satellite.dronePos;
      let nextSatellite = prev.satellite.currentSatellite;
      let docked = prev.satellite.docked;
      let openPanel = prev.satellite.openPanel;
      let replacedCurrent = prev.satellite.replacedCurrent;
      let repairedCount = prev.satellite.repairedCount;
      let stageMessage = "";
      let stageMessageType: "error" | "success" | "" = "";

      const fail = (message: string) => ({
        ...prev,
        satellite: {
          ...prev.satellite,
          running: false,
          currentCommandId: command.id,
          currentRepeat: repeatIndex,
          stageMessage: message,
          stageMessageType: "error" as const,
        },
      });

      if (command.type === "left") {
        nextDirection =
          nextDirection === "N"
            ? "W"
            : nextDirection === "W"
            ? "S"
            : nextDirection === "S"
            ? "E"
            : "N";
      } else if (command.type === "right") {
        nextDirection =
          nextDirection === "N"
            ? "E"
            : nextDirection === "E"
            ? "S"
            : nextDirection === "S"
            ? "W"
            : "N";
      } else if (command.type === "forward") {
        if (nextDirection !== "E") {
          return fail("Дрон сбился с маршрута. Для подлёта к спутникам разверни его вправо.");
        }
        if (nextSatellite >= targetCount) {
          return fail("Все нужные спутники уже достигнуты.");
        }
        nextSatellite += 1;
        nextPos = SATELLITE_POSITIONS[nextSatellite - 1];
        docked = false;
        openPanel = false;
        replacedCurrent = false;
        stageMessage = `Дрон подлетел к спутнику ${nextSatellite}.`;
        stageMessageType = "success";
      } else if (command.type === "dock") {
        if (nextSatellite === 0) {
          return fail("Сначала подлети к спутнику.");
        }
        docked = true;
        stageMessage = `Дрон стабилизировался у спутника ${nextSatellite}.`;
        stageMessageType = "success";
      } else if (command.type === "open") {
        if (!docked) {
          return fail("Нельзя открыть панель на лету. Сначала остановись у спутника.");
        }
        openPanel = true;
      } else if (command.type === "replace") {
        if (!openPanel) {
          return fail("Панель закрыта. Сначала открой её.");
        }
        replacedCurrent = true;
      } else if (command.type === "close") {
        if (!openPanel) {
          return fail("Нечего закрывать: панель ещё не открыта.");
        }
        if (!replacedCurrent) {
          return fail("Сначала замени энергетический модуль.");
        }
        openPanel = false;
      } else if (command.type === "signal") {
        if (nextSatellite === 0 || !docked || openPanel || !replacedCurrent) {
          return fail("Сигнал проверки можно отправить только после ремонта и закрытия панели.");
        }
        repairedCount = Math.max(repairedCount, nextSatellite);
        docked = false;
        replacedCurrent = false;
        stageMessage = `Спутник ${nextSatellite} снова передаёт сигнал.`;
        stageMessageType = "success";
      }

      return {
        ...prev,
        satellite: {
          ...prev.satellite,
          droneDirection: nextDirection,
          dronePos: nextPos,
          currentSatellite: nextSatellite,
          docked,
          openPanel,
          replacedCurrent,
          repairedCount,
          currentCommandId: command.id,
          currentRepeat: repeatIndex,
          totalActions: prev.satellite.totalActions + 1,
          stageMessage,
          stageMessageType,
        },
      };
    });
  }, [flattenSatelliteProgram]);

  const handleSatelliteRun = useCallback(() => {
    setGameState((prev) => {
      if (prev.currentLevel !== 7) return prev;
      if (prev.satellite.program.length === 0) return prev;

      return {
        ...prev,
        currentGoal: getSatelliteStageGoal(prev.satellite.stage),
        satellite: {
          ...prev.satellite,
          running: !prev.satellite.running,
          currentCommandId: prev.satellite.running ? prev.satellite.currentCommandId : null,
          currentSatellite: prev.satellite.running ? prev.satellite.currentSatellite : 0,
          currentRepeat: prev.satellite.running ? prev.satellite.currentRepeat : 0,
          totalActions: prev.satellite.running ? prev.satellite.totalActions : 0,
          repairedCount: prev.satellite.running ? prev.satellite.repairedCount : 0,
          docked: false,
          openPanel: false,
          replacedCurrent: false,
          stageMessage: "",
          stageMessageType: "",
          droneDirection: "E",
          dronePos: SATELLITE_BASE_POS,
        },
      };
    });
  }, []);

  const handleSatelliteStep = useCallback(() => {
    if (gameState.currentLevel !== 7 || gameState.satellite.running) return;
    executeSatelliteStep();
  }, [gameState.currentLevel, gameState.satellite.running, executeSatelliteStep]);

  const handleSatelliteReset = useCallback(() => {
    resetSatelliteStage(gameState.satellite.stage, { keepProgram: true });
  }, [gameState.satellite.stage, resetSatelliteStage]);

  useEffect(() => {
    if (gameState.currentLevel !== 7) return;

    if (!gameState.levelComplete && !gameState.satellite.running) {
      const flatProgram = flattenSatelliteProgram(gameState.satellite.program);
      const targetCount = getSatelliteStageTargetCount(gameState.satellite.stage);
      const compressedEnough =
        gameState.satellite.stage !== 3 ||
        countSatelliteCommands(gameState.satellite.program) < getStage3LongProgram().length;

      if (
        flatProgram.length > 0 &&
        gameState.satellite.totalActions >= flatProgram.length &&
        gameState.satellite.repairedCount >= targetCount &&
        (gameState.satellite.stage === 1 || hasSatelliteRepeat(gameState.satellite.program)) &&
        compressedEnough
      ) {
        completeSatelliteStage();
      }
    }
  }, [
    gameState.currentLevel,
    gameState.levelComplete,
    gameState.satellite.running,
    gameState.satellite.totalActions,
    gameState.satellite.repairedCount,
    gameState.satellite.stage,
    gameState.satellite.program,
    flattenSatelliteProgram,
    completeSatelliteStage,
  ]);

  useEffect(() => {
    if (gameState.currentLevel !== 7) return;

    if (gameState.satellite.running) {
      if (satelliteRunRef.current) return;
      satelliteRunRef.current = setInterval(() => {
        executeSatelliteStep();
      }, 700);
    } else if (satelliteRunRef.current) {
      clearInterval(satelliteRunRef.current);
      satelliteRunRef.current = null;
    }

    return () => {
      if (satelliteRunRef.current) {
        clearInterval(satelliteRunRef.current);
        satelliteRunRef.current = null;
      }
    };
  }, [gameState.currentLevel, gameState.satellite.running, executeSatelliteStep]);

  useEffect(() => {
    if (gameState.currentLevel === 7) return;
    if (satelliteRunRef.current) {
      clearInterval(satelliteRunRef.current);
      satelliteRunRef.current = null;
    }
  }, [gameState.currentLevel]);

  const level4TruthRows =
    level4Layout.gate !== "FINAL"
      ? [
          { key: "00", a: 0, b: 0, out: getLevel4GateOutput(level4Layout.gate, false, false) ? 1 : 0 },
          { key: "01", a: 0, b: 1, out: getLevel4GateOutput(level4Layout.gate, false, true) ? 1 : 0 },
          { key: "10", a: 1, b: 0, out: getLevel4GateOutput(level4Layout.gate, true, false) ? 1 : 0 },
          { key: "11", a: 1, b: 1, out: getLevel4GateOutput(level4Layout.gate, true, true) ? 1 : 0 },
        ]
      : [];
  const level4CurrentRowKey = `${gameState.level4.leverA ? 1 : 0}${gameState.level4.leverB ? 1 : 0}`;
  const level4GateLabel = level4Layout.gate === "FINAL" ? "ФИНАЛ" : level4Layout.gate;
  const stationSolvedCount = Object.values(gameState.station.solved).filter(Boolean).length;
  const level5DirectionLabel =
    gameState.level5.direction === "N"
      ? "↑"
      : gameState.level5.direction === "S"
      ? "↓"
      : gameState.level5.direction === "E"
      ? "→"
      : "←";
  const levelMeta = getLevelMeta(gameState.currentLevel);
  const helperPlayerState = {
    collectedItems: [
      ...(gameState.level5.hasKey ? ["ключ"] : []),
      ...(gameState.station.solved.generator ? ["энергия"] : []),
      ...(gameState.station.solved.life_support ? ["кислородный модуль"] : []),
    ],
    currentError:
      gameState.terminalMessage ||
      gameState.station.feedback ||
      gameState.level5.message ||
      gameState.satellite.stageMessage ||
      gameState.level2.deathReason ||
      "",
    status:
      gameState.currentLevel === 4
        ? `A=${gameState.level4.leverA ? 1 : 0}, B=${gameState.level4.leverB ? 1 : 0}`
        : gameState.currentLevel === 6
        ? `Команд в программе: ${gameState.level5.program.length}`
        : gameState.currentLevel === 7
        ? `Отремонтировано спутников: ${gameState.satellite.repairedCount}`
        : "",
  };
  const satelliteFlatProgram = flattenSatelliteProgram(gameState.satellite.program);
  const satelliteProgramLimit = getSatelliteProgramLimit(gameState.satellite.stage);
  const renderSatelliteCommands = (
    commands: SatelliteCommand[],
    depth = 0
  ): ReactNode => {
    if (commands.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
          {depth === 0 ? "Здесь появятся команды" : "Внутрь блока можно добавлять команды"}
        </div>
      );
    }

    return commands.map((command, index) => {
      const meta = SATELLITE_COMMAND_META[command.type];
      const isSelected =
        command.type === "repeat" && gameState.satellite.selectedRepeatId === command.id;
      const isActive = gameState.satellite.currentCommandId === command.id;

      return (
        <div
          key={command.id}
          className={`rounded-xl border ${
            isActive
              ? "border-cyan-400 bg-cyan-500/10"
              : isSelected
              ? "border-violet-400 bg-violet-500/10"
              : "border-slate-700 bg-slate-900/60"
          }`}
          style={{ marginLeft: depth * 14 }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${meta.color}`}>
              {meta.short}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">
                {index + 1}. {meta.label}
              </div>
              {command.type === "repeat" && (
                <div className="text-xs text-violet-300">
                  Повторить {command.repeatCount ?? 2} раза
                </div>
              )}
            </div>
            {command.type === "repeat" && (
              <>
                <select
                  value={command.repeatCount ?? 2}
                  onChange={(e) =>
                    updateSatelliteRepeatCount(
                      command.id,
                      Number(e.target.value) as 2 | 3 | 4 | 5
                    )
                  }
                  className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
                >
                  {[2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      x{count}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    setGameState((prev) => ({
                      ...prev,
                      satellite: {
                        ...prev.satellite,
                        selectedRepeatId:
                          prev.satellite.selectedRepeatId === command.id ? null : command.id,
                      },
                    }))
                  }
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    isSelected ? "bg-violet-500 text-white" : "bg-slate-700 text-slate-200"
                  }`}
                >
                  {isSelected ? "Корень" : "Внутрь"}
                </button>
              </>
            )}
            <button
              onClick={() => removeSatelliteCommand(command.id)}
              className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
            >
              Удалить
            </button>
          </div>

          {command.type === "repeat" && (
            <div className="px-3 pb-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                Повторяемые действия
              </div>
              <div className="space-y-2">
                {renderSatelliteCommands(command.children ?? [], depth + 1)}
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-lg border-4 border-slate-700 shadow-2xl"
      />

      {/* Кнопка выхода */}
      <button
        onClick={() => setShowExitConfirm(true)}
        className="absolute top-4 left-4 z-10 rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
      >
        Выход [Esc]
      </button>

      <LevelAIHelper
        levelId={gameState.currentLevel}
        levelTitle={levelMeta.title}
        topic={levelMeta.topic}
        currentTask={gameState.currentGoal}
        knowledgeLevel={knowledgeLevel ?? null}
        playerState={helperPlayerState}
      />

      {gameState.currentLevel === 6 && (
        <div className="absolute left-4 bottom-24 z-10 w-[360px] rounded-xl border border-slate-600 bg-slate-800/90 p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-cyan-400">Пульт оператора</h3>
            <span className="text-xs text-slate-400">
              {gameState.level5.program.length}/{gameState.level5.maxCommands}
            </span>
          </div>

          <div className="mb-2 text-xs text-slate-400">Программа</div>
          <div className="mb-3 flex min-h-[44px] flex-wrap gap-2 rounded-lg bg-slate-900/60 p-2">
            {gameState.level5.program.length === 0 && (
              <span className="text-xs text-slate-500">Добавь команды F/L/R</span>
            )}
            {gameState.level5.program.map((cmd, index) => {
              const isActive = index === gameState.level5.stepIndex;
              const isDone = index < gameState.level5.stepIndex;
              return (
                <div
                  key={`${cmd}-${index}`}
                  className={`flex h-8 w-8 items-center justify-center rounded text-sm font-bold ${
                    isActive
                      ? "bg-cyan-500 text-slate-900"
                      : isDone
                      ? "bg-slate-600 text-slate-200"
                      : "bg-slate-700 text-white"
                  }`}
                >
                  {cmd}
                </div>
              );
            })}
          </div>

          <div className="mb-2 grid grid-cols-3 gap-2">
            {(["F", "L", "R"] as const).map((cmd) => {
              const disabled =
                gameState.level5.running ||
                gameState.level5.program.length >= gameState.level5.maxCommands;
              return (
                <button
                  key={cmd}
                  onClick={() => addLevel5Command(cmd)}
                  disabled={disabled}
                  className={`rounded-lg py-2 text-sm font-bold transition-colors ${
                    disabled
                      ? "cursor-not-allowed bg-slate-700 text-slate-500"
                      : "bg-cyan-600 text-white hover:bg-cyan-500"
                  }`}
                >
                  {cmd}
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={removeLevel5Command}
              disabled={gameState.level5.running || gameState.level5.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                gameState.level5.running || gameState.level5.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-slate-600 text-white hover:bg-slate-500"
              }`}
            >
              ⌫ Удалить
            </button>
            <button
              onClick={clearLevel5Program}
              disabled={gameState.level5.running || gameState.level5.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                gameState.level5.running || gameState.level5.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-slate-600 text-white hover:bg-slate-500"
              }`}
            >
              Очистить
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={handleLevel5Run}
              disabled={gameState.level5.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                gameState.level5.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : gameState.level5.running
                  ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                  : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              {gameState.level5.running ? "Стоп" : "Run"}
            </button>
            <button
              onClick={handleLevel5Step}
              disabled={gameState.level5.running || gameState.level5.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                gameState.level5.running || gameState.level5.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              Step
            </button>
            <button
              onClick={handleLevel5Reset}
              className="flex-1 rounded-lg bg-slate-600 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-500"
            >
              Reset
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span>
              Позиция: ({gameState.level5.robotPos.x + 1},{gameState.level5.robotPos.y + 1})
            </span>
            <span>Напр: {level5DirectionLabel}</span>
            <span>Ключ: {gameState.level5.hasKey ? "✓" : "—"}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Шаг {Math.min(gameState.level5.stepIndex + 1, gameState.level5.program.length)}/
            {gameState.level5.program.length}
          </div>

          {gameState.level5.message && (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                gameState.level5.messageType === "error"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-green-500/10 text-green-300"
              }`}
            >
              {gameState.level5.message}
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            Алгоритм выполняется последовательно, команда за командой.
          </p>
        </div>
      )}

      {gameState.currentLevel === 7 && (
        <div className="absolute left-4 bottom-10 z-10 w-[480px] rounded-xl border border-slate-600 bg-slate-800/90 p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-cyan-400">Пульт ремонтного дрона</h3>
              <p className="text-xs text-slate-400">
                Задание {gameState.satellite.stage}/3
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>
                Команд: {countSatelliteCommands(gameState.satellite.program)}/{satelliteProgramLimit}
              </div>
              <div>
                Спутников: {gameState.satellite.repairedCount}/{getSatelliteStageTargetCount(gameState.satellite.stage)}
              </div>
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">Программа</span>
              {gameState.satellite.selectedRepeatId && (
                <button
                  onClick={() =>
                    setGameState((prev) => ({
                      ...prev,
                      satellite: { ...prev.satellite, selectedRepeatId: null },
                    }))
                  }
                  className="rounded-md bg-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-600"
                >
                  Добавлять в корень
                </button>
              )}
            </div>
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {renderSatelliteCommands(gameState.satellite.program)}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                "forward",
                "left",
                "right",
                "dock",
                "open",
                "replace",
                "close",
                "signal",
                "repeat",
              ] as const
            ).map((type) => (
              <button
                key={type}
                onClick={() => addSatelliteCommand(type)}
                disabled={gameState.satellite.running}
                className={`rounded-lg px-2 py-2 text-xs font-semibold text-white transition-colors ${
                  gameState.satellite.running
                    ? "cursor-not-allowed bg-slate-700 text-slate-500"
                    : SATELLITE_COMMAND_META[type].color
                }`}
              >
                {SATELLITE_COMMAND_META[type].label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={clearSatelliteProgram}
              disabled={gameState.satellite.running}
              className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                gameState.satellite.running
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-slate-600 text-white hover:bg-slate-500"
              }`}
            >
              Очистить
            </button>
            {gameState.satellite.stage === 3 && (
              <button
                onClick={restoreSatelliteLongProgram}
                disabled={gameState.satellite.running}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  gameState.satellite.running
                    ? "cursor-not-allowed bg-slate-700 text-slate-500"
                    : "bg-violet-600 text-white hover:bg-violet-500"
                }`}
              >
                Вернуть длинный пример
              </button>
            )}
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={handleSatelliteRun}
              disabled={gameState.satellite.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                gameState.satellite.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : gameState.satellite.running
                  ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                  : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              {gameState.satellite.running ? "Стоп" : "Run"}
            </button>
            <button
              onClick={handleSatelliteStep}
              disabled={gameState.satellite.running || gameState.satellite.program.length === 0}
              className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                gameState.satellite.running || gameState.satellite.program.length === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-500"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              Step
            </button>
            <button
              onClick={handleSatelliteReset}
              className="flex-1 rounded-lg bg-slate-600 py-2 text-sm font-bold text-white hover:bg-slate-500"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>Текущая команда: {gameState.satellite.currentCommandId ? satelliteFlatProgram.findIndex((item) => item.command.id === gameState.satellite.currentCommandId) + 1 : 0}/{satelliteFlatProgram.length}</div>
            <div>Повтор: {gameState.satellite.currentRepeat || "—"}</div>
            <div>Спутник: {gameState.satellite.currentSatellite || "—"}</div>
            <div>Действий: {gameState.satellite.totalActions}</div>
          </div>

          {gameState.satellite.stageMessage && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                gameState.satellite.stageMessageType === "error"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-green-500/10 text-green-300"
              }`}
            >
              {gameState.satellite.stageMessage}
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-500">
            Если действия повторяются, их можно поместить в блок «Повторить».
          </p>
        </div>
      )}

      {/* Панель задания */}
      <div className="absolute top-4 right-4 z-10">
        {gameState.taskPanelExpanded ? (
          <div className="w-80 rounded-lg bg-slate-800 p-4 text-white shadow-xl border border-slate-600">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-yellow-400">
                {gameState.currentLevel === 1
                  ? "Задание"
                  : gameState.currentLevel === 2
                  ? "ВНИМАНИЕ: Боевая зона!"
                  : gameState.currentLevel === 3
                  ? "Задание"
                  : gameState.currentLevel === 4
                  ? "Логические ворота"
                  : gameState.currentLevel === 5
                  ? "Авария на станции"
                  : gameState.currentLevel === 6
                  ? "Робот-доставщик"
                  : "Ремонт спутников"}
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
                {difficulty.hintsEnabled && (
                  <div className="rounded bg-slate-700 p-2 text-xs">
                    <p className="text-slate-300">Напоминание:</p>
                    <p className="font-mono text-green-400">13₍₁₀₎ = 1101₍₂₎</p>
                  </div>
                )}
              </>
            ) : gameState.currentLevel === 2 ? (
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
                {difficulty.hintsEnabled && (
                  <p className="text-xs text-yellow-300">
                    Подсказка: сначала отключи угрозу, потом — защиту!
                  </p>
                )}
              </>
            ) : gameState.currentLevel === 3 ? (
              <>
                <p className="mb-3 text-sm">
                  Красные платформы неактивны. Найди номер на платформе, переведи его в двоичный код и введи в терминал.
                </p>
                <p className="mb-3 text-sm text-yellow-300">
                  Активируй платформы и поднимись на верхний этаж к выходу.
                </p>
                {difficulty.hintsEnabled && (
                  <div className="rounded bg-slate-700 p-2 text-xs">
                    <p className="text-slate-300">Напоминание:</p>
                    <p className="font-mono text-green-400">8₍₁₀₎ = 1000₍₂₎</p>
                  </div>
                )}
              </>
            ) : gameState.currentLevel === 4 ? (
              <>
                <p className="mb-2 text-sm">
                  Логические ворота:{" "}
                  <span className="font-bold text-cyan-400">{level4GateLabel}</span>
                </p>
                {level4Layout.gate === "FINAL" ? (
                  <p className="mb-3 text-sm text-yellow-300">
                    Реши задачу на таблицу истинности, чтобы открыть финальную дверь.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm">
                      Переключай рычаги A и B. Открой дверь, когда выход схемы = 1.
                    </p>
                    <div className="rounded bg-slate-700 p-2 text-xs">
                      <div className="grid grid-cols-3 gap-2 text-center text-slate-300">
                        <span>A</span>
                        <span>B</span>
                        <span>{level4GateLabel}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {level4TruthRows.map((row) => (
                          <div
                            key={row.key}
                            className={`grid grid-cols-3 gap-2 text-center ${
                              level4CurrentRowKey === row.key
                                ? "rounded bg-cyan-600/40 text-white"
                                : "text-slate-300"
                            }`}
                          >
                            <span>{row.a}</span>
                            <span>{row.b}</span>
                            <span>{row.out}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : gameState.currentLevel === 5 ? (
              <>
                <p className="mb-2 text-sm">
                  Восстанови системы станции через терминалы и доберись до выходного шлюза.
                </p>
                <p className="mb-3 text-sm text-yellow-300">
                  Логика уровня: И — оба условия, ИЛИ — достаточно одного, НЕ — условие должно быть ложным.
                </p>
                <p className="text-xs text-slate-400">
                  Восстановлено систем: {stationSolvedCount}/5
                </p>
              </>
            ) : gameState.currentLevel === 6 ? (
              <>
                <p className="mb-2 text-sm">
                  Программируй робота командами. Сначала возьми ключ, затем дойди до двери.
                </p>
                <p className="mb-3 text-sm text-yellow-300">
                  Алгоритм выполняется последовательно, шаг за шагом.
                </p>
                <p className="text-xs text-slate-400">
                  Лимит программы: {gameState.level5.maxCommands} команд.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 text-sm">
                  Запрограммируй ремонтного дрона и восстанови спутники на орбите.
                </p>
                <p className="mb-3 text-sm text-yellow-300">
                  Задание {gameState.satellite.stage}: {getSatelliteStageGoal(gameState.satellite.stage)}.
                </p>
                <p className="text-xs text-slate-400">
                  Следи за повторяющимися действиями и выноси их в блок «Повторить».
                </p>
              </>
            )}
            {gameState.currentLevel === 6 ? (
              <div className="mt-3 text-xs text-slate-400">
                <p>F — шаг вперёд</p>
                <p>L/R — поворот</p>
                <p>Run — автозапуск, Step — шаг, Reset — сброс</p>
              </div>
            ) : gameState.currentLevel === 7 ? (
              <div className="mt-3 text-xs text-slate-400">
                <p>Повтори одинаковые группы действий</p>
                <p>Внутрь блока «Повторить» можно вкладывать команды</p>
                <p>Run — автозапуск, Step — пошаговая проверка</p>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-400">
                <p>A/D или ←/→ — движение</p>
                <p>Space — прыжок</p>
                <p>E — взаимодействие</p>
              </div>
            )}
          </div>
        ) : (
          <div className="cursor-pointer rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600">
            Задание [Tab]
          </div>
        )}
      </div>

      {gameState.currentLevel === 5 && !gameState.station.tutorialSeen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75">
          <div className="w-[620px] rounded-2xl border-2 border-cyan-500 bg-slate-900 p-8 text-white shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-cyan-400">
              Авария на космической станции
            </h2>
            <p className="mb-6 text-sm text-slate-300">
              Станция повреждена после удара метеорита. Придётся собирать логические условия на терминалах и поэтапно возвращать системы в строй.
            </p>
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                <span className="font-bold text-cyan-300">И</span> — должны выполняться оба условия
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                <span className="font-bold text-cyan-300">ИЛИ</span> — достаточно одного условия
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                <span className="font-bold text-cyan-300">НЕ</span> — условие не должно выполняться
              </div>
            </div>
            <button
              onClick={() =>
                setGameState((prev) => ({
                  ...prev,
                  station: {
                    ...prev.station,
                    tutorialSeen: true,
                  },
                }))
              }
              className="mt-6 w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500"
            >
              Начать восстановление
            </button>
          </div>
        </div>
      )}

      {gameState.currentLevel === 7 && !gameState.satellite.tutorialSeen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75">
          <div className="w-[620px] rounded-2xl border-2 border-cyan-500 bg-slate-900 p-8 text-white shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-cyan-400">
              Ремонт спутников
            </h2>
            <p className="mb-6 text-sm text-slate-300">
              Несколько спутников потеряли связь. Твоя задача — собрать алгоритм ремонта для дрона и заметить, где действия повторяются.
            </p>
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-200">
              <span className="font-bold text-cyan-300">Подсказка:</span> если действия повторяются, их можно поместить в блок «Повторить».
            </div>
            <button
              onClick={() =>
                setGameState((prev) => ({
                  ...prev,
                  satellite: {
                    ...prev.satellite,
                    tutorialSeen: true,
                    stageMessage: "Сначала почини один спутник, затем используй Повторить для серии ремонтов.",
                    stageMessageType: "success",
                  },
                }))
              }
              className="mt-6 w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500"
            >
              Начать ремонт
            </button>
          </div>
        </div>
      )}

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

      {/* Переход на следующий уровень */}
      {gameState.levelCompletePhase === "transition" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border-2 border-green-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-400 mb-4">
              {gameState.currentLevel === 7
                ? `Задание ${gameState.satellite.stage} выполнено!`
                : `Уровень ${gameState.currentLevel} пройден!`}
            </h2>
            <p className="mb-6 text-slate-300">
              {gameState.currentLevel === 1
                ? `Ты успешно перевёл ${gameState.targetNumber}₍₁₀₎ в двоичную систему!`
                : gameState.currentLevel === 2
                ? "Отличная работа! Пора испытать навыки на платформах."
                : gameState.currentLevel === 3
                ? "Теперь попробуй логические ворота."
                : gameState.currentLevel === 4
                ? "Станция ждёт инженера. Пора разбирать аварийную логику."
                : gameState.currentLevel === 5
                ? "Теперь проверь себя в алгоритмах и командах."
                : gameState.currentLevel === 6
                ? "Следующий шаг — повторяющиеся алгоритмы и ремонт спутников."
                : gameState.satellite.stage === 1
                ? "Теперь почини сразу три одинаковых спутника."
                : "Осталось сократить длинный алгоритм с помощью блока Повторить."}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  if (gameState.currentLevel === 7) {
                    const nextStage = (gameState.satellite.stage + 1) as 2 | 3;
                    resetSatelliteStage(nextStage, {
                      keepProgram: false,
                      stageMessage:
                        nextStage === 2
                          ? "Задание 2: почини три одинаковых спутника. Игра подсказывает использовать Повторить."
                          : "Задание 3: длинный алгоритм загружен. Сократи его через Повторить.",
                      stageMessageType: "success",
                    });
                    setGameState((prev) => ({
                      ...prev,
                      levelComplete: false,
                      levelCompletePhase: "none",
                    }));
                    return;
                  }
                  handleNextLevel(gameState.currentLevel + 1);
                }}
                className="rounded-lg bg-green-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-green-500"
              >
                {gameState.currentLevel === 7
                  ? `Перейти к заданию ${gameState.satellite.stage + 1}`
                  : `Перейти на уровень ${gameState.currentLevel + 1}`}
              </button>
              <button
                onClick={onExit}
                className="rounded-lg bg-slate-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-slate-500"
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Кнопка перезапуска (финальный уровень) */}
      {gameState.levelCompletePhase === "showButton" && gameState.currentLevel === 7 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border-2 border-green-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-green-400 mb-4">Поздравляем!</h2>
            <p className="mb-6 text-slate-300">
              Ты успешно прошёл все уровни и освоил основы информатики!
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setGameState(initGameState(1))}
                className="rounded-lg bg-green-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-green-500"
              >
                Играть снова
              </button>
              <button
                onClick={onExit}
                className="rounded-lg bg-slate-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-slate-500"
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Смерть игрока */}
      {gameState.level2.playerDead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="rounded-2xl border-2 border-red-500 bg-slate-800 p-10 text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-red-500 mb-4">ПРОВАЛ</h2>
            <p className="mb-6 text-slate-300">{gameState.level2.deathReason}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRestart}
                className="rounded-lg bg-red-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-red-500"
              >
                Попробовать снова
              </button>
              <button
                onClick={onExit}
                className="rounded-lg bg-slate-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-slate-500"
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Терминал */}
      {gameState.showTerminal && gameState.currentLevel === 4 && gameState.level4.stage === 4 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="relative w-[440px] rounded-xl border-2 border-cyan-500 bg-slate-800 p-6 shadow-2xl">
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

            <h2 className="mb-2 text-xl font-bold text-cyan-400">
              Таблица истинности
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              Правило: F = (A AND NOT B) OR (NOT A AND B)
            </p>

            <div className="mb-4 rounded-lg border border-slate-600 bg-slate-900">
              {[
                { key: "00", a: 0, b: 0 },
                { key: "01", a: 0, b: 1 },
                { key: "10", a: 1, b: 0 },
                { key: "11", a: 1, b: 1 },
              ].map((row) => {
                const selected = gameState.level4.puzzleSelections[row.key as "00" | "01" | "10" | "11"];
                return (
                  <button
                    key={row.key}
                    onClick={() => togglePuzzleRow(row.key as "00" | "01" | "10" | "11")}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                      selected ? "bg-cyan-600 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span>
                      {row.a} {row.b}
                    </span>
                    <span>{selected ? "✅" : ""}</span>
                  </button>
                );
              })}
            </div>

            {gameState.terminalMessage && gameState.terminalMessageType === "error" && (
              <p className="mb-2 font-medium text-red-400">{gameState.terminalMessage}</p>
            )}
            {gameState.terminalMessage && gameState.terminalMessageType === "success" && (
              <p className="mb-2 font-medium text-green-400">{gameState.terminalMessage}</p>
            )}

            <button
              onClick={checkPuzzleSolution}
              className="w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500"
            >
              Проверить
            </button>
          </div>
        </div>
      ) : gameState.showTerminal && gameState.currentLevel === 5 && activeStationTerminal ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="relative w-[760px] rounded-xl border-2 border-cyan-500 bg-slate-800 p-6 shadow-2xl">
            <button
              onClick={() =>
                setGameState((prev) => ({
                  ...prev,
                  showTerminal: false,
                  station: {
                    ...prev.station,
                    activeTerminal: null,
                    builder: { ...EMPTY_STATION_BUILDER },
                    feedback: "",
                    feedbackType: "",
                  },
                }))
              }
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="mb-2 text-xl font-bold text-cyan-400">
              {activeStationTerminal.title}
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              {activeStationTerminal.description}
            </p>

            <div className="mb-4 rounded-xl border border-slate-600 bg-slate-900 p-4">
              <div className="mb-3 text-xs uppercase tracking-wide text-slate-400">
                Собери условие
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <button
                    onClick={() => toggleStationNot("left")}
                    className={`mb-3 w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                      gameState.station.builder.notLeft
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    НЕ
                  </button>
                  <div className="grid gap-2">
                    {activeStationTerminal.palette.map((operand) => (
                      <button
                        key={`left-${operand}`}
                        onClick={() => selectStationOperand("left", operand)}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          gameState.station.builder.left === operand
                            ? "border-cyan-400 bg-cyan-500/15 text-white"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <div className="text-xs text-slate-400">{STATION_OPERAND_META[operand].icon}</div>
                        <div className="text-sm font-semibold">{STATION_OPERAND_META[operand].label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-2">
                  <button
                    onClick={() => setStationOperator("AND")}
                    className={`rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                      gameState.station.builder.operator === "AND"
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    И
                  </button>
                  <button
                    onClick={() => setStationOperator("OR")}
                    className={`rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                      gameState.station.builder.operator === "OR"
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    ИЛИ
                  </button>
                  <button
                    onClick={() => setStationOperator(null)}
                    className={`rounded-lg px-4 py-3 text-sm font-bold transition-colors ${
                      gameState.station.builder.operator === null
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    Без оператора
                  </button>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <button
                    onClick={() => toggleStationNot("right")}
                    disabled={activeStationTerminal.correct.right === null}
                    className={`mb-3 w-full rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                      activeStationTerminal.correct.right === null
                        ? "cursor-not-allowed bg-slate-700 text-slate-500"
                        : gameState.station.builder.notRight
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    НЕ
                  </button>
                  <div className="grid gap-2">
                    {activeStationTerminal.palette.map((operand) => (
                      <button
                        key={`right-${operand}`}
                        onClick={() => selectStationOperand("right", operand)}
                        disabled={activeStationTerminal.correct.right === null}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          activeStationTerminal.correct.right === null
                            ? "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600"
                            : gameState.station.builder.right === operand
                            ? "border-cyan-400 bg-cyan-500/15 text-white"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <div className="text-xs text-slate-400">{STATION_OPERAND_META[operand].icon}</div>
                        <div className="text-sm font-semibold">{STATION_OPERAND_META[operand].label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {gameState.station.feedback && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                  gameState.station.feedbackType === "success"
                    ? "bg-green-500/10 text-green-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {gameState.station.feedback}
              </div>
            )}

            <button
              onClick={checkStationCondition}
              className="w-full rounded-lg bg-cyan-600 py-3 font-bold text-white transition-colors hover:bg-cyan-500"
            >
              Проверить условие
            </button>
          </div>
        </div>
      ) : gameState.showTerminal ? (
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
            {gameState.currentLevel === 3 ? (
              <p className="mb-2 text-slate-300">
                Введите двоичный код номера платформы:
              </p>
            ) : (
              <p className="mb-2 text-slate-300">
                Введите число{" "}
                <span className="font-bold text-yellow-400">{getTerminalNumber()}</span>{" "}
                в двоичной системе:
              </p>
            )}

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
            {gameState.terminalMessage && gameState.terminalMessageType === "success" && (
              <p className="mb-2 font-medium text-green-400">{gameState.terminalMessage}</p>
            )}

            <p className="text-xs text-slate-500">
              Допустимы только символы 0 и 1. Enter для отправки, Esc или ✕ для выхода.
            </p>
          </div>
        </div>
      ) : null}

      {/* Подтверждение выхода */}
      {showExitConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="rounded-2xl border-2 border-slate-500 bg-slate-800 p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">Выйти в меню?</h2>
            <p className="mb-6 text-slate-300">Прогресс текущего уровня будет потерян.</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={onExit}
                className="rounded-lg bg-red-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-red-500"
              >
                Выйти
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="rounded-lg bg-slate-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-slate-500"
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
