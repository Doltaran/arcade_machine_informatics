import type { Level3Platform, Position } from "../types";
import { PLAYER_HEIGHT, PLAYER_WIDTH, EXIT_WIDTH, EXIT_HEIGHT } from "../engine";

export type Level4Gate = "AND" | "OR" | "XOR" | "FINAL";

export interface Level4Layout {
  gate: Level4Gate;
  leverA: Position | null;
  leverB: Position | null;
  terminalPos: Position | null;
  exitPos: Position;
  barrierX: number | null;
}

export function getLevel4GateOutput(gate: Level4Gate, a: boolean, b: boolean): boolean {
  if (gate === "AND") return a && b;
  if (gate === "OR") return a || b;
  if (gate === "XOR") return (a && !b) || (!a && b);
  return false;
}

export function getLevel4Layout(stage: 1 | 2 | 3 | 4, groundY: number): Level4Layout {
  const exitPos = { x: 1120, y: groundY - EXIT_HEIGHT - 10 };

  if (stage === 1) {
    return {
      gate: "AND",
      leverA: { x: 160, y: groundY - 50 },
      leverB: { x: 520, y: groundY - 230 },
      terminalPos: null,
      exitPos,
      barrierX: 980,
    };
  }

  if (stage === 2) {
    return {
      gate: "OR",
      leverA: { x: 160, y: groundY - 50 },
      leverB: { x: 420, y: groundY - 240 },
      terminalPos: null,
      exitPos: { x: 1120, y: groundY - EXIT_HEIGHT - 220 },
      barrierX: null,
    };
  }

  if (stage === 3) {
    return {
      gate: "XOR",
      leverA: { x: 160, y: groundY - 50 },
      leverB: { x: 620, y: groundY - 230 },
      terminalPos: null,
      exitPos,
      barrierX: 980,
    };
  }

  return {
    gate: "FINAL",
    leverA: null,
    leverB: null,
    terminalPos: { x: 180, y: groundY - 60 },
    exitPos,
    barrierX: 980,
  };
}

export function getLevel4Platforms(
  stage: 1 | 2 | 3 | 4,
  groundY: number,
  a: boolean,
  b: boolean
): Level3Platform[] {
  if (stage === 1) {
    return [
      {
        id: "and-bridge",
        x: 340,
        y: groundY - 160,
        width: 160,
        height: 24,
        number: 0,
        active: a,
      },
      {
        id: "and-step",
        x: 520,
        y: groundY - 230,
        width: 120,
        height: 24,
        number: 0,
        active: true,
      },
    ];
  }

  if (stage === 2) {
    const liftTopY = groundY - 210;
    const liftBottomY = groundY - 40;
    const liftY = a || b ? liftTopY : liftBottomY;

    return [
      {
        id: "or-hard",
        x: 340,
        y: groundY - 180,
        width: 140,
        height: 24,
        number: 0,
        active: true,
      },
      {
        id: "or-lift",
        x: 720,
        y: liftY,
        width: 180,
        height: 26,
        number: 0,
        active: true,
      },
    ];
  }

  if (stage === 3) {
    return [
      {
        id: "xor-bridge",
        x: 420,
        y: groundY - 150,
        width: 160,
        height: 24,
        number: 0,
        active: !a,
      },
      {
        id: "xor-step",
        x: 620,
        y: groundY - 230,
        width: 120,
        height: 24,
        number: 0,
        active: true,
      },
    ];
  }

  return [];
}

export function checkLevel4BarrierCollision(
  playerX: number,
  prevPlayerX: number,
  barrierActive: boolean,
  barrierX: number
): number {
  if (!barrierActive) return playerX;

  if (playerX + PLAYER_WIDTH > barrierX - 8 && prevPlayerX + PLAYER_WIDTH <= barrierX - 8) {
    return barrierX - 8 - PLAYER_WIDTH;
  }

  return playerX;
}

export function checkLevel4Exit(
  playerX: number,
  playerY: number,
  canExit: boolean,
  exitPos: Position
): boolean {
  if (!canExit) return false;

  const playerCenter = {
    x: playerX + PLAYER_WIDTH / 2,
    y: playerY + PLAYER_HEIGHT / 2,
  };

  return (
    playerCenter.x > exitPos.x &&
    playerCenter.x < exitPos.x + EXIT_WIDTH &&
    playerCenter.y > exitPos.y &&
    playerCenter.y < exitPos.y + EXIT_HEIGHT
  );
}
