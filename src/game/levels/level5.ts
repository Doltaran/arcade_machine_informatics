import type {
  Level3Platform,
  Position,
  StationOperand,
  StationTerminalId,
} from "../types";
import { EXIT_HEIGHT, EXIT_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH } from "../engine";

export interface StationDoor {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  label: string;
}

export interface StationTerminalConfig {
  id: StationTerminalId;
  title: string;
  description: string;
  explanation: string;
  pos: Position;
  palette: StationOperand[];
  correct: {
    left: StationOperand;
    right: StationOperand | null;
    operator: "AND" | "OR" | null;
    notLeft: boolean;
    notRight: boolean;
  };
}

export const STATION_OPERAND_META: Record<
  StationOperand,
  { label: string; icon: string }
> = {
  pressure: { label: "Давление в норме", icon: "O2" },
  seal: { label: "Дверь герметична", icon: "[] " },
  generator_broken: { label: "Основной генератор сломан", icon: "!!" },
  battery_low: { label: "Заряд батареи низкий", icon: "[]" },
  air_leak: { label: "Утечка воздуха", icon: "<>" },
  power: { label: "Энергия включена", icon: "PWR" },
  oxygen: { label: "Кислородный модуль исправен", icon: "O2+" },
  life_support: { label: "Жизнеобеспечение работает", icon: "LIFE" },
  alarm: { label: "Аварийный сигнал активен", icon: "ALM" },
};

export function getStationPlatforms(groundY: number): Level3Platform[] {
  return [
    { id: "station-1", x: 40, y: groundY - 40, width: 280, height: 24, number: 0, active: true },
    { id: "station-2", x: 380, y: groundY - 110, width: 250, height: 24, number: 0, active: true },
    { id: "station-3", x: 690, y: groundY - 190, width: 250, height: 24, number: 0, active: true },
    { id: "station-4", x: 980, y: groundY - 280, width: 250, height: 24, number: 0, active: true },
    { id: "station-5", x: 1140, y: groundY - 390, width: 200, height: 24, number: 0, active: true },
    { id: "station-step-a", x: 290, y: groundY - 80, width: 70, height: 20, number: 0, active: true },
    { id: "station-step-b", x: 620, y: groundY - 160, width: 60, height: 20, number: 0, active: true },
    { id: "station-step-c", x: 930, y: groundY - 250, width: 60, height: 20, number: 0, active: true },
  ];
}

export function getStationExitPos(groundY: number): Position {
  return { x: 1280, y: groundY - EXIT_HEIGHT - 330 };
}

export function getStationTerminals(groundY: number): StationTerminalConfig[] {
  return [
    {
      id: "airlock",
      title: "Шлюз A-1",
      description: "Открой шлюз, если давление в норме И дверь герметична.",
      explanation: "Шлюз нельзя открыть. Давление в отсеке ещё не восстановлено.",
      pos: { x: 150, y: groundY - 100 },
      palette: ["pressure", "seal"],
      correct: { left: "pressure", right: "seal", operator: "AND", notLeft: false, notRight: false },
    },
    {
      id: "generator",
      title: "Резервный генератор",
      description: "Включи резервный генератор, если основной генератор сломан ИЛИ заряда батареи мало.",
      explanation: "Резервный генератор не запустился. Для этого нужна авария генератора или низкий заряд.",
      pos: { x: 470, y: groundY - 170 },
      palette: ["generator_broken", "battery_low"],
      correct: { left: "generator_broken", right: "battery_low", operator: "OR", notLeft: false, notRight: false },
    },
    {
      id: "sector",
      title: "Доступ в отсек C",
      description: "Разреши вход в отсек, если НЕТ утечки воздуха.",
      explanation: "Доступ заблокирован. Система всё ещё считает, что утечка воздуха возможна.",
      pos: { x: 770, y: groundY - 250 },
      palette: ["air_leak"],
      correct: { left: "air_leak", right: null, operator: null, notLeft: true, notRight: false },
    },
    {
      id: "life_support",
      title: "Жизнеобеспечение",
      description: "Запусти систему, если энергия включена И кислородный модуль исправен.",
      explanation: "Жизнеобеспечение не стартовало. Ему одновременно нужны энергия и исправный кислородный модуль.",
      pos: { x: 1060, y: groundY - 340 },
      palette: ["power", "oxygen"],
      correct: { left: "power", right: "oxygen", operator: "AND", notLeft: false, notRight: false },
    },
    {
      id: "final_airlock",
      title: "Финальный шлюз",
      description: "Открой финальный шлюз, если жизнеобеспечение работает И аварийный сигнал отключён.",
      explanation: "Финальный шлюз не открылся. Сначала нужна работающая поддержка жизни и отключённая тревога.",
      pos: { x: 1210, y: groundY - 450 },
      palette: ["life_support", "alarm"],
      correct: { left: "life_support", right: "alarm", operator: "AND", notLeft: false, notRight: true },
    },
  ];
}

export function getStationDoors(
  groundY: number,
  solved: Record<StationTerminalId, boolean>
): StationDoor[] {
  return [
    {
      id: "door-airlock",
      x: 320,
      y: groundY - 150,
      width: 28,
      height: 120,
      open: solved.airlock,
      label: "A-1",
    },
    {
      id: "door-generator",
      x: 640,
      y: groundY - 230,
      width: 28,
      height: 120,
      open: solved.generator,
      label: "GEN",
    },
    {
      id: "door-sector",
      x: 940,
      y: groundY - 320,
      width: 28,
      height: 120,
      open: solved.sector,
      label: "C",
    },
    {
      id: "door-life",
      x: 1170,
      y: groundY - 430,
      width: 28,
      height: 120,
      open: solved.life_support,
      label: "LS",
    },
    {
      id: "door-final",
      x: 1260,
      y: groundY - 470,
      width: 26,
      height: 120,
      open: solved.final_airlock,
      label: "EXIT",
    },
  ];
}

export function checkStationDoorCollision(
  playerX: number,
  playerY: number,
  prevPlayerX: number,
  doors: StationDoor[]
): number {
  let nextX = playerX;

  for (const door of doors) {
    if (door.open) continue;

    const verticalOverlap =
      playerY + PLAYER_HEIGHT > door.y && playerY < door.y + door.height;

    if (!verticalOverlap) continue;

    if (
      prevPlayerX + PLAYER_WIDTH <= door.x &&
      nextX + PLAYER_WIDTH > door.x
    ) {
      nextX = door.x - PLAYER_WIDTH;
    } else if (
      prevPlayerX >= door.x + door.width &&
      nextX < door.x + door.width
    ) {
      nextX = door.x + door.width;
    }
  }

  return nextX;
}

export function checkStationExit(
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
