/**
 * Core price optimization logic for EV charging.
 */

import type { PriceSlot } from './api';

/**
 * Number of hours needed to charge from current SOC to target SOC.
 * Rounded up to ensure target is reached.
 */
export function getHoursNeeded(
  currentSoc: number,
  targetSoc: number,
  chargeSpeedPerHour: number
): number {
  if (targetSoc <= currentSoc || chargeSpeedPerHour <= 0) return 0;
  return Math.ceil((targetSoc - currentSoc) / chargeSpeedPerHour);
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
  if (hoursNeeded <= 0 || slots.length === 0) return NaN;
  const sorted = [...slots].sort((a, b) => a.marketprice - b.marketprice);
  const selected = sorted.slice(0, hoursNeeded);
  if (selected.length < hoursNeeded) return NaN;
  const sum = selected.reduce((acc, s) => acc + s.marketprice, 0);
  return sum / hoursNeeded;
}

/**
 * Compute the average price matrix for the 3D chart.
 * @param currentSoc - Current SOC (%)
 * @param chargeSpeed - Charge speed (%/hour)
 * @param targetHours - Array of target hour timestamps (start of each hour)
 * @param targetSocs - Array of target SOC values (%)
 * @param priceSlots - All available price slots (must cover the time range)
 * @returns 2D array [targetHourIndex][targetSocIndex] = average price Eur/MWh, or NaN if impossible
 */
export function computeMatrix(
  currentSoc: number,
  chargeSpeed: number,
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
      const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, chargeSpeed);
      const avg = getCheapestAveragePrice(slotsUntilTarget, hoursNeeded);
      row.push(avg);
    }
    matrix.push(row);
  }
  return matrix;
}
