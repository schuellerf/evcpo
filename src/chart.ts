/**
 * 3D chart for average price by target hour and target SOC.
 */

import Plotly from 'plotly.js-dist-min';

export interface ChartData {
  targetHours: number[];
  targetSocs: number[];
  matrix: number[][];
  /** If set, only this SOC value gets a red highlight line (user's chosen target SOC). */
  highlightSoc?: number;
}

const CT_PER_MWH = 10; // 1 Eur/MWh = 10 ct/kWh (approximately, for display)

function buildChartData(data: ChartData) {
  const { targetHours, targetSocs, matrix } = data;

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
  // Plotly surface: z[y_index][x_index], so z[hour_idx][soc_idx] = matrix[h][s]
  const z = targetHours.map((_, h) =>
    targetSocs.map((_, s) => {
      const v = matrix[h][s];
      return Number.isNaN(v) ? null : v / CT_PER_MWH;
    })
  );
  const text = targetHours.map((_, h) =>
    targetSocs.map((_, s) => {
      const v = matrix[h][s];
      return Number.isNaN(v)
        ? `Target: ${y[h]} / ${x[s]} — Not enough hours`
        : `Target: ${y[h]} / ${x[s]} — Avg: ${(v / CT_PER_MWH).toFixed(2)} ct/kWh (${v.toFixed(2)} Eur/MWh)`;
    })
  );
  return { x, y, z, text };
}

/**
 * Build red Scatter3d line trace only for the user's selected target SOC (highlightSoc).
 */
function buildSocLineTraces(data: ChartData): Record<string, unknown>[] {
  const { x, y } = buildChartData(data);
  const { targetSocs, targetHours, matrix, highlightSoc } = data;
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

  // Red line: constant SOC (x), varies over hours (y). After swap: x=SOC, y=hour.
  const lineX: string[] = [];
  const lineY: string[] = [];
  const lineZ: (number | null)[] = [];

  for (let h = 0; h < targetHours.length; h++) {
    const v = matrix[h][s];
    if (!Number.isNaN(v)) {
      lineX.push(x[s]);
      lineY.push(y[h]);
      lineZ.push(v / CT_PER_MWH);
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
  const { x, y, z, text } = buildChartData(data);

  const surfaceTrace = {
    x,
    y,
    z,
    type: 'surface' as const,
    colorscale: 'Viridis',
    hoverinfo: 'text' as const,
    text,
  };

  const socLineTraces = buildSocLineTraces(data);

  const layout = {
    title: { text: 'Average Price (ct/kWh) by Target SOC and Target Hour' },
    scene: {
      xaxis: { title: { text: 'Target SOC (%)' }, autorange: 'reversed' as const },
      yaxis: { title: { text: 'Target Hour' } },
      zaxis: { title: { text: 'Avg Price (ct/kWh)' } },
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const config = { responsive: true };

  const allTraces = [surfaceTrace, ...socLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, allTraces as any, layout, config).then(() =>
    onReady?.()
  );
}

/**
 * Update an existing chart with new data.
 */
export function update3DChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { x, y, z, text } = buildChartData(data);
  const socLineTraces = buildSocLineTraces(data);

  const surfaceTrace = {
    x,
    y,
    z,
    text,
    type: 'surface' as const,
    colorscale: 'Viridis',
    hoverinfo: 'text' as const,
  };

  const layout = {
    title: { text: 'Average Price (ct/kWh) by Target SOC and Target Hour' },
    scene: {
      xaxis: { title: { text: 'Target SOC (%)' }, autorange: 'reversed' as const },
      yaxis: { title: { text: 'Target Hour' } },
      zaxis: { title: { text: 'Avg Price (ct/kWh)' } },
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const allTraces = [surfaceTrace, ...socLineTraces];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.react(containerId, allTraces as any, layout).then(() => onReady?.());
}
