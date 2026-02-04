import type { GameState, Spark, Position } from "./types";

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
            x: world.robotPos.x + ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 40,
            y: world.robotPos.y + 20 + Math.random() * 30,
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
      newState.level2.wireAnimationProgress += deltaTime / 1000;
      
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
      
      newState.level2.wireParticles = newState.level2.wireParticles.filter(
        (p) => p.progress < newState.level2.wireAnimationProgress + 0.1
      );
      
      if (newState.level2.wireAnimationProgress >= 1) {
        if (newState.level2.wireAnimationActive === "robot") {
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
            x: world.combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 50,
            y: world.combatRobotPos.y + 30 + Math.random() * 40,
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
      newState.level2.shootTimer += deltaTime;
      if (newState.level2.shootTimer >= SHOOT_INTERVAL) {
        newState.level2.shootTimer = 0;
        newState.level2.bullets = [
          ...newState.level2.bullets,
          {
            x: world.combatRobotPos.x - BULLET_WIDTH,
            y: world.combatRobotPos.y + COMBAT_ROBOT_HEIGHT / 2 - BULLET_HEIGHT / 2,
            vx: -BULLET_SPEED,
          },
        ];
      }
    }

    newState.level2.bullets = newState.level2.bullets
      .map((b) => ({ ...b, x: b.x + b.vx }))
      .filter((b) => b.x > -BULLET_WIDTH);

    if (newState.level2.barrierActive) {
      newState.level2.bullets = newState.level2.bullets.filter((b) => b.x > world.barrierX);
    } else if (!newState.level2.playerDead) {
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

  // ==================== LEVEL 1 ROBOT COLLIDER ====================
  if (newState.currentLevel === 1 && newState.robotColliderActive) {
    const playerRect = {
      left: newX,
      right: newX + PLAYER_WIDTH,
      top: newY,
      bottom: newY + PLAYER_HEIGHT,
    };
    const robotRect = {
      left: world.robotPos.x,
      right: world.robotPos.x + ROBOT_WIDTH,
      top: world.robotPos.y,
      bottom: world.robotPos.y + ROBOT_HEIGHT,
    };

    if (
      playerRect.left < robotRect.right &&
      playerRect.right > robotRect.left &&
      playerRect.top < robotRect.bottom &&
      playerRect.bottom > robotRect.top
    ) {
      if (newState.playerPos.x < world.robotPos.x) {
        newX = robotRect.left - PLAYER_WIDTH;
      } else {
        newX = robotRect.right;
      }
    }
  }

  // ==================== LEVEL 2 BARRIER COLLIDER ====================
  if (newState.currentLevel === 2 && newState.level2.barrierActive) {
    if (newX + PLAYER_WIDTH > world.barrierX - 10 && newState.playerPos.x + PLAYER_WIDTH <= world.barrierX - 10) {
      newX = world.barrierX - 10 - PLAYER_WIDTH;
    }
    if (newX < world.barrierX + 30 && newState.playerPos.x >= world.barrierX + 30) {
      newX = world.barrierX + 30;
    }
  }

  // ==================== CHECK EXIT ====================
  const currentExitPos = newState.currentLevel === 1 ? world.exitPos : world.level2ExitPos;
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
}
