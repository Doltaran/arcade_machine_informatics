import type { GameState, Position } from "./types";
import { updateLevel1, checkLevel1RobotCollision, checkLevel1Exit, type Level1Config } from "./levels/level1";
import { updateLevel2, checkLevel2BarrierCollision, checkLevel2Exit, type Level2Config } from "./levels/level2";

// ==================== GAME CONSTANTS ====================
export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 900;
export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 52;
export const PLAYER_SPEED = 1;
export const JUMP_FORCE = 8;
export const GRAVITY = 0.6;
export const ROBOT_WIDTH = 60;
export const ROBOT_HEIGHT = 80;
export const EXIT_WIDTH = 60;
export const EXIT_HEIGHT = 90;
export const GROUND_HEIGHT = 80;
export const BARRIER_MAX_TIME = 15000;
export const BULLET_SPEED = 4;
export const BULLET_WIDTH = 20;
export const BULLET_HEIGHT = 8;
export const COMBAT_ROBOT_WIDTH = 80;
export const COMBAT_ROBOT_HEIGHT = 100;
export const SHOOT_INTERVAL = 1200;

// ==================== INPUT STATE ====================
export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

// ==================== WORLD CONFIG ====================
export interface WorldConfig {
  robotPos: Position;
  exitPos: Position;
  combatRobotPos: Position;
  level2ExitPos: Position;
  barrierX: number;
  groundY: number;
}

// ==================== UPDATE GAME ====================
export function updateGame(
  prev: GameState,
  input: InputState,
  deltaTime: number,
  world: WorldConfig
): GameState {
  if (prev.showTerminal) {
    return prev;
  }

  const newState: GameState = {
    ...prev,
    level2: { ...prev.level2 },
  };

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

  // ==================== LEVEL-SPECIFIC UPDATES ====================
  const level1Config: Level1Config = {
    robotPos: world.robotPos,
    exitPos: world.exitPos,
    groundY: world.groundY,
  };

  const level2Config: Level2Config = {
    combatRobotPos: world.combatRobotPos,
    exitPos: world.level2ExitPos,
    barrierX: world.barrierX,
    groundY: world.groundY,
  };

  if (newState.currentLevel === 1) {
    updateLevel1(newState, deltaTime, level1Config);
  } else if (newState.currentLevel === 2) {
    updateLevel2(newState, deltaTime, level2Config);
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

  if (input.left) {
    newX -= PLAYER_SPEED;
    moving = true;
    facingRight = false;
  }
  if (input.right) {
    newX += PLAYER_SPEED;
    moving = true;
    facingRight = true;
  }

  if (input.jump && grounded) {
    newVelY = -JUMP_FORCE;
    grounded = false;
  }

  newVelY += GRAVITY;
  newY += newVelY;

  if (newY + PLAYER_HEIGHT >= world.groundY) {
    newY = world.groundY - PLAYER_HEIGHT;
    newVelY = 0;
    grounded = true;
  }

  if (newX < 0) newX = 0;
  if (newX + PLAYER_WIDTH > CANVAS_WIDTH) newX = CANVAS_WIDTH - PLAYER_WIDTH;

  // ==================== LEVEL-SPECIFIC COLLISIONS ====================
  if (newState.currentLevel === 1) {
    newX = checkLevel1RobotCollision(newX, newY, newState.playerPos.x, newState.robotColliderActive, level1Config);
  } else if (newState.currentLevel === 2) {
    newX = checkLevel2BarrierCollision(newX, newState.playerPos.x, newState.level2.barrierActive, world.barrierX);
  }

  // ==================== CHECK EXIT ====================
  let reachedExit = false;
  if (newState.currentLevel === 1) {
    reachedExit = checkLevel1Exit(newX, newY, newState.robotColliderActive, level1Config);
  } else if (newState.currentLevel === 2) {
    reachedExit = checkLevel2Exit(newX, newY, newState.level2.combatRobotDisabled, newState.level2.barrierActive, level2Config);
  }

  if (reachedExit) {
    newState.levelComplete = true;
    newState.levelCompletePhase = "fadeIn";
    newState.levelCompleteOpacity = 0;
    newState.robotFlashCount = 0;
  }

  newState.playerPos = { x: newX, y: newY };
  newState.playerVelocityY = newVelY;
  newState.isGrounded = grounded;
  newState.isMoving = moving;
  newState.facingRight = facingRight;

  return newState;
}
