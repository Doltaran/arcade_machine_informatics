import type { GameState, Spark, Position } from "../types";
import {
  COMBAT_ROBOT_WIDTH,
  COMBAT_ROBOT_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  EXIT_WIDTH,
  EXIT_HEIGHT,
  BULLET_SPEED,
  BULLET_WIDTH,
  BULLET_HEIGHT,
  SHOOT_INTERVAL,
} from "../engine";

export interface Level2Config {
  combatRobotPos: Position;
  exitPos: Position;
  barrierX: number;
  groundY: number;
}

export function updateLevel2(
  state: GameState,
  deltaTime: number,
  config: Level2Config
): GameState {
  // ==================== WIRE ANIMATION ====================
  // Анимация тока по проводам от генератора к цели
  if (state.level2.wireAnimationActive !== "none") {
    state.level2.wireAnimationProgress += deltaTime / 1000; // 1 секунда на анимацию
    
    // Добавляем частицы тока
    if (Math.random() < 0.3) {
      const color = state.level2.wireAnimationActive === "robot" ? "#ef4444" : "#3b82f6";
      state.level2.wireParticles = [
        ...state.level2.wireParticles,
        {
          x: 0,
          y: 0,
          progress: state.level2.wireAnimationProgress - Math.random() * 0.1,
          color,
        },
      ];
    }
    
    // Убираем старые частицы
    state.level2.wireParticles = state.level2.wireParticles.filter(
      (p) => p.progress < state.level2.wireAnimationProgress + 0.1
    );
    
    // Когда анимация завершена — эффект на цель
    if (state.level2.wireAnimationProgress >= 1) {
      if (state.level2.wireAnimationActive === "robot") {
        // Ток дошёл до робота — отключаем его
        state.level2.combatRobotDisabled = true;
        state.level2.combatRobotAnimPhase = "flashing";
        state.level2.combatRobotFlashCount = 0;
        state.currentGoal = "Теперь отключи барьер (синий провод)";
        state.level2.narratorMessage = {
          text: "Отлично! Робот отключён. Теперь отключи барьер, пока он не исчез!",
          duration: 3000,
          timer: 3000,
        };
      } else {
        // Ток дошёл до барьера — отключаем его
        state.level2.barrierActive = false;
        state.level2.barrierAnimPhase = "disabling";
        if (state.level2.combatRobotDisabled) {
          state.currentGoal = "Дойди до выхода!";
          state.level2.narratorMessage = {
            text: "Барьер деактивирован. Путь свободен!",
            duration: 2500,
            timer: 2500,
          };
        }
        // Если робот ещё активен — пули начнут попадать в игрока
      }
      state.level2.wireAnimationActive = "none";
      state.level2.wireAnimationProgress = 0;
      state.level2.wireParticles = [];
    }
  }

  // ==================== COMBAT ROBOT ANIMATION ====================
  if (state.level2.combatRobotAnimPhase === "flashing") {
    const flashInterval = 100;
    const totalFlashes = 6;
    state.level2.combatRobotFlashCount += deltaTime / flashInterval;
    if (state.level2.combatRobotFlashCount >= totalFlashes) {
      state.level2.combatRobotAnimPhase = "sparks";
      const newSparks: Spark[] = [];
      for (let i = 0; i < 15; i++) {
        newSparks.push({
          x: config.combatRobotPos.x + COMBAT_ROBOT_WIDTH / 2 + (Math.random() - 0.5) * 50,
          y: config.combatRobotPos.y + 30 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 10,
          vy: -Math.random() * 8 - 2,
          life: 1,
        });
      }
      state.level2.sparks = newSparks;
    }
  } else if (state.level2.combatRobotAnimPhase === "sparks") {
    const updatedSparks = state.level2.sparks
      .map((s) => ({
        ...s,
        x: s.x + s.vx,
        y: s.y + s.vy,
        vy: s.vy + 0.3,
        life: s.life - deltaTime / 500,
      }))
      .filter((s) => s.life > 0);
    state.level2.sparks = updatedSparks;
    if (updatedSparks.length === 0) {
      state.level2.combatRobotAnimPhase = "collapse";
    }
  } else if (state.level2.combatRobotAnimPhase === "collapse") {
    state.level2.combatRobotCollapseOffset += deltaTime * 0.04;
    if (state.level2.combatRobotCollapseOffset >= 25) {
      state.level2.combatRobotCollapseOffset = 25;
      state.level2.combatRobotAnimPhase = "done";
    }
  }

  // ==================== SHOOTING ====================
  // Робот стреляет пока активен
  if (!state.level2.combatRobotDisabled && state.spawnPhase === "ready" && !state.level2.playerDead) {
    state.level2.shootTimer += deltaTime;
    if (state.level2.shootTimer >= SHOOT_INTERVAL) {
      state.level2.shootTimer = 0;
      state.level2.bullets = [
        ...state.level2.bullets,
        {
          x: config.combatRobotPos.x - BULLET_WIDTH,
          y: config.combatRobotPos.y + COMBAT_ROBOT_HEIGHT / 2 - BULLET_HEIGHT / 2,
          vx: -BULLET_SPEED,
        },
      ];
    }
  }

  // ==================== BULLETS UPDATE ====================
  state.level2.bullets = state.level2.bullets
    .map((b) => ({ ...b, x: b.x + b.vx }))
    .filter((b) => b.x > -BULLET_WIDTH);

  // Пули останавливаются на барьере или попадают в игрока
  if (state.level2.barrierActive) {
    state.level2.bullets = state.level2.bullets.filter((b) => b.x > config.barrierX);
  } else if (!state.level2.playerDead) {
    const playerRect = {
      left: state.playerPos.x,
      right: state.playerPos.x + PLAYER_WIDTH,
      top: state.playerPos.y,
      bottom: state.playerPos.y + PLAYER_HEIGHT,
    };
    for (const bullet of state.level2.bullets) {
      if (
        bullet.x < playerRect.right &&
        bullet.x + BULLET_WIDTH > playerRect.left &&
        bullet.y < playerRect.bottom &&
        bullet.y + BULLET_HEIGHT > playerRect.top
      ) {
        state.level2.playerDead = true;
        state.level2.deathReason = "Ты был поражён пулей боевого робота!";
        break;
      }
    }
  }

  // ==================== BARRIER TIMER ====================
  // Барьер истекает если робот ещё активен
  if (state.level2.barrierActive && !state.level2.combatRobotDisabled) {
    state.level2.barrierTimeLeft -= deltaTime;
    if (state.level2.barrierTimeLeft <= 0) {
      state.level2.barrierActive = false;
      state.level2.barrierTimeLeft = 0;
    }
  }

  return state;
}

export function checkLevel2BarrierCollision(
  playerX: number,
  prevPlayerX: number,
  barrierActive: boolean,
  barrierX: number
): number {
  if (!barrierActive) return playerX;

  // Игрок не может пройти через барьер
  if (playerX + PLAYER_WIDTH > barrierX - 10 && prevPlayerX + PLAYER_WIDTH <= barrierX - 10) {
    return barrierX - 10 - PLAYER_WIDTH;
  }
  if (playerX < barrierX + 30 && prevPlayerX >= barrierX + 30) {
    return barrierX + 30;
  }

  return playerX;
}

export function checkLevel2Exit(
  playerX: number,
  playerY: number,
  combatRobotDisabled: boolean,
  barrierActive: boolean,
  config: Level2Config
): boolean {
  if (!combatRobotDisabled || barrierActive) return false;

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
