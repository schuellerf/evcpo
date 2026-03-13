/**
 * EV Charge Price Optimizer - main entry point.
 */

import { fetchPriceData } from './api';
import { getHoursNeeded, getCheapestAveragePrice, computeMatrix } from './calculator';
import { render3DChart, type ChartData } from './chart';

const CT_PER_MWH = 10;

function getNextFullHour(date: Date): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + 1);
  next.setMinutes(0, 0, 0);
  return next;
}

/** Start of the current hour (e.g. 14:30 -> 14:00). Used for chart range. */
function getStartOfCurrentHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/** All full hours from now (current hour) until tomorrow 23:00 inclusive. */
function getTargetHoursUntilTomorrow23(): Date[] {
  const now = new Date();
  const hours: Date[] = [];
  let cursor = getStartOfCurrentHour(now);
  const tomorrow23 = new Date(now);
  tomorrow23.setDate(tomorrow23.getDate() + 1);
  tomorrow23.setHours(23, 0, 0, 0);
  while (cursor <= tomorrow23) {
    hours.push(new Date(cursor));
    cursor.setHours(cursor.getHours() + 1);
  }
  return hours;
}

function getTargetSocs(currentSoc: number): number[] {
  const socs: number[] = [];
  const step = 5;
  let s = Math.max(currentSoc, 20);
  if (s % step !== 0) s = Math.ceil(s / step) * step;
  for (; s <= 100; s += step) socs.push(s);
  return socs.length ? socs : [100];
}

function setDefaultTargetTime(): void {
  const input = document.getElementById('target-time') as HTMLInputElement;
  if (input && !input.value) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    input.value = tomorrow.toISOString().slice(0, 16);
  }
}

function formatResult(hours: number, avgPriceEurMWh: number): string {
  const ct = (avgPriceEurMWh / CT_PER_MWH).toFixed(2);
  return `Charge for ${hours} hour${hours === 1 ? '' : 's'}. Average price: ${ct} ct/kWh`;
}

async function runCalculation(): Promise<void> {
  const currentSoc = parseFloat(
    (document.getElementById('current-soc') as HTMLInputElement).value
  );
  const targetSoc = parseFloat(
    (document.getElementById('target-soc') as HTMLInputElement).value
  );
  const targetTimeStr = (document.getElementById('target-time') as HTMLInputElement)
    .value;
  const chargeSpeed = parseFloat(
    (document.getElementById('charge-speed') as HTMLInputElement).value
  );
  const resultEl = document.getElementById('result-text');
  if (!resultEl) return;
  resultEl.textContent = 'Loading…';
  try {
    const targetTime = new Date(targetTimeStr);
    const nextHour = getNextFullHour(new Date());
    const endMs = targetTime.getTime();
    const startMs = nextHour.getTime();
    if (startMs >= endMs) {
      resultEl.textContent = 'Target time must be after the next full hour.';
      return;
    }
    const slots = await fetchPriceData(startMs, endMs);
    const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, chargeSpeed);
    const avgPrice = getCheapestAveragePrice(slots, hoursNeeded);
    if (Number.isNaN(avgPrice)) {
      resultEl.textContent = `Not enough price slots. Need ${hoursNeeded} hours, got ${slots.length}.`;
      return;
    }
    resultEl.textContent = formatResult(hoursNeeded, avgPrice);
  } catch (e) {
    resultEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function updateChart(): Promise<void> {
  const currentSoc = parseFloat(
    (document.getElementById('current-soc') as HTMLInputElement).value
  );
  const chargeSpeed = parseFloat(
    (document.getElementById('charge-speed') as HTMLInputElement).value
  );
  const chartEl = document.getElementById('chart');
  if (!chartEl) return;
  chartEl.innerHTML = '<p class="chart-loading">Loading…</p>';
  try {
    const targetHourDates = getTargetHoursUntilTomorrow23();
    if (targetHourDates.length === 0) {
      chartEl.innerHTML = '<p>No target hours available.</p>';
      return;
    }
    const targetHours = targetHourDates.map((d) => d.getTime());
    const firstHour = targetHourDates[0];
    const lastHour = targetHourDates[targetHourDates.length - 1];
    const startMs = firstHour.getTime();
    const endMs = lastHour.getTime() + 3600 * 1000;
    const priceSlots = await fetchPriceData(startMs, endMs);
    const targetSocs = getTargetSocs(currentSoc);
    const matrix = computeMatrix(
      currentSoc,
      chargeSpeed,
      targetHours,
      targetSocs,
      priceSlots
    );
    const targetSoc = parseFloat(
      (document.getElementById('target-soc') as HTMLInputElement).value
    );
    const chartData: ChartData = {
      targetHours,
      targetSocs,
      matrix,
      highlightSoc: targetSoc,
    };
    chartEl.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.id = 'plotly-chart';
    chartDiv.className = 'chart-inner';
    chartEl.appendChild(chartDiv);
    render3DChart('plotly-chart', chartData);
  } catch (e) {
    chartEl.innerHTML = `<p class="chart-error">Error: ${e instanceof Error ? e.message : String(e)}</p>`;
  }
}

function init(): void {
  setDefaultTargetTime();
  document.getElementById('calculate')?.addEventListener('click', runCalculation);
  document.getElementById('update-chart')?.addEventListener('click', updateChart);
  document.getElementById('target-soc')?.addEventListener('input', updateChart);
  document.getElementById('target-soc')?.addEventListener('change', updateChart);
  updateChart();
}

init();
