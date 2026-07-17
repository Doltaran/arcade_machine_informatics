export interface Position {
  x: number;
  y: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface SpawnParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
}

export interface NarratorMessage {
  text: string;
  duration: number;
  timer: number;
}

// Электрическая частица для анимации провода
export interface WireParticle {
  x: number;
  y: number;
  progress: number; // 0-1 прогресс по проводу
  color: string;
}

export interface Level3Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  number: number;
  active: boolean;
}

export type StationTerminalId =
  | "airlock"
  | "generator"
  | "sector"
  | "life_support"
  | "final_airlock";

export type StationOperand =
  | "pressure"
  | "seal"
  | "generator_broken"
  | "battery_low"
  | "air_leak"
  | "power"
  | "oxygen"
  | "life_support"
  | "alarm";

export type StationOperator = "AND" | "OR" | null;

export type SatelliteCommandType =
  | "forward"
  | "left"
  | "right"
  | "dock"
  | "open"
  | "replace"
  | "close"
  | "signal"
  | "repeat";

export interface SatelliteCommand {
  id: string;
  type: SatelliteCommandType;
  repeatCount?: 2 | 3 | 4 | 5;
  children?: SatelliteCommand[];
 }

export interface GameState {
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
  level3: {
    platforms: Level3Platform[];
  };
  level4: {
    stage: 1 | 2 | 3 | 4;
    leverA: boolean;
    leverB: boolean;
    platforms: Level3Platform[];
    puzzleSelections: {
      "00": boolean;
      "01": boolean;
      "10": boolean;
      "11": boolean;
    };
    puzzleSolved: boolean;
  };
  station: {
    tutorialSeen: boolean;
    activeTerminal: StationTerminalId | null;
    solved: Record<StationTerminalId, boolean>;
    builder: {
      left: StationOperand | null;
      right: StationOperand | null;
      operator: StationOperator;
      notLeft: boolean;
      notRight: boolean;
    };
    feedback: string;
    feedbackType: "error" | "success" | "";
  };
  level5: {
    grid: string[][];
    robotPos: Position;
    direction: "N" | "E" | "S" | "W";
    hasKey: boolean;
    program: ("F" | "L" | "R")[];
    stepIndex: number;
    running: boolean;
    message: string;
    messageType: "error" | "success" | "";
    messageTimer: number;
    maxCommands: number;
  };
  satellite: {
    tutorialSeen: boolean;
    stage: 1 | 2 | 3;
    program: SatelliteCommand[];
    selectedRepeatId: string | null;
    running: boolean;
    currentCommandId: string | null;
    currentSatellite: number;
    currentRepeat: number;
    totalActions: number;
    repairedCount: number;
    docked: boolean;
    openPanel: boolean;
    replacedCurrent: boolean;
    stageMessage: string;
    stageMessageType: "error" | "success" | "";
    droneDirection: "E" | "N" | "W" | "S";
    dronePos: Position;
  };
}
