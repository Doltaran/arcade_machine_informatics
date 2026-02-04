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
}
