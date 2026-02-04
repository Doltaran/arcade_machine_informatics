import type { GameState, Spark, Position } from "../types";
import {
  ROBOT_WIDTH,
  ROBOT_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  EXIT_WIDTH,
  EXIT_HEIGHT,
} from "../engine";

export interface Level1Config {
  robotPos: Position;
  exitPos: Position;
  groundY: number;
}

export function updateLevel1(
  state: GameState,
  deltaTime: number,
  config: Level1Config
): GameState {
  // ==================== ROBOT ANIMATION ====================
  if (state.robotAnimationPhase === "flashing") {
    const flashInterval = 100;
    const totalFlashes = 6;
    state.robotFlashCount += deltaTime / flashInterval;
    state.robotFlashOn = Math.floor(state.robotFlashCount) % 2 === 0;
    if (state.robotFlashCount >= totalFlashes) {
      state.robotAnimationPhase = "sparks";
      state.robotFlashOn = false;
      const newSparks: Spark[] = [];
      for (let i = 0; i < 12; i++) {
        newSparks.push({
          x: config.robotPos.x + ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 40,
          y: config.robotPos.y + 20 + Math.random() * 30,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 6 - 2,
          life: 1,
        });
      }
      state.sparks = newSparks;
    }
  } else if (state.robotAnimationPhase === "sparks") {
    const updatedSparks = state.sparks
      .map((s) => ({
        ...s,
        x: s.x + s.vx,
        y: s.y + s.vy,
        vy: s.vy + 0.3,
        life: s.life - deltaTime / 500,
      }))
      .filter((s) => s.life > 0);
    state.sparks = updatedSparks;
    if (updatedSparks.length === 0) {
      state.robotAnimationPhase = "collapse";
    }
  } else if (state.robotAnimationPhase === "collapse") {
    state.robotCollapseOffset += deltaTime * 0.05;
    if (state.robotCollapseOffset >= 15) {
      state.robotCollapseOffset = 15;
      state.robotAnimationPhase = "done";
      state.robotColliderActive = false;
    }
  }

  return state;
}

export function checkLevel1RobotCollision(
  playerX: number,
  playerY: number,
  prevPlayerX: number,
  robotColliderActive: boolean,
  config: Level1Config
): number {
  if (!robotColliderActive) return playerX;

  const playerRect = {
    left: playerX,
    right: playerX + PLAYER_WIDTH,
    top: playerY,
    bottom: playerY + PLAYER_HEIGHT,
  };
  const robotRect = {
    left: config.robotPos.x,
    right: config.robotPos.x + ROBOT_WIDTH,
    top: config.robotPos.y,
    bottom: config.robotPos.y + ROBOT_HEIGHT,
  };

  if (
    playerRect.left < robotRect.right &&
    playerRect.right > robotRect.left &&
    playerRect.top < robotRect.bottom &&
    playerRect.bottom > robotRect.top
  ) {
    if (prevPlayerX < config.robotPos.x) {
      return robotRect.left - PLAYER_WIDTH;
    } else {
      return robotRect.right;
    }
  }

  return playerX;
}

export function checkLevel1Exit(
  playerX: number,
  playerY: number,
  robotColliderActive: boolean,
  config: Level1Config
): boolean {
  if (robotColliderActive) return false;

  const playerCenter = {
    x: playerX + PLAYER_WIDTH / 2,
    y: playerY + PLAYER_HEIGHT / 2,
  };

  return (
    playerCenter.x > config.exitPos.x &&
    playerCenter.x < config.exitPos.x + EXIT_WIDTH &&
    playerCenter.y > config.exitPos.y &&
    playerCenter.y < config.exitPos.y + EXIT_HEIGHT
  );
}
