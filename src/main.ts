/**
 * EV Charge Price Optimizer - main entry point.
 */

import { fetchPriceData } from './api';
import { getHoursNeeded, getCheapestAveragePrice, getCheapestMaxPrice, computeMatrix, computeMaxMatrix } from './calculator';
import {
  render3DChart,
  render2DFixedTimeChart,
  render2DFixedSocChart,
  render3DMaxChart,
  type ChartData,
} from './chart';

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
  const socs = new Set<number>();
  const step = 5;
  if (currentSoc >= 20 && currentSoc <= 100) socs.add(currentSoc);
  let s = Math.max(currentSoc, 20);
  if (s % step !== 0) s = Math.ceil(s / step) * step;
  for (; s <= 100; s += step) socs.add(s);
  return Array.from(socs).sort((a, b) => a - b);
}

function setDefaultTargetTime(): void {
  const dateInput = document.getElementById('target-date') as HTMLInputElement;
  const timeInput = document.getElementById('target-time') as HTMLInputElement;
  if (dateInput && !dateInput.value) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().slice(0, 10);
  }
  if (timeInput && !timeInput.value) {
    timeInput.value = '10:00';
  }
}

function getPowerKw(): number {
  const amps = parseInt((document.getElementById('charge-amps') as HTMLInputElement)?.value ?? '16', 10);
  const phases = (document.getElementById('charge-3phase') as HTMLInputElement)?.checked ? 3 : 1;
  const voltageEl = document.querySelector('input[name="voltage"]:checked') as HTMLInputElement;
  const voltage = parseInt(voltageEl?.value ?? '230', 10);
  const clampedAmps = Math.max(6, Math.min(16, amps));
  return (voltage * clampedAmps * phases) / 1000;
}

function updatePowerDisplay(): void {
  const ampsEl = document.getElementById('charge-amps') as HTMLInputElement;
  const ampsValueEl = document.getElementById('charge-amps-value');
  const powerKwEl = document.getElementById('power-kw');
  if (ampsEl && ampsValueEl) ampsValueEl.textContent = ampsEl.value;
  if (powerKwEl) powerKwEl.textContent = getPowerKw().toFixed(2);
}

function formatResult(hours: number, avgPriceEurMWh: number, maxPriceEurMWh?: number): string {
  const ct = (avgPriceEurMWh / CT_PER_MWH).toFixed(2);
  let s = `Charge for ${hours} hour${hours === 1 ? '' : 's'}. Average price: ${ct} ct/kWh`;
  if (maxPriceEurMWh != null && !Number.isNaN(maxPriceEurMWh)) {
    const maxCt = (maxPriceEurMWh / CT_PER_MWH).toFixed(2);
    s += `. Max price: ${maxCt} ct/kWh`;
  }
  return s;
}

async function runCalculation(): Promise<void> {
  const currentSoc = parseFloat(
    (document.getElementById('current-soc') as HTMLInputElement).value
  );
  const targetSoc = parseFloat(
    (document.getElementById('target-soc') as HTMLInputElement).value
  );
  const targetDateStr = (document.getElementById('target-date') as HTMLInputElement).value;
  const targetTimeStr = (document.getElementById('target-time') as HTMLInputElement).value;
  const evCapacity = parseFloat(
    (document.getElementById('ev-capacity') as HTMLInputElement).value
  );
  const powerKw = getPowerKw();
  const resultEl = document.getElementById('result-text');
  if (!resultEl) return;
  resultEl.textContent = 'Loading…';
  try {
    const targetTime = new Date(`${targetDateStr}T${targetTimeStr}`);
    const nextHour = getNextFullHour(new Date());
    const endMs = targetTime.getTime();
    const startMs = nextHour.getTime();
    if (startMs >= endMs) {
      resultEl.textContent = 'Target time must be after the next full hour.';
      return;
    }
    const slots = await fetchPriceData(startMs, endMs);
    const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, evCapacity, powerKw);
    const avgPrice = getCheapestAveragePrice(slots, hoursNeeded);
    if (Number.isNaN(avgPrice)) {
      resultEl.textContent = `Not enough price slots. Need ${hoursNeeded} hours, got ${slots.length}.`;
      return;
    }
    const maxPrice = getCheapestMaxPrice(slots, hoursNeeded);
    resultEl.textContent = formatResult(hoursNeeded, avgPrice, maxPrice);
  } catch (e) {
    resultEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function updateChart(): Promise<void> {
  const currentSoc = parseFloat(
    (document.getElementById('current-soc') as HTMLInputElement).value
  );
  const evCapacity = parseFloat(
    (document.getElementById('ev-capacity') as HTMLInputElement).value
  );
  const powerKw = getPowerKw();
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
      evCapacity,
      powerKw,
      targetHours,
      targetSocs,
      priceSlots
    );
    const maxMatrix = computeMaxMatrix(
      currentSoc,
      evCapacity,
      powerKw,
      targetHours,
      targetSocs,
      priceSlots
    );
    const targetSoc = parseFloat(
      (document.getElementById('target-soc') as HTMLInputElement).value
    );
    const targetDateStr = (document.getElementById('target-date') as HTMLInputElement).value;
    const targetTimeStr = (document.getElementById('target-time') as HTMLInputElement).value;
    const targetTime = targetDateStr && targetTimeStr ? new Date(`${targetDateStr}T${targetTimeStr}`) : null;
    const highlightHour = targetTime ? (targetTime.setMinutes(0, 0, 0), targetTime.getTime()) : undefined;
    const isPriceMode = (document.getElementById('z-mode-price') as HTMLInputElement)?.checked ?? false;
    const chartData: ChartData = {
      targetHours,
      targetSocs,
      matrix,
      maxMatrix,
      currentSoc,
      evCapacity,
      zMode: isPriceMode ? 'price' : 'ct-per-kwh',
      powerKw,
      highlightSoc: targetSoc,
      highlightHour,
    };
    chartEl.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.id = 'plotly-chart';
    chartDiv.className = 'chart-inner';
    chartEl.appendChild(chartDiv);
    render3DChart('plotly-chart', chartData);
    render2DFixedTimeChart('chart-2d-fixed-time', chartData);
    render2DFixedSocChart('chart-2d-fixed-soc', chartData);
    render3DMaxChart('chart-3d-max', chartData);
  } catch (e) {
    chartEl.innerHTML = `<p class="chart-error">Error: ${e instanceof Error ? e.message : String(e)}</p>`;
  }
}

function debounce(fn: () => void, ms: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fn, ms);
  };
}

function refreshAll(): void {
  void runCalculation();
  void updateChart();
}

const SLIDER_PAIRS: { numId: string; sliderId: string; min: number; max: number }[] = [
  { numId: 'current-soc', sliderId: 'current-soc-slider', min: 0, max: 100 },
  { numId: 'target-soc', sliderId: 'target-soc-slider', min: 0, max: 100 },
  { numId: 'ev-capacity', sliderId: 'ev-capacity-slider', min: 40, max: 100 },
];

function init(): void {
  setDefaultTargetTime();
  const debouncedRefresh = debounce(refreshAll, 350);

  for (const { numId, sliderId, min, max } of SLIDER_PAIRS) {
    const numEl = document.getElementById(numId) as HTMLInputElement;
    const sliderEl = document.getElementById(sliderId) as HTMLInputElement;
    if (numEl && sliderEl) {
      numEl.addEventListener('input', () => {
        const v = Math.round(parseFloat(numEl.value) || min);
        sliderEl.value = String(Math.max(min, Math.min(max, v)));
        debouncedRefresh();
      });
      numEl.addEventListener('change', () => {
        const v = Math.round(parseFloat(numEl.value) || min);
        const clamped = Math.max(min, Math.min(max, v));
        numEl.value = String(clamped);
        sliderEl.value = String(clamped);
        debouncedRefresh();
      });
      sliderEl.addEventListener('input', () => {
        numEl.value = sliderEl.value;
        debouncedRefresh();
      });
      sliderEl.addEventListener('change', () => {
        numEl.value = sliderEl.value;
        debouncedRefresh();
      });
    }
  }

  for (const id of ['target-date', 'target-time']) {
    document.getElementById(id)?.addEventListener('input', debouncedRefresh);
    document.getElementById(id)?.addEventListener('change', debouncedRefresh);
  }

  document.getElementById('z-mode-price')?.addEventListener('change', () => void updateChart());

  const powerInputs = ['charge-amps', 'charge-3phase'];
  for (const id of powerInputs) {
    document.getElementById(id)?.addEventListener('input', () => {
      updatePowerDisplay();
      debouncedRefresh();
    });
    document.getElementById(id)?.addEventListener('change', () => {
      updatePowerDisplay();
      debouncedRefresh();
    });
  }
  document.querySelectorAll('input[name="voltage"]').forEach((el) => {
    el.addEventListener('change', () => {
      updatePowerDisplay();
      debouncedRefresh();
    });
  });

  updatePowerDisplay();
  refreshAll();
}

init();
