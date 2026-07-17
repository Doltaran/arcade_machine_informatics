import type { GameState, Position } from "./types";
import { updateLevel1, checkLevel1RobotCollision, checkLevel1Exit, type Level1Config } from "./levels/level1";
import { updateLevel2, checkLevel2BarrierCollision, checkLevel2Exit, type Level2Config } from "./levels/level2";
import { checkLevel3Exit, checkLevel3PlatformLanding, type Level3Config } from "./levels/level3";
import {
  checkLevel4BarrierCollision,
  checkLevel4Exit,
  getLevel4GateOutput,
  getLevel4Layout,
  getLevel4Platforms,
  type Level4Gate,
} from "./levels/level4";
import { checkStationDoorCollision, checkStationExit, getStationDoors } from "./levels/level5";

// ==================== GAME CONSTANTS ====================
export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 900;
export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 52;
export const PLAYER_SPEED = 3;
export const JUMP_FORCE = 25;
export const GRAVITY = 1;
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
  level3ExitPos: Position;
  level5ExitPos: Position;
  groundY: number;
  barrierX: number;
}

// ==================== UPDATE GAME ====================
export function updateGame(
  prev: GameState,
  input: InputState,
  deltaTime: number,
  world: WorldConfig
): GameState {
  if (prev.currentLevel === 6 || prev.currentLevel === 7) {
    return prev;
  }

  if (prev.showTerminal) {
    return prev;
  }

  const newState: GameState = {
    ...prev,
    level2: { ...prev.level2 },
    level3: {
      ...prev.level3,
      platforms: prev.level3.platforms.map((platform) => ({ ...platform })),
    },
    level4: {
      ...prev.level4,
      platforms: prev.level4.platforms.map((platform) => ({ ...platform })),
      puzzleSelections: { ...prev.level4.puzzleSelections },
    },
    station: {
      ...prev.station,
      solved: { ...prev.station.solved },
      builder: { ...prev.station.builder },
    },
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
  const level3Config: Level3Config = {
    exitPos: world.level3ExitPos,
  };
  const level4Layout = getLevel4Layout(newState.level4.stage, world.groundY);

  if (newState.currentLevel === 1) {
    updateLevel1(newState, deltaTime, level1Config);
  } else if (newState.currentLevel === 2) {
    updateLevel2(newState, deltaTime, level2Config);
  } else if (newState.currentLevel === 4) {
    const gateOutput = getLevel4GateOutput(
      level4Layout.gate as Level4Gate,
      newState.level4.leverA,
      newState.level4.leverB
    );
    newState.level4.platforms = getLevel4Platforms(
      newState.level4.stage,
      world.groundY,
      newState.level4.leverA,
      newState.level4.leverB
    );
    if (level4Layout.gate !== "FINAL") {
      newState.currentGoal = gateOutput
        ? "Дойди до выхода"
        : "Проверь значения A и B";
    } else if (newState.level4.puzzleSolved) {
      newState.currentGoal = "Дойди до выхода";
    }
  } else if (newState.currentLevel === 5) {
    if (newState.station.solved.final_airlock) {
      newState.currentGoal = "Доберись до выходного шлюза";
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
      if (
        newState.currentLevel === 1 ||
        newState.currentLevel === 2 ||
        newState.currentLevel === 3 ||
        newState.currentLevel === 4 ||
        newState.currentLevel === 5
      ) {
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
  const prevY = newState.playerPos.y;
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

  grounded = false;

  if (newX < 0) newX = 0;
  if (newX + PLAYER_WIDTH > CANVAS_WIDTH) newX = CANVAS_WIDTH - PLAYER_WIDTH;

  // ==================== LEVEL-SPECIFIC COLLISIONS ====================
  if (newState.currentLevel === 1) {
    newX = checkLevel1RobotCollision(newX, newY, newState.playerPos.x, newState.robotColliderActive, level1Config);
  } else if (newState.currentLevel === 2) {
    newX = checkLevel2BarrierCollision(newX, newState.playerPos.x, newState.level2.barrierActive, world.barrierX);
  } else if (newState.currentLevel === 3) {
    if (newVelY >= 0) {
      const landingY = checkLevel3PlatformLanding(newX, prevY, newY, newState.level3.platforms);
      if (landingY !== null) {
        newY = landingY - PLAYER_HEIGHT;
        newVelY = 0;
        grounded = true;
      }
    }
  } else if (newState.currentLevel === 4) {
    if (newVelY >= 0) {
      const landingY = checkLevel3PlatformLanding(newX, prevY, newY, newState.level4.platforms);
      if (landingY !== null) {
        newY = landingY - PLAYER_HEIGHT;
        newVelY = 0;
        grounded = true;
      }
    }
    if (level4Layout.barrierX !== null) {
      const gateOutput = getLevel4GateOutput(
        level4Layout.gate as Level4Gate,
        newState.level4.leverA,
        newState.level4.leverB
      );
      const barrierActive =
        level4Layout.gate === "FINAL" ? !newState.level4.puzzleSolved : !gateOutput;
      newX = checkLevel4BarrierCollision(newX, newState.playerPos.x, barrierActive, level4Layout.barrierX);
    }
  } else if (newState.currentLevel === 5) {
    if (newVelY >= 0) {
      const landingY = checkLevel3PlatformLanding(newX, prevY, newY, newState.level3.platforms);
      if (landingY !== null) {
        newY = landingY - PLAYER_HEIGHT;
        newVelY = 0;
        grounded = true;
      }
    }
    const doors = getStationDoors(world.groundY, newState.station.solved);
    newX = checkStationDoorCollision(newX, newY, newState.playerPos.x, doors);
  }

  if (newY + PLAYER_HEIGHT >= world.groundY) {
    newY = world.groundY - PLAYER_HEIGHT;
    newVelY = 0;
    grounded = true;
  }

  // ==================== CHECK EXIT ====================
  let reachedExit = false;
  if (newState.currentLevel === 1) {
    reachedExit = checkLevel1Exit(newX, newY, newState.robotColliderActive, level1Config);
  } else if (newState.currentLevel === 2) {
    reachedExit = checkLevel2Exit(newX, newY, newState.level2.combatRobotDisabled, newState.level2.barrierActive, level2Config);
  } else if (newState.currentLevel === 3) {
    reachedExit = checkLevel3Exit(newX, newY, level3Config);
  } else if (newState.currentLevel === 4) {
    const gateOutput = getLevel4GateOutput(
      level4Layout.gate as Level4Gate,
      newState.level4.leverA,
      newState.level4.leverB
    );
    const canExit =
      level4Layout.gate === "FINAL" ? newState.level4.puzzleSolved : gateOutput;
    reachedExit = checkLevel4Exit(newX, newY, canExit, level4Layout.exitPos);
  } else if (newState.currentLevel === 5) {
    reachedExit = checkStationExit(
      newX,
      newY,
      newState.station.solved.final_airlock,
      world.level5ExitPos
    );
  }

  if (reachedExit) {
    if (newState.currentLevel === 4 && newState.level4.stage < 4) {
      newState.level4.stage = (newState.level4.stage + 1) as 1 | 2 | 3 | 4;
      newState.level4.leverA = false;
      newState.level4.leverB = false;
      newState.level4.platforms = getLevel4Platforms(
        newState.level4.stage,
        world.groundY,
        newState.level4.leverA,
        newState.level4.leverB
      );
      if (newState.level4.stage === 4) {
        newState.currentGoal = "Реши таблицу истинности";
      }
      newState.playerPos = { x: 80, y: world.groundY - PLAYER_HEIGHT };
      newState.playerVelocityY = 0;
      newState.isGrounded = true;
      newState.spawnPhase = "beam";
      newState.spawnProgress = 0;
      newState.levelComplete = false;
      newState.levelCompletePhase = "none";
      newState.levelCompleteOpacity = 0;
      newState.robotFlashCount = 0;
    } else {
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
}
