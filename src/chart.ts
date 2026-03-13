/**
 * 3D chart for average price by target hour and target SOC.
 */

import Plotly from 'plotly.js-dist-min';
import { getHoursNeeded } from './calculator';

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
}

const CT_PER_MWH = 10; // 1 Eur/MWh = 10 ct/kWh (approximately, for display)

function buildChartData(data: ChartData) {
  const { targetHours, targetSocs, matrix, currentSoc, evCapacity, zMode, powerKw = 0 } = data;

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
      const ctPerKwh = v / CT_PER_MWH;
      if (!isPrice) return ctPerKwh;
      const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
      return (ctPerKwh * powerKw * hours) / 100;
    })
  );
  const text = targetHours.map((_, h) =>
    targetSocs.map((_, s) => {
      const v = matrix[h][s];
      if (Number.isNaN(v)) return `Target: ${y[h]} / ${x[s]} — Not enough hours`;
      const ctPerKwh = v / CT_PER_MWH;
      if (!isPrice) return `Target: ${y[h]} / ${x[s]} — Avg: ${ctPerKwh.toFixed(2)} ct/kWh (${v.toFixed(2)} Eur/MWh)`;
      const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
      const priceEur = (ctPerKwh * powerKw * hours) / 100;
      return `Target: ${y[h]} / ${x[s]} — Price: €${priceEur.toFixed(2)} (${ctPerKwh.toFixed(2)} ct/kWh × ${powerKw.toFixed(2)} kW × ${hours}h)`;
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
  isPrice: boolean
): number {
  const v = matrix[h]?.[s];
  if (v == null || Number.isNaN(v)) return NaN;
  const ctPerKwh = v / CT_PER_MWH;
  if (!isPrice) return ctPerKwh;
  const hours = getHoursNeeded(currentSoc, targetSocs[s], evCapacity, powerKw);
  return (ctPerKwh * powerKw * hours) / 100;
}

/**
 * Build red Scatter3d line trace only for the user's selected target SOC (highlightSoc).
 */
function buildSocLineTraces(data: ChartData): Record<string, unknown>[] {
  const { x, y, isPrice } = buildChartData(data);
  const { targetSocs, targetHours, matrix, highlightSoc, currentSoc, evCapacity, powerKw = 0 } = data;
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
    const z = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice);
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
  const { targetSocs, targetHours, matrix, highlightHour, currentSoc, evCapacity, powerKw = 0 } = data;
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
    const z = zValue(matrix, h, s, currentSoc, targetSocs, evCapacity, powerKw, isPrice);
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
  const zAxisTitle = isPrice ? 'Price (€)' : 'Avg Price (ct/kWh)';
  const chartTitle = isPrice ? 'Price (€) by Target SOC and Target Hour' : 'Average Price (ct/kWh) by Target SOC and Target Hour';

  const surfaceTrace = {
    x,
    y,
    z,
    type: 'surface' as const,
    colorscale: 'Viridis',
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
      xaxis: { title: { text: 'Target SOC (%)' }, autorange: 'reversed' as const, showspikes: false },
      yaxis: { title: { text: 'Target Hour' }, showspikes: false },
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
      xaxis: { title: { text: 'Target SOC (%)' }, autorange: 'reversed' as const, showspikes: false },
      yaxis: { title: { text: 'Target Hour' }, showspikes: false },
      zaxis: { title: { text: zAxisTitle }, showspikes: false },
      camera: sceneCamera,
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const allTraces = [surfaceTrace, ...socLineTraces, ...timeLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.react(containerId, allTraces as any, layout).then(() => onReady?.());
}
