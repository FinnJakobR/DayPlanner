import { inMinutes } from "../models/time.js";
import State from "./state.js";

export function delayReward(
  currentReward: number,
  prev: State,
  next: State,
): number {
  let reward = currentReward;

  const deltaDelay = next.delayInMinutes - prev.delayInMinutes;

  reward -= deltaDelay * 0.3;

  return reward;
}

export function stressReward(
  currentReward: number,
  prev: State,
  next: State,
): number {
  let reward = currentReward;

  const deltaStress = prev.stress - next.stress;

  reward += deltaStress * 0.7;

  return reward;
}

export function energyReward(
  currentReward: number,
  prev: State,
  next: State,
): number {
  let reward = currentReward;

  const deltaEnergy = next.energy - prev.energy;

  reward += deltaEnergy * 0.5;

  return reward;
}

export function cognitiveBlocksRewards(
  currentReward: number,
  prev: State,
  next: State,
): number {
  let reward = currentReward;

  const OPTIMAL_MIN = 20;
  const OPTIMAL_MAX = 90;
  const HARD_MIN = 5;
  const SOFT_MIN = 10;
  const FATIGUE_LIMIT = 120;

  for (const a of next.scheudle) {
    const duration = inMinutes(a.v.task.duration);

    // ===== 1️⃣ Extrem kleine Blöcke hart bestrafen =====
    if (duration < HARD_MIN) {
      reward -= 8;
      continue;
    }

    // ===== 2️⃣ Kleine Blöcke leicht bestrafen =====
    if (duration < SOFT_MIN) {
      reward -= 3;
      continue;
    }

    // ===== 3️⃣ Optimaler Fokusbereich belohnen =====
    if (duration >= OPTIMAL_MIN && duration <= OPTIMAL_MAX) {
      reward += 4;
      continue;
    }

    // ===== 4️⃣ Leicht über optimal =====
    if (duration > OPTIMAL_MAX && duration <= FATIGUE_LIMIT) {
      reward += 1; // noch okay
      continue;
    }

    // ===== 5️⃣ Zu lange Blöcke → Ermüdung =====
    if (duration > FATIGUE_LIMIT) {
      reward -= (duration - FATIGUE_LIMIT) * 0.05;
    }
  }

  return reward;
}
