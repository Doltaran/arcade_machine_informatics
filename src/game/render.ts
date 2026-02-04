import type { GameState, Position, Spark, SpawnParticle } from "./types";

// ==================== DRAW ASTRONAUT ====================
export function drawAstronaut(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingRight: boolean,
  isMoving: boolean,
  isGrounded: boolean,
  animTime: number,
  spawnPhase: string,
  spawnProgress: number,
  playerWidth: number,
  playerHeight: number
) {
  const dir = facingRight ? 1 : -1;
  const centerX = x + playerWidth / 2;

  const walkCycle = isMoving && isGrounded ? Math.sin(animTime * 0.015) : 0;
  const armSwing = walkCycle * 25;
  const legSwing = walkCycle * 20;

  let alpha = 1;
  if (spawnPhase === "materialize") {
    alpha = spawnProgress;
  } else if (spawnPhase === "beam") {
    alpha = 0;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Ноги
  ctx.save();
  ctx.translate(centerX - 6, y + 38);
  ctx.rotate(((-legSwing) * Math.PI) / 180);
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(-4, 0, 8, 10);
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(-4, 10, 8, 8);
  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.roundRect(-5, 18, 10, 6, 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(centerX + 6, y + 38);
  ctx.rotate((legSwing * Math.PI) / 180);
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(-4, 0, 8, 10);
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(-4, 10, 8, 8);
  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.roundRect(-5, 18, 10, 6, 2);
  ctx.fill();
  ctx.restore();

  // Тело
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.roundRect(centerX - 10, y + 18, 20, 22, 4);
  ctx.fill();

  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(centerX - 6, y + 22, 12, 14);

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(centerX - 2, y + 26, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(centerX + 3, y + 26, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b7280";
  ctx.fillRect(centerX - 10, y + 36, 20, 4);

  // Руки
  ctx.save();
  ctx.translate(centerX - 12, y + 22);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.roundRect(-4, 0, 8, 12, 3);
  ctx.fill();
  ctx.fillStyle = "#d4d4d4";
  ctx.beginPath();
  ctx.roundRect(-3, 12, 6, 6, 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(centerX + 12, y + 22);
  ctx.rotate(((-armSwing) * Math.PI) / 180);
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.roundRect(-4, 0, 8, 12, 3);
  ctx.fill();
  ctx.fillStyle = "#d4d4d4";
  ctx.beginPath();
  ctx.roundRect(-3, 12, 6, 6, 2);
  ctx.fill();
  ctx.restore();

  // Шлем
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.arc(centerX, y + 12, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.arc(centerX + dir * 2, y + 12, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(147, 197, 253, 0.5)";
  ctx.beginPath();
  ctx.arc(centerX + dir * 5, y + 9, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(centerX + dir * 3, y + 7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 8, y + 4);
  ctx.lineTo(centerX - 10, y - 4);
  ctx.stroke();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(centerX - 10, y - 5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d4d4d4";
  ctx.beginPath();
  ctx.roundRect(centerX - dir * 14, y + 20, 6, 16, 2);
  ctx.fill();

  ctx.restore();
}

// ==================== DRAW COMBAT ROBOT (Level 2) ====================
export function drawCombatRobot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  disabled: boolean,
  animPhase: string,
  flashCount: number,
  collapseOffset: number,
  robotWidth: number,
  robotHeight: number
) {
  const robotY = y + collapseOffset;
  let bodyColor = "#dc2626";
  
  if (animPhase === "flashing") {
    bodyColor = Math.floor(flashCount) % 2 === 0 ? "#fef08a" : "#dc2626";
  } else if (disabled && animPhase !== "flashing") {
    bodyColor = "#4b5563";
  }

  // Тело
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(x, robotY, robotWidth, robotHeight - collapseOffset, 8);
  ctx.fill();

  // Голова
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(x + 15, robotY - 25, robotWidth - 30, 30, 5);
  ctx.fill();

  // Глаза (красные лазеры когда активен)
  const eyeColor = disabled ? "#374151" : "#ff0000";
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x + 25, robotY - 10, 8, 0, Math.PI * 2);
  ctx.arc(x + robotWidth - 25, robotY - 10, 8, 0, Math.PI * 2);
  ctx.fill();

  if (!disabled) {
    // Свечение глаз
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ff6666";
    ctx.beginPath();
    ctx.arc(x + 25, robotY - 10, 4, 0, Math.PI * 2);
    ctx.arc(x + robotWidth - 25, robotY - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Пушка
  ctx.fillStyle = disabled ? "#374151" : "#991b1b";
  ctx.fillRect(x - 30, robotY + 30, 35, 15);
  ctx.beginPath();
  ctx.arc(x - 30, robotY + 37, 7, 0, Math.PI * 2);
  ctx.fill();

  // Ноги/гусеницы
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x + 5, robotY + robotHeight - collapseOffset - 15, 25, 15);
  ctx.fillRect(x + robotWidth - 30, robotY + robotHeight - collapseOffset - 15, 25, 15);

  // Надпись "COMBAT"
  if (!disabled) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("COMBAT", x + robotWidth / 2, robotY + 50);
  }
}

// ==================== DRAW SPARKS ====================
export function drawSparks(ctx: CanvasRenderingContext2D, sparks: Spark[]) {
  sparks.forEach((spark) => {
    ctx.fillStyle = `rgba(254, 240, 138, ${spark.life})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(251, 191, 36, ${spark.life * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spark.x, spark.y);
    ctx.lineTo(spark.x - spark.vx * 2, spark.y - spark.vy * 2);
    ctx.stroke();
  });
}

// ==================== DRAW COMBAT SPARKS ====================
export function drawCombatSparks(ctx: CanvasRenderingContext2D, sparks: Spark[]) {
  sparks.forEach((spark) => {
    ctx.fillStyle = `rgba(254, 240, 138, ${spark.life})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(239, 68, 68, ${spark.life * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spark.x, spark.y);
    ctx.lineTo(spark.x - spark.vx * 2, spark.y - spark.vy * 2);
    ctx.stroke();
  });
}

// ==================== DRAW SPAWN PARTICLES ====================
export function drawSpawnParticles(ctx: CanvasRenderingContext2D, particles: SpawnParticle[]) {
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ==================== DRAW BACKGROUND ====================
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  groundY: number,
  groundHeight: number,
  level: number
) {
  // Фон
  const skyGradient = ctx.createLinearGradient(0, 0, 0, groundY);
  if (level === 1) {
    skyGradient.addColorStop(0, "#0f172a");
    skyGradient.addColorStop(1, "#1e293b");
  } else {
    skyGradient.addColorStop(0, "#1a0a0a");
    skyGradient.addColorStop(1, "#2d1515");
  }
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvasWidth, groundY);

  // Звёзды
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 50; i++) {
    const starX = (i * 137) % canvasWidth;
    const starY = (i * 89) % (groundY - 20);
    const starSize = (i % 3) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Пол
  ctx.fillStyle = level === 1 ? "#334155" : "#3d2020";
  ctx.fillRect(0, groundY, canvasWidth, groundHeight);
  ctx.strokeStyle = level === 1 ? "#475569" : "#5c3030";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvasWidth, groundY);
  ctx.stroke();

  ctx.fillStyle = level === 1 ? "#1e293b" : "#2a1515";
  for (let i = 0; i < canvasWidth; i += 60) {
    ctx.fillRect(i + 5, groundY + 8, 50, 4);
    ctx.fillRect(i + 10, groundY + 20, 40, 3);
  }
}

// ==================== DRAW EXIT ====================
export function drawExit(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  width: number,
  height: number,
  active: boolean
) {
  ctx.fillStyle = active ? "#22c55e" : "#4b5563";
  ctx.fillRect(pos.x, pos.y, width, height);
  ctx.fillStyle = active ? "#166534" : "#374151";
  ctx.fillRect(pos.x + 10, pos.y + 20, width - 20, height - 20);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", pos.x + width / 2, pos.y + 14);
  if (active) {
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.arc(pos.x + width / 2, pos.y - 15, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==================== DRAW TERMINAL ====================
export function drawTerminal(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  width: number,
  height: number,
  showInteractHint: boolean
) {
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(pos.x, pos.y, width, height);
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(pos.x + 5, pos.y + 5, width - 10, 30);
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(pos.x + 15, pos.y + height - 15, width - 30, 15);
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(pos.x + 10, pos.y + 15, 8, 12);
  }
  if (showInteractHint) {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("[E]", pos.x + width / 2, pos.y - 10);
  }
}

// ==================== DRAW START ZONE ====================
export function drawStartZone(
  ctx: CanvasRenderingContext2D,
  groundY: number
) {
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(30, groundY - 65, 90, 65);
  ctx.setLineDash([]);
  ctx.fillStyle = "#60a5fa";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("ТЕЛЕПОРТ", 75, groundY + 20);
}

// ==================== DRAW LEVEL 1 ROBOT ====================
export function drawLevel1Robot(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  width: number,
  height: number,
  disabled: boolean,
  animPhase: string,
  flashOn: boolean,
  collapseOffset: number,
  targetNumber: number
) {
  const robotY = pos.y + collapseOffset;
  let robotColor = "#ef4444";
  if (animPhase === "flashing" && flashOn) {
    robotColor = "#fef08a";
  } else if (disabled && animPhase !== "flashing") {
    robotColor = "#4b5563";
  }

  ctx.fillStyle = robotColor;
  ctx.fillRect(pos.x, robotY, width, height - collapseOffset);
  ctx.fillRect(pos.x + 10, robotY - 15, width - 20, 20);

  const eyeColor =
    disabled && animPhase !== "flashing"
      ? "#374151"
      : "#fef08a";
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(pos.x + 18, robotY + 25, 8, 0, Math.PI * 2);
  ctx.arc(pos.x + width - 18, robotY + 25, 8, 0, Math.PI * 2);
  ctx.fill();

  if (!disabled || animPhase === "flashing") {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(pos.x + 18, robotY + 25, 3, 0, Math.PI * 2);
    ctx.arc(pos.x + width - 18, robotY + 25, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle =
    disabled && animPhase !== "flashing"
      ? "#374151"
      : "#000";
  ctx.fillRect(pos.x + 15, robotY + 50, width - 30, 8);

  ctx.fillStyle = robotColor;
  ctx.fillRect(pos.x - 12, robotY + 20, 12, 35);
  ctx.fillRect(pos.x + width, robotY + 20, 12, 35);

  ctx.fillStyle =
    disabled && animPhase === "done"
      ? "#6b7280"
      : "#fff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    disabled && animPhase === "done"
      ? "---"
      : targetNumber.toString(),
    pos.x + width / 2,
    robotY - 25
  );
}

// ==================== DRAW GENERATOR ====================
export function drawGenerator(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  robotDisabled: boolean,
  barrierActive: boolean,
  displayNumber1: number,
  displayNumber2: number
) {
  const genX = pos.x;
  const genY = pos.y;
  const genWidth = 140;
  const genHeight = 120;
  
  // Корпус генератора
  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.roundRect(genX, genY, genWidth, genHeight, 8);
  ctx.fill();
  
  // Верхняя панель
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(genX + 10, genY + 10, genWidth - 20, 30);
  
  // Красный дисплей (слева на генераторе) - для робота
  ctx.fillStyle = robotDisabled ? "#374151" : "#7f1d1d";
  ctx.fillRect(genX + 10, genY + 50, 55, 40);
  ctx.fillStyle = robotDisabled ? "#1f2937" : "#450a0a";
  ctx.fillRect(genX + 15, genY + 55, 45, 25);
  ctx.fillStyle = robotDisabled ? "#6b7280" : "#ef4444";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(robotDisabled ? "--" : displayNumber1.toString(), genX + 37, genY + 75);
  
  // Синий дисплей (справа на генераторе) - для барьера  
  ctx.fillStyle = !barrierActive ? "#374151" : "#1e3a8a";
  ctx.fillRect(genX + 75, genY + 50, 55, 40);
  ctx.fillStyle = !barrierActive ? "#1f2937" : "#1e1b4b";
  ctx.fillRect(genX + 80, genY + 55, 45, 25);
  ctx.fillStyle = !barrierActive ? "#6b7280" : "#3b82f6";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(!barrierActive ? "--" : displayNumber2.toString(), genX + 102, genY + 75);
  
  // Индикаторы под дисплеями
  ctx.fillStyle = robotDisabled ? "#22c55e" : "#ef4444";
  ctx.beginPath();
  ctx.arc(genX + 37, genY + 98, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = !barrierActive ? "#22c55e" : "#3b82f6";
  ctx.beginPath();
  ctx.arc(genX + 102, genY + 98, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Надпись "ГЕНЕРАТОР"
  ctx.fillStyle = "#9ca3af";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.fillText("ГЕНЕРАТОР", genX + genWidth / 2, genY + 25);
  
  // Детали генератора (вентиляция)
  ctx.fillStyle = "#1f2937";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(genX + genWidth - 15, genY + 15 + i * 8, 10, 4);
  }
}

// ==================== DRAW WIRES ====================
export function drawWires(
  ctx: CanvasRenderingContext2D,
  redWirePoints: Position[],
  blueWirePoints: Position[],
  robotDisabled: boolean,
  barrierActive: boolean
) {
  // Красный провод
  ctx.strokeStyle = robotDisabled ? "#4b5563" : "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(redWirePoints[0].x, redWirePoints[0].y);
  for (let i = 1; i < redWirePoints.length; i++) {
    ctx.lineTo(redWirePoints[i].x, redWirePoints[i].y);
  }
  ctx.stroke();

  // Синий провод
  ctx.strokeStyle = !barrierActive ? "#4b5563" : "#3b82f6";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(blueWirePoints[0].x, blueWirePoints[0].y);
  for (let i = 1; i < blueWirePoints.length; i++) {
    ctx.lineTo(blueWirePoints[i].x, blueWirePoints[i].y);
  }
  ctx.stroke();
}

// ==================== DRAW WIRE ANIMATION ====================
export function drawWireAnimation(
  ctx: CanvasRenderingContext2D,
  wirePoints: Position[],
  wireColor: string,
  progress: number
) {
  // Вычисляем общую длину провода
  let totalLength = 0;
  for (let i = 1; i < wirePoints.length; i++) {
    totalLength += Math.sqrt(
      Math.pow(wirePoints[i].x - wirePoints[i-1].x, 2) +
      Math.pow(wirePoints[i].y - wirePoints[i-1].y, 2)
    );
  }
  
  // Рисуем светящуюся часть провода
  const targetLength = totalLength * progress;
  let currentLength = 0;
  
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 6;
  ctx.shadowColor = wireColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(wirePoints[0].x, wirePoints[0].y);
  
  for (let i = 1; i < wirePoints.length; i++) {
    const segmentLength = Math.sqrt(
      Math.pow(wirePoints[i].x - wirePoints[i-1].x, 2) +
      Math.pow(wirePoints[i].y - wirePoints[i-1].y, 2)
    );
    
    if (currentLength + segmentLength <= targetLength) {
      ctx.lineTo(wirePoints[i].x, wirePoints[i].y);
      currentLength += segmentLength;
    } else {
      const remaining = targetLength - currentLength;
      const ratio = remaining / segmentLength;
      const endX = wirePoints[i-1].x + (wirePoints[i].x - wirePoints[i-1].x) * ratio;
      const endY = wirePoints[i-1].y + (wirePoints[i].y - wirePoints[i-1].y) * ratio;
      ctx.lineTo(endX, endY);
      
      // Рисуем искру на конце
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(endX, endY, 8 + Math.sin(Date.now() * 0.02) * 3, 0, Math.PI * 2);
      ctx.fillStyle = wireColor;
      ctx.fill();
      break;
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ==================== DRAW BARRIER ====================
export function drawBarrier(
  ctx: CanvasRenderingContext2D,
  barrierX: number,
  groundY: number,
  barrierTimeLeft: number,
  maxTime: number,
  robotDisabled: boolean
) {
  const barrierAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
  const gradient = ctx.createLinearGradient(barrierX, 0, barrierX + 20, 0);
  gradient.addColorStop(0, `rgba(59, 130, 246, 0)`);
  gradient.addColorStop(0.5, `rgba(59, 130, 246, ${barrierAlpha})`);
  gradient.addColorStop(1, `rgba(59, 130, 246, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(barrierX - 10, 0, 40, groundY);

  // Линии энергии
  ctx.strokeStyle = `rgba(147, 197, 253, ${0.5 + Math.sin(Date.now() * 0.01) * 0.3})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < groundY; i += 30) {
    const offset = Math.sin((Date.now() + i * 10) * 0.005) * 5;
    ctx.beginPath();
    ctx.moveTo(barrierX + offset, i);
    ctx.lineTo(barrierX + offset, i + 20);
    ctx.stroke();
  }

  // Таймер барьера (только если робот ещё активен)
  if (!robotDisabled) {
    const timePercent = barrierTimeLeft / maxTime;
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(barrierX - 40, 20, 100, 25);
    ctx.fillStyle = timePercent > 0.3 ? "#3b82f6" : "#ef4444";
    ctx.fillRect(barrierX - 38, 22, 96 * timePercent, 21);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(barrierTimeLeft / 1000)}с`, barrierX + 10, 38);
  }
}

// ==================== DRAW BULLETS ====================
export function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: { x: number; y: number; vx: number }[],
  bulletWidth: number,
  bulletHeight: number
) {
  ctx.fillStyle = "#fbbf24";
  bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.ellipse(bullet.x + bulletWidth / 2, bullet.y + bulletHeight / 2, bulletWidth / 2, bulletHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // След пули
    const trailGradient = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x + 40, bullet.y);
    trailGradient.addColorStop(0, "rgba(251, 191, 36, 0.5)");
    trailGradient.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = trailGradient;
    ctx.fillRect(bullet.x + bulletWidth, bullet.y + 2, 30, bulletHeight - 4);
  });
}

// ==================== DRAW SPAWN BEAM ====================
export function drawSpawnBeam(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  groundY: number,
  progress: number
) {
  const beamWidth = 40 * (1 - progress * 0.3);
  const gradient = ctx.createLinearGradient(centerX, 0, centerX, groundY);
  gradient.addColorStop(0, "rgba(96, 165, 250, 0)");
  gradient.addColorStop(0.3, `rgba(96, 165, 250, ${0.6 * (1 - progress)})`);
  gradient.addColorStop(0.7, `rgba(52, 211, 153, ${0.8 * (1 - progress)})`);
  gradient.addColorStop(1, "rgba(52, 211, 153, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(centerX - beamWidth / 2, 0);
  ctx.lineTo(centerX + beamWidth / 2, 0);
  ctx.lineTo(centerX + beamWidth / 4, groundY);
  ctx.lineTo(centerX - beamWidth / 4, groundY);
  ctx.closePath();
  ctx.fill();
}

// ==================== DRAW MATERIALIZE RING ====================
export function drawMaterializeRing(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  progress: number
) {
  ctx.strokeStyle = `rgba(96, 165, 250, ${1 - progress})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30 + progress * 20, 0, Math.PI * 2);
  ctx.stroke();
}

// ==================== DRAW LEVEL LABEL ====================
export function drawLevelLabel(
  ctx: CanvasRenderingContext2D,
  level: number
) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Уровень ${level}`, 20, 30);
}
