import type { Level3Platform, Position } from "../types";
import { PLAYER_HEIGHT, PLAYER_WIDTH, EXIT_WIDTH, EXIT_HEIGHT } from "../engine";

export interface Level3Config {
  exitPos: Position;
}

export function checkLevel3PlatformLanding(
  playerX: number,
  prevPlayerY: number,
  newPlayerY: number,
  platforms: Level3Platform[]
): number | null {
  const prevBottom = prevPlayerY + PLAYER_HEIGHT;
  const newBottom = newPlayerY + PLAYER_HEIGHT;

  let landingY: number | null = null;

  for (const platform of platforms) {
    if (!platform.active) continue;

    const platformLeft = platform.x;
    const platformRight = platform.x + platform.width;
    const platformTop = platform.y;

    const playerLeft = playerX;
    const playerRight = playerX + PLAYER_WIDTH;

    const horizontallyOverlapping =
      playerRight > platformLeft && playerLeft < platformRight;

    if (!horizontallyOverlapping) continue;

    if (prevBottom <= platformTop && newBottom >= platformTop) {
      if (landingY === null || platformTop < landingY) {
        landingY = platformTop;
      }
    }
  }

  return landingY;
}

export function checkLevel3Exit(
  playerX: number,
  playerY: number,
  config: Level3Config
): boolean {
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
