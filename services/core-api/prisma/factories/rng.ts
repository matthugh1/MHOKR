/**
 * Seeded Random Number Generator
 * 
 * Provides deterministic randomness for reproducible seed data.
 */

import seedrandom from 'seedrandom';

const SEED = 'puzzel-cx-demo-seed-2025';

let rng: () => number;

export function initRNG(customSeed?: string): void {
  rng = seedrandom(customSeed || SEED);
}

export function random(): number {
  if (!rng) {
    initRNG();
  }
  return rng();
}

export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return random() * (max - min) + min;
}

export function randomChoice<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function weightedChoice<T>(items: Array<{ item: T; weight: number }>): T {
  const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0);
  let randomValue = random() * totalWeight;
  
  for (const entry of items) {
    randomValue -= entry.weight;
    if (randomValue <= 0) {
      return entry.item;
    }
  }
  
  return items[items.length - 1].item;
}

