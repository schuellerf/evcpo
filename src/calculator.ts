/**
 * Core price optimization logic for EV charging.
 */

import type { PriceSlot } from './api';

/**
 * Number of hours needed to charge from current SOC to target SOC.
 * Uses EV capacity (kWh) and charging power (kW).
 * Rounded up to ensure target is reached.
 */
export function getHoursNeeded(
  currentSoc: number,
  targetSoc: number,
  capacityKwh: number,
  powerKw: number
): number {
  if (targetSoc <= currentSoc || powerKw <= 0) return 0;
  const deltaPercent = (targetSoc - currentSoc) / 100;
  const energyKwh = deltaPercent * capacityKwh;
  return Math.ceil(energyKwh / powerKw);
}

/**
 * Get the average and max price (Eur/MWh) when charging during the N cheapest hours.
 * Sorts available slots by price ascending and takes the first N.
 * Returns { avg: NaN, max: NaN } if there are not enough slots.
 */
function getCheapestStats(
  slots: PriceSlot[],
  hoursNeeded: number
): { avg: number; max: number } {
  if (hoursNeeded <= 0 || slots.length === 0) return { avg: NaN, max: NaN };
  const sorted = [...slots].sort((a, b) => a.marketprice - b.marketprice);
  const selected = sorted.slice(0, hoursNeeded);
  if (selected.length < hoursNeeded) return { avg: NaN, max: NaN };
  const sum = selected.reduce((acc, s) => acc + s.marketprice, 0);
  const max = Math.max(...selected.map((s) => s.marketprice));
  return { avg: sum / hoursNeeded, max };
}

/**
 * Get the average price (Eur/MWh) when charging during the N cheapest hours.
 * Sorts available slots by price ascending and takes the first N.
 * Returns NaN if there are not enough slots.
 */
export function getCheapestAveragePrice(
  slots: PriceSlot[],
  hoursNeeded: number
): number {
  return getCheapestStats(slots, hoursNeeded).avg;
}

/**
 * Get the max price (Eur/MWh) among the N cheapest hours.
 * Useful for setting smart-charging limits: all hours will be at or below this price.
 * Returns NaN if there are not enough slots.
 */
export function getCheapestMaxPrice(
  slots: PriceSlot[],
  hoursNeeded: number
): number {
  return getCheapestStats(slots, hoursNeeded).max;
}

/**
 * Compute the average price matrix for the 3D chart.
 * @param currentSoc - Current SOC (%)
 * @param capacityKwh - EV battery capacity (kWh)
 * @param powerKw - Charging power (kW)
 * @param targetHours - Array of target hour timestamps (start of each hour)
 * @param targetSocs - Array of target SOC values (%)
 * @param priceSlots - All available price slots (must cover the time range)
 * @returns 2D array [targetHourIndex][targetSocIndex] = average price Eur/MWh, or NaN if impossible
 */
export function computeMatrix(
  currentSoc: number,
  capacityKwh: number,
  powerKw: number,
  targetHours: number[],
  targetSocs: number[],
  priceSlots: PriceSlot[]
): number[][] {
  const matrix: number[][] = [];

  for (let h = 0; h < targetHours.length; h++) {
    const targetTime = targetHours[h];
    const slotsUntilTarget = priceSlots.filter(
      (s) => s.start_timestamp < targetTime
    );
    const row: number[] = [];

    for (let s = 0; s < targetSocs.length; s++) {
      const targetSoc = targetSocs[s];
      const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, capacityKwh, powerKw);
      const avg = hoursNeeded === 0 ? 0 : getCheapestAveragePrice(slotsUntilTarget, hoursNeeded);
      row.push(avg);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Compute the max price matrix for the 3D max-price chart.
 * Same structure as computeMatrix, but each cell holds the max price among the N cheapest hours.
 * @returns 2D array [targetHourIndex][targetSocIndex] = max price Eur/MWh, or NaN if impossible
 */
export function computeMaxMatrix(
  currentSoc: number,
  capacityKwh: number,
  powerKw: number,
  targetHours: number[],
  targetSocs: number[],
  priceSlots: PriceSlot[]
): number[][] {
  const matrix: number[][] = [];

  for (let h = 0; h < targetHours.length; h++) {
    const targetTime = targetHours[h];
    const slotsUntilTarget = priceSlots.filter(
      (s) => s.start_timestamp < targetTime
    );
    const row: number[] = [];

    for (let s = 0; s < targetSocs.length; s++) {
      const targetSoc = targetSocs[s];
      const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, capacityKwh, powerKw);
      const max = hoursNeeded === 0 ? 0 : getCheapestMaxPrice(slotsUntilTarget, hoursNeeded);
      row.push(max);
    }
    matrix.push(row);
  }
  return matrix;
}
