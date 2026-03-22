/**
 * 3D chart for average price by target hour and target SOC.
 */

import Plotly from 'plotly.js-dist-min';
import { getHoursNeeded, netToGrossCtPerKwh, EXTRA_CT_DEFAULT } from './calculator';
import { t } from './i18n';

export type ZMode = 'ct-per-kwh' | 'price';

export interface ChartData {
  targetHours: number[];
  targetSocs: number[];
  matrix: number[][];
  /** Current SOC (%) for highlight logic and hours calculation. */
  currentSoc: number;
  /** EV battery capacity (kWh) for hours calculation. */
  evCapacity: number;
  /** Z-axis display mode: ct/kWh or price (× kW × h). */
  zMode: ZMode;
  /** Power in kW for price mode (ct/kWh × kW × hours). */
  powerKw?: number;
  /** If set, only this SOC value gets a red highlight line (user's chosen target SOC). */
  highlightSoc?: number;
  /** If set, draw a red line at this target time (timestamp of start of hour). */
  highlightHour?: number;
  /** Max price matrix (Eur/MWh) for the 3D max-price chart. Same layout as matrix. */
  maxMatrix?: number[][];
  /** When true, display gross prices (net + 1.5 ct/kWh + VAT + extra) instead of net. */
  useGrossPrices?: boolean;
  /** Extra costs (ct/kWh) for gross mode. Default 13.5. */
  extraCt?: number;
}

const CT_PER_MWH = 10; // 1 Eur/MWh = 0.1 ct/kWh for net display

function toCtPerKwh(v: number, useGross: boolean, extraCt: number): number {
  return useGross ? netToGrossCtPerKwh(v, extraCt) : v / CT_PER_MWH;
}

function buildChartData(data: ChartData, opts?: { valueLabel?: 'Avg' | 'Max' }) {
  const { targetHours, targetSocs, matrix, currentSoc, evCapacity, zMode, powerKw = 0, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;
  const valueLabel = opts?.valueLabel === 'Max' ? t('chartMax') : t('chartAvg');
  const useGross = useGrossPrices;

  // X = target SOC, Y = target hour (swapped from original)
  const x = targetSocs.map((s) => `${s}%`);
  const yLabels = targetHours.map((ts) => {
    const d = new Date(ts);
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    });
    return `${day} ${d.getHours()}:00`;
  });
  const y = yLabels;
  const isPrice = zMode === 'price';
  // Plotly surface: z[y_index][x_index], so z[hour_idx][soc_idx] = matrix[h][s]
  const z = targetHours.map((_, h) =>
    targetSocs.map((_, s) => {
      const v = matrix[h][s];
      if (Number.isNaN(v)) return null;
      const isNoCharge = targetSocs[s] <= currentSoc;
      if (useGross && isNoCharge) return null;
      const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
      const ctPerKwh = toCtPerKwh(v, useGross, extraCt);
      if (!isPrice) return ctPerKwh;
      return (ctPerKwh * powerKw * hours) / 100;
    })
  );
  const text = targetHours.map((_, h) =>
    targetSocs.map((_, s) => {
      const v = matrix[h][s];
      if (Number.isNaN(v)) return `${t('chartTarget')}${y[h]} / ${x[s]} — ${t('chartNotEnoughHours')}`;
      const isNoCharge = targetSocs[s] <= currentSoc;
      if (useGross && isNoCharge) return `${t('chartTarget')}${y[h]} / ${x[s]} — ${t('chartNoCharging')}`;
      const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
      const ctPerKwh = toCtPerKwh(v, useGross, extraCt);
      if (!isPrice) return `${t('chartTarget')}${y[h]} / ${x[s]} — ${valueLabel}: ${ctPerKwh.toFixed(2)} ct/kWh (${v.toFixed(2)} Eur/MWh)`;
      const priceEur = (ctPerKwh * powerKw * hours) / 100;
      return `${t('chartTarget')}${y[h]} / ${x[s]} — ${valueLabel} price: €${priceEur.toFixed(2)} (${ctPerKwh.toFixed(2)} ct/kWh × ${powerKw.toFixed(2)} kW × ${hours}h)`;
    })
  );
  return { x, y, z, text, isPrice };
}

function zValue(
  matrix: number[][],
  h: number,
  s: number,
  currentSoc: number,
  targetSocs: number[],
  evCapacity: number,
  powerKw: number,
  isPrice: boolean,
  useGross = false,
  extraCt = EXTRA_CT_DEFAULT
): number {
  const v = matrix[h]?.[s];
  if (v == null || Number.isNaN(v)) return NaN;
  if (useGross && targetSocs[s] <= currentSoc) return NaN;
  const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
  const ctPerKwh = toCtPerKwh(v, useGross, extraCt);
  if (!isPrice) return ctPerKwh;
  return (ctPerKwh * powerKw * hours) / 100;
}

/**
 * Build red Scatter3d line trace only for the user's selected target SOC (highlightSoc).
 */
function buildSocLineTraces(data: ChartData): Record<string, unknown>[] {
  const { x, y, isPrice } = buildChartData(data);
  const { targetSocs, targetHours, matrix, highlightSoc, currentSoc, evCapacity, powerKw = 0, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;
  const traces: Record<string, unknown>[] = [];

  if (highlightSoc == null) return traces;

  let s = targetSocs.findIndex((soc) => soc === highlightSoc);
  if (s < 0) {
    const closest = targetSocs.reduce((a, b) =>
      Math.abs(a - highlightSoc) <= Math.abs(b - highlightSoc) ? a : b
    );
    s = targetSocs.indexOf(closest);
  }
  if (s < 0) return traces;

  const lineX: string[] = [];
  const lineY: string[] = [];
  const lineZ: (number | null)[] = [];

  for (let h = 0; h < targetHours.length; h++) {
    const z = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice, useGrossPrices, extraCt);
    if (!Number.isNaN(z)) {
      lineX.push(x[s]);
      lineY.push(y[h]);
      lineZ.push(z + 0.1);
    } else {
      if (lineX.length > 0) {
        lineX.push(null as unknown as string);
        lineY.push(null as unknown as string);
        lineZ.push(null);
      }
    }
  }

  traces.push({
    x: lineX,
    y: lineY,
    z: lineZ,
    type: 'scatter3d',
    mode: 'lines',
    line: { color: '#e63946', width: 4 },
    showlegend: false,
    hoverinfo: 'skip',
  });
  return traces;
}

/**
 * Build red Scatter3d line trace for the user's selected target time (highlightHour).
 * Line runs across SOC (x) at constant hour (y).
 */
function buildTargetTimeLineTraces(data: ChartData): Record<string, unknown>[] {
  const { x, y, isPrice } = buildChartData(data);
  const { targetSocs, targetHours, matrix, highlightHour, currentSoc, evCapacity, powerKw = 0, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;
  const traces: Record<string, unknown>[] = [];

  if (highlightHour == null || targetHours.length === 0) return traces;

  let h = targetHours.findIndex((ts) => ts === highlightHour);
  if (h < 0) {
    const closest = targetHours.reduce((a, b) =>
      Math.abs(a - highlightHour) <= Math.abs(b - highlightHour) ? a : b
    );
    h = targetHours.indexOf(closest);
  }
  if (h < 0) return traces;

  const lineX: string[] = [];
  const lineY: string[] = [];
  const lineZ: (number | null)[] = [];

  for (let s = 0; s < targetSocs.length; s++) {
    const z = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice, useGrossPrices, extraCt);
    if (!Number.isNaN(z)) {
      lineX.push(x[s]);
      lineY.push(y[h]);
      lineZ.push(z + 0.1);
    } else {
      if (lineX.length > 0) {
        lineX.push(null as unknown as string);
        lineY.push(null as unknown as string);
        lineZ.push(null);
      }
    }
  }

  traces.push({
    x: lineX,
    y: lineY,
    z: lineZ,
    type: 'scatter3d',
    mode: 'lines',
    line: { color: '#e63946', width: 4 },
    showlegend: false,
    hoverinfo: 'skip',
  });
  return traces;
}

/**
 * Render a 3D surface chart.
 * X: target hour (unique labels across 48h)
 * Y: target SOC (%)
 * Z: average price (ct/kWh)
 */
export function render3DChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { x, y, z, text, isPrice } = buildChartData(data);
  const zAxisTitle = isPrice ? t('chartPriceEur') : t('chartAvgPrice');
  const chartTitle = isPrice ? t('chartPriceBy') : t('chartAvgPriceBy');

  const surfaceTrace = {
    x,
    y,
    z,
    type: 'surface' as const,
    colorscale: 'Viridis',
    colorbar: { len: 0.9, y: 1, yanchor: 'top' as const },
    hoverinfo: 'text' as const,
    text,
    contours: isPrice
      ? { x: { show: false, highlight: false }, y: { show: false, highlight: false }, z: { show: false, highlight: true, highlightcolor: '#22c55e' } }
      : { x: { show: false, highlight: true }, y: { show: false, highlight: true }, z: { show: false, highlight: false } },
  };

  const socLineTraces = buildSocLineTraces(data);
  const timeLineTraces = buildTargetTimeLineTraces(data);

  const sceneCamera = {
    eye: { x: 1.5, y: 1.5, z: 1.2 },
    center: { x: 0, y: 0, z: -0.3 },
    up: { x: 0, y: 0, z: 1 },
  };

  const layout = {
    title: { text: chartTitle },
    scene: {
      xaxis: { title: { text: t('chartTargetSoc') }, autorange: 'reversed' as const, showspikes: false },
      yaxis: { title: { text: t('chartTargetHour') }, showspikes: false },
      zaxis: { title: { text: zAxisTitle }, showspikes: false },
      camera: sceneCamera,
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const config = { responsive: true };

  const allTraces = [surfaceTrace, ...socLineTraces, ...timeLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, allTraces as any, layout, config).then(() => {
    Plotly.relayout(containerId, { 'scene.camera': sceneCamera } as Partial<Plotly.Layout>);
    onReady?.();
  });
}

/**
 * Update an existing chart with new data.
 */
export function update3DChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { x, y, z, text, isPrice } = buildChartData(data);
  const zAxisTitle = isPrice ? 'Price (€)' : 'Avg Price (ct/kWh)';
  const chartTitle = isPrice ? 'Price (€) by Target SOC and Target Hour' : 'Average Price (ct/kWh) by Target SOC and Target Hour';
  const socLineTraces = buildSocLineTraces(data);
  const timeLineTraces = buildTargetTimeLineTraces(data);

  const surfaceTrace = {
    x,
    y,
    z,
    text,
    type: 'surface' as const,
    colorscale: 'Viridis',
    colorbar: { len: 0.9, y: 1, yanchor: 'top' as const },
    hoverinfo: 'text' as const,
    contours: isPrice
      ? { x: { show: false, highlight: false }, y: { show: false, highlight: false }, z: { show: false, highlight: true, highlightcolor: '#22c55e' } }
      : { x: { show: false, highlight: true }, y: { show: false, highlight: true }, z: { show: false, highlight: false } },
  };

  const sceneCamera = {
    eye: { x: 1.5, y: 1.5, z: 1.2 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  };

  const layout = {
    title: { text: chartTitle },
    scene: {
      xaxis: { title: { text: t('chartTargetSoc') }, autorange: 'reversed' as const, showspikes: false },
      yaxis: { title: { text: t('chartTargetHour') }, showspikes: false },
      zaxis: { title: { text: zAxisTitle }, showspikes: false },
      camera: sceneCamera,
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const allTraces = [surfaceTrace, ...socLineTraces, ...timeLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.react(containerId, allTraces as any, layout).then(() => onReady?.());
}

/**
 * Render 2D line chart: Price vs Target SOC at fixed target time.
 * Represents the red horizontal line from the 3D chart.
 */
export function render2DFixedTimeChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { targetSocs, targetHours, matrix, highlightHour, currentSoc, evCapacity, powerKw = 0, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;
  const isPrice = data.zMode === 'price';

  if (highlightHour == null || targetHours.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  let h = targetHours.findIndex((ts) => ts === highlightHour);
  if (h < 0) {
    const closest = targetHours.reduce((a, b) =>
      Math.abs(a - highlightHour) <= Math.abs(b - highlightHour) ? a : b
    );
    h = targetHours.indexOf(closest);
  }
  if (h < 0) {
    Plotly.purge(containerId);
    return;
  }

  const x = targetSocs.map((s) => `${s}%`);
  const y = targetSocs.map((_, s) => {
    const v = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice, useGrossPrices, extraCt);
    return Number.isNaN(v) ? null : v;
  });

  const hourLabel = (() => {
    const d = new Date(highlightHour);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  const yAxisTitle = isPrice ? t('chartPriceEur') : t('chartAvgPrice');
  const unit = isPrice ? '€' : 'ct/kWh';
  const text = x.map((pct, i) => {
    const v = y[i];
    return v != null ? `${pct}: ${(v as number).toFixed(2)} ${unit}` : '';
  });
  const trace = {
    x,
    y,
    text,
    hoverinfo: 'text' as const,
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    line: { color: '#e63946' as const, width: 2 },
    marker: { size: 6 },
    connectgaps: false,
  };

  const layout = {
    title: { text: t('chartPriceAt', { hour: hourLabel }) },
    xaxis: { title: { text: t('chartTargetSoc') }, gridcolor: '#333' },
    yaxis: { title: { text: yAxisTitle }, gridcolor: '#333', rangemode: 'tozero' as const },
    margin: { t: 40, b: 40, l: 50, r: 20 },
    paper_bgcolor: 'transparent' as const,
    plot_bgcolor: 'transparent' as const,
    font: { color: '#eee' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [trace] as any, layout, { responsive: true }).then(() => onReady?.());
}

/**
 * Render 2D line chart: Max Price (ct/kWh) vs Target SOC at fixed target time.
 * Always shows ct/kWh; Price (€) checkbox has no effect.
 */
export function render2DFixedTimeMaxChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const maxMatrix = data.maxMatrix;
  if (!maxMatrix || maxMatrix.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  const { targetSocs, targetHours, highlightHour, currentSoc, evCapacity, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;

  if (highlightHour == null || targetHours.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  let h = targetHours.findIndex((ts) => ts === highlightHour);
  if (h < 0) {
    const closest = targetHours.reduce((a, b) =>
      Math.abs(a - highlightHour) <= Math.abs(b - highlightHour) ? a : b
    );
    h = targetHours.indexOf(closest);
  }
  if (h < 0) {
    Plotly.purge(containerId);
    return;
  }

  const x = targetSocs.map((s) => `${s}%`);
  const y = targetSocs.map((_, s) => {
    const v = zValue(maxMatrix, h, s, currentSoc, targetSocs, evCapacity, 0, false, useGrossPrices, extraCt);
    return Number.isNaN(v) ? null : v;
  });

  const hourLabel = (() => {
    const d = new Date(highlightHour);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  const text = x.map((pct, i) => {
    const v = y[i];
    return v != null ? `${pct}: ${(v as number).toFixed(2)} ct/kWh` : '';
  });
  const trace = {
    x,
    y,
    text,
    hoverinfo: 'text' as const,
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    line: { color: '#e63946' as const, width: 2 },
    marker: { size: 6 },
    connectgaps: false,
  };

  const layout = {
    title: { text: t('chartMaxPriceAt', { hour: hourLabel }) },
    xaxis: { title: { text: t('chartTargetSoc') }, gridcolor: '#333' },
    yaxis: { title: { text: t('chartMaxPrice') }, gridcolor: '#333', rangemode: 'tozero' as const },
    margin: { t: 40, b: 40, l: 50, r: 20 },
    paper_bgcolor: 'transparent' as const,
    plot_bgcolor: 'transparent' as const,
    font: { color: '#eee' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [trace] as any, layout, { responsive: true }).then(() => onReady?.());
}

/**
 * Render 2D line chart: Price vs Target Hour at fixed target SOC.
 * Represents the red vertical line from the 3D chart.
 */
export function render2DFixedSocChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { targetSocs, targetHours, matrix, highlightSoc, currentSoc, evCapacity, powerKw = 0, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;
  const isPrice = data.zMode === 'price';

  if (highlightSoc == null || targetSocs.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  let s = targetSocs.findIndex((soc) => soc === highlightSoc);
  if (s < 0) {
    const closest = targetSocs.reduce((a, b) =>
      Math.abs(a - highlightSoc) <= Math.abs(b - highlightSoc) ? a : b
    );
    s = targetSocs.indexOf(closest);
  }
  if (s < 0) {
    Plotly.purge(containerId);
    return;
  }

  const yLabels = targetHours.map((ts) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'numeric' })} ${d.getHours()}:00`;
  });
  const x = yLabels;
  const y = targetHours.map((_, h) => {
    const v = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice, useGrossPrices, extraCt);
    return Number.isNaN(v) ? null : v;
  });

  const yAxisTitle = isPrice ? t('chartPriceEur') : t('chartAvgPrice');
  const trace = {
    x,
    y,
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    line: { color: '#e63946' as const, width: 2 },
    marker: { size: 6 },
    connectgaps: false,
  };

  const layout = {
    title: { text: t('chartPriceByHour', { soc: highlightSoc }) },
    xaxis: { title: { text: t('chartTargetHour') }, gridcolor: '#333', tickangle: -45 },
    yaxis: { title: { text: yAxisTitle }, gridcolor: '#333', rangemode: 'tozero' as const },
    margin: { t: 40, b: 80, l: 50, r: 20 },
    paper_bgcolor: 'transparent' as const,
    plot_bgcolor: 'transparent' as const,
    font: { color: '#eee' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [trace] as any, layout, { responsive: true }).then(() => onReady?.());
}

/**
 * Render 2D line chart: Max Price (ct/kWh) vs Target Hour at fixed target SOC.
 * Always shows ct/kWh; Price (€) checkbox has no effect.
 */
export function render2DFixedSocMaxChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const maxMatrix = data.maxMatrix;
  if (!maxMatrix || maxMatrix.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  const { targetSocs, targetHours, highlightSoc, currentSoc, evCapacity, useGrossPrices = false, extraCt = EXTRA_CT_DEFAULT } = data;

  if (highlightSoc == null || targetSocs.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  let s = targetSocs.findIndex((soc) => soc === highlightSoc);
  if (s < 0) {
    const closest = targetSocs.reduce((a, b) =>
      Math.abs(a - highlightSoc) <= Math.abs(b - highlightSoc) ? a : b
    );
    s = targetSocs.indexOf(closest);
  }
  if (s < 0) {
    Plotly.purge(containerId);
    return;
  }

  const yLabels = targetHours.map((ts) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'numeric' })} ${d.getHours()}:00`;
  });
  const x = yLabels;
  const y = targetHours.map((_, h) => {
    const v = zValue(maxMatrix, h, s, currentSoc, targetSocs, evCapacity, 0, false, useGrossPrices, extraCt);
    return Number.isNaN(v) ? null : v;
  });

  const trace = {
    x,
    y,
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    line: { color: '#e63946' as const, width: 2 },
    marker: { size: 6 },
    connectgaps: false,
  };

  const layout = {
    title: { text: t('chartMaxPriceByHour', { soc: highlightSoc }) },
    xaxis: { title: { text: t('chartTargetHour') }, gridcolor: '#333', tickangle: -45 },
    yaxis: { title: { text: t('chartMaxPrice') }, gridcolor: '#333', rangemode: 'tozero' as const },
    margin: { t: 40, b: 80, l: 50, r: 20 },
    paper_bgcolor: 'transparent' as const,
    plot_bgcolor: 'transparent' as const,
    font: { color: '#eee' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [trace] as any, layout, { responsive: true }).then(() => onReady?.());
}

/**
 * Build chart data for the max-price 3D surface (uses maxMatrix instead of matrix).
 */
function buildMaxChartData(data: ChartData) {
  const maxMatrix = data.maxMatrix;
  if (!maxMatrix || maxMatrix.length === 0) return null;
  return buildChartData({ ...data, matrix: maxMatrix, zMode: 'ct-per-kwh' }, { valueLabel: 'Max' });
}

/**
 * Render 3D surface chart: Max price (ct/kWh or €) per cell.
 * Shows the highest price among the N cheapest hours used for each target.
 */
export function render3DMaxChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const built = buildMaxChartData(data);
  if (!built) {
    Plotly.purge(containerId);
    return;
  }

  const { x, y, z, text, isPrice } = built;
  const zAxisTitle = isPrice ? t('chartMaxPriceEur') : t('chartMaxPrice');
  const chartTitle = isPrice ? t('chartMaxPriceEurBy') : t('chartMaxPriceBy');

  const surfaceTrace = {
    x,
    y,
    z,
    type: 'surface' as const,
    colorscale: 'Reds' as const,
    colorbar: { len: 0.9, y: 1, yanchor: 'top' as const },
    hoverinfo: 'text' as const,
    text,
    contours: isPrice
      ? { x: { show: false, highlight: false }, y: { show: false, highlight: false }, z: { show: false, highlight: true, highlightcolor: '#22c55e' } }
      : { x: { show: false, highlight: true }, y: { show: false, highlight: true }, z: { show: false, highlight: false } },
  };

  const maxChartDataForTraces: ChartData = { ...data, matrix: data.maxMatrix!, zMode: 'ct-per-kwh' };
  const socLineTraces = buildSocLineTraces(maxChartDataForTraces);
  const timeLineTraces = buildTargetTimeLineTraces(maxChartDataForTraces);

  const sceneCamera = {
    eye: { x: 1.5, y: 1.5, z: 1.2 },
    center: { x: 0, y: 0, z: -0.3 },
    up: { x: 0, y: 0, z: 1 },
  };

  const layout = {
    title: { text: chartTitle },
    scene: {
      xaxis: { title: { text: t('chartTargetSoc') }, autorange: 'reversed' as const, showspikes: false },
      yaxis: { title: { text: t('chartTargetHour') }, showspikes: false },
      zaxis: { title: { text: zAxisTitle }, showspikes: false },
      camera: sceneCamera,
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const config = { responsive: true };

  const allTraces = [surfaceTrace, ...socLineTraces, ...timeLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, allTraces as any, layout, config).then(() => {
    Plotly.relayout(containerId, { 'scene.camera': sceneCamera } as Partial<Plotly.Layout>);
    onReady?.();
  });
}
