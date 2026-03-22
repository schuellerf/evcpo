/**
 * EV Charge Price Optimizer - main entry point.
 */

import { fetchPriceData, clearPriceCache } from './api';
import { getHoursNeeded, getCheapestAveragePrice, getCheapestMaxPrice, computeMatrix, computeMaxMatrix, netToGrossCtPerKwh, EXTRA_CT_DEFAULT } from './calculator';
import { t, getLocale, setLocale, setRegion, getStoredRegion } from './i18n';
import Plotly from 'plotly.js-dist-min';
import {
  render3DChart,
  render2DFixedTimeChart,
  render2DFixedSocChart,
  render2DFixedTimeMaxChart,
  render2DFixedSocMaxChart,
  render3DMaxChart,
  type ChartData,
} from './chart';

const CT_PER_MWH = 10;

function getExtraCt(): number {
  const el = document.getElementById('extra-ct') as HTMLInputElement;
  if (!el) return EXTRA_CT_DEFAULT;
  const v = parseFloat(el.value);
  if (!Number.isFinite(v)) return EXTRA_CT_DEFAULT;
  return Math.max(0, Math.min(50, v));
}

function applyTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
  const fnNet = document.getElementById('footnote-net-text');
  if (fnNet) fnNet.textContent = t('footnoteNet');
  document.title = t('appTitle');
  document.documentElement.lang = getLocale() === 'de' ? 'de' : 'en';
}

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

const NET_FN_SUP = '<sup><a href="#fn1">*</a></sup>';

function formatResult(
  hours: number,
  avgPriceEurMWh: number,
  currentSoc: number,
  targetSoc: number,
  evCapacity: number,
  efficiency: number,
  maxPriceEurMWh?: number,
  useGrossPrices = false,
  extraCt = EXTRA_CT_DEFAULT
): string {
  const isNet = !useGrossPrices;
  const avgCtPerKwh = useGrossPrices
    ? netToGrossCtPerKwh(avgPriceEurMWh, extraCt)
    : avgPriceEurMWh / CT_PER_MWH;
  const maxCtPerKwh =
    maxPriceEurMWh != null && !Number.isNaN(maxPriceEurMWh)
      ? useGrossPrices
        ? netToGrossCtPerKwh(maxPriceEurMWh, extraCt)
        : maxPriceEurMWh / CT_PER_MWH
      : null;

  const avgLabel = t('averagePrice') + (isNet ? NET_FN_SUP : '');
  const maxLabel = t('maxPrice') + (isNet ? NET_FN_SUP : '');
  const totalLabel = t('totalPrice') + (isNet ? NET_FN_SUP : '');
  const per100Label = t('pricePer100km') + (isNet ? NET_FN_SUP : '');

  const chargeLine = hours === 1 ? t('chargeForHour') : t('chargeForHours', { hours });
  let s = `${chargeLine}<br>${avgLabel}: ${avgCtPerKwh.toFixed(2)} ct/kWh.`;
  if (maxCtPerKwh != null) {
    s += `<br>${maxLabel}: ${maxCtPerKwh.toFixed(2)} ct/kWh`;
  }
  const deltaPercent = Math.max(0, (targetSoc - currentSoc) / 100);
  const totalKwh = deltaPercent * evCapacity;
  const totalPriceEur = (totalKwh * avgCtPerKwh) / 100;
  const pricePer100kmEur = (efficiency * avgCtPerKwh) / 100;
  s += `<br>${totalLabel}: ${totalPriceEur.toFixed(2)} €`;
  s += `<br>${per100Label}: ${pricePer100kmEur.toFixed(2)} €`;
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
  resultEl.textContent = t('loading');
  document.getElementById('footnote-net')?.setAttribute('aria-hidden', 'true');
  try {
    const targetTime = new Date(`${targetDateStr}T${targetTimeStr}`);
    const nextHour = getNextFullHour(new Date());
    const endMs = targetTime.getTime();
    const startMs = nextHour.getTime();
    if (startMs >= endMs) {
      resultEl.textContent = t('targetTimeError');
      return;
    }
    const slots = await fetchPriceData(startMs, endMs);
    const hoursNeeded = getHoursNeeded(currentSoc, targetSoc, evCapacity, powerKw);
    const avgPrice = getCheapestAveragePrice(slots, hoursNeeded);
    if (Number.isNaN(avgPrice)) {
      resultEl.textContent = t('notEnoughSlots', { need: hoursNeeded, got: slots.length });
      return;
    }
    const maxPrice = getCheapestMaxPrice(slots, hoursNeeded);
    const efficiency = Math.max(13, Math.min(45, parseFloat((document.getElementById('efficiency') as HTMLInputElement)?.value ?? '18')));
    const useGrossPrices = (document.getElementById('use-gross-prices') as HTMLInputElement)?.checked ?? false;
    const extraCt = getExtraCt();
    resultEl.innerHTML = formatResult(hoursNeeded, avgPrice, currentSoc, targetSoc, evCapacity, efficiency, maxPrice, useGrossPrices, extraCt);

    const footnoteEl = document.getElementById('footnote-net');
    if (footnoteEl) {
      footnoteEl.setAttribute('aria-hidden', String(useGrossPrices));
    }
    if (!useGrossPrices) {
      resultEl.setAttribute('aria-describedby', 'footnote-net');
    } else {
      resultEl.removeAttribute('aria-describedby');
    }
  } catch (e) {
    resultEl.textContent = t('errorPrefix') + (e instanceof Error ? e.message : String(e));
    document.getElementById('footnote-net')?.setAttribute('aria-hidden', 'true');
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
  chartEl.innerHTML = `<p class="chart-loading">${t('loading')}</p>`;
  try {
    const targetHourDates = getTargetHoursUntilTomorrow23();
    if (targetHourDates.length === 0) {
      chartEl.innerHTML = `<p>${t('noTargetHours')}</p>`;
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
    const useGrossPrices = (document.getElementById('use-gross-prices') as HTMLInputElement)?.checked ?? false;
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
      useGrossPrices,
      extraCt: getExtraCt(),
    };
    chartEl.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.id = 'plotly-chart';
    chartDiv.className = 'chart-inner';
    chartEl.appendChild(chartDiv);
    render3DChart('plotly-chart', chartData);
    render2DFixedTimeChart('chart-2d-fixed-time', chartData);
    render2DFixedSocChart('chart-2d-fixed-soc', chartData);
    render2DFixedTimeMaxChart('chart-2d-fixed-time-max', chartData);
    render2DFixedSocMaxChart('chart-2d-fixed-soc-max', chartData);
    render3DMaxChart('chart-3d-max-inner', chartData);
    requestAnimationFrame(() => {
      const visiblePanel = document.querySelector('.tab-panel.active');
      if (visiblePanel) {
        ['plotly-chart', 'chart-3d-max-inner', 'chart-2d-fixed-time', 'chart-2d-fixed-soc', 'chart-2d-fixed-time-max', 'chart-2d-fixed-soc-max'].forEach((id) => {
          const el = document.getElementById(id);
          if (el?.querySelector('.plotly') && visiblePanel.contains(el)) {
            Plotly.Plots.resize(el);
          }
        });
      }
    });
  } catch (e) {
    chartEl.innerHTML = `<p class="chart-error">${t('errorPrefix')}${e instanceof Error ? e.message : String(e)}</p>`;
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
  { numId: 'efficiency', sliderId: 'efficiency-slider', min: 13, max: 45 },
];

function init(): void {
  setDefaultTargetTime();

  document.documentElement.lang = getLocale() === 'de' ? 'de' : 'en';
  const savedRegion = getStoredRegion();
  const regionRadio = document.querySelector(`input[name="region"][value="${savedRegion}"]`) as HTMLInputElement;
  if (regionRadio) regionRadio.checked = true;

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const lang = (btn as HTMLElement).dataset.lang as 'de' | 'en';
    if (!lang) return;
    btn.classList.toggle('active', getLocale() === lang);
    btn.addEventListener('click', () => {
      setLocale(lang);
      applyTranslations();
      document.querySelectorAll('.lang-btn').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset.lang === lang);
      });
      refreshAll();
    });
  });

  const debouncedRefresh = debounce(refreshAll, 350);

  document.querySelectorAll('input[name="region"]').forEach((el) => {
    el.addEventListener('change', () => {
      const r = (el as HTMLInputElement).value as 'at' | 'de';
      if (r === 'at' || r === 'de') {
        setRegion(r);
        clearPriceCache();
        debouncedRefresh();
      }
    });
  });

  document.getElementById('extra-ct')?.addEventListener('input', debouncedRefresh);
  document.getElementById('extra-ct')?.addEventListener('change', debouncedRefresh);

  window.addEventListener('localechange', () => {
    applyTranslations();
    refreshAll();
  });

  applyTranslations();

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

  document.getElementById('use-gross-prices')?.addEventListener('change', debouncedRefresh);

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

  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab;
      document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-panel-${tab}`);
      if (panel) panel.classList.add('active');
      requestAnimationFrame(() => {
        ['plotly-chart', 'chart-3d-max-inner', 'chart-2d-fixed-time', 'chart-2d-fixed-soc', 'chart-2d-fixed-time-max', 'chart-2d-fixed-soc-max'].forEach((id) => {
          const el = document.getElementById(id);
          if (el?.querySelector('.plotly')) {
            Plotly.Plots.resize(el);
          }
        });
      });
    });
  });

  updatePowerDisplay();
  refreshAll();
}

init();
