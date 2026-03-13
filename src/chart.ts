/**
 * 3D chart for average price by target hour and target SOC.
 */

import Plotly from 'plotly.js-dist-min';

export interface ChartData {
  targetHours: number[];
  targetSocs: number[];
  matrix: number[][];
}

const CT_PER_MWH = 10; // 1 Eur/MWh = 10 ct/kWh (approximately, for display)

/**
 * Render a 3D surface chart.
 * X: target hour (displayed as 8, 9, 10, ...)
 * Y: target SOC (%)
 * Z: average price (ct/kWh)
 */
export function render3DChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { targetHours, targetSocs, matrix } = data;

  // Convert timestamps to hour labels (0-23) for display
  const xLabels = targetHours.map((ts) => {
    const d = new Date(ts);
    return d.getHours();
  });

  const x = xLabels.map((h) => `${h}:00`);
  const y = targetSocs.map((s) => `${s}%`);
  // Plotly surface: z[y_index][x_index], our matrix is [hour_index][soc_index]
  const z = targetSocs.map((_, s) =>
    targetHours.map((_, h) => {
      const v = matrix[h][s];
      return Number.isNaN(v) ? null : v / CT_PER_MWH;
    })
  );
  const text = targetSocs.map((_, s) =>
    targetHours.map((_, h) => {
      const v = matrix[h][s];
      return Number.isNaN(v)
        ? `Target: ${x[h]} / ${y[s]} — Not enough hours`
        : `Target: ${x[h]} / ${y[s]} — Avg: ${(v / CT_PER_MWH).toFixed(2)} ct/kWh (${v.toFixed(2)} Eur/MWh)`;
    })
  );

  const trace = {
    x,
    y,
    z,
    type: 'surface' as const,
    colorscale: 'Viridis',
    hoverinfo: 'text' as const,
    text,
  };

  const layout = {
    title: { text: 'Average Price (ct/kWh) by Target Hour and Target SOC' },
    scene: {
      xaxis: { title: { text: 'Target Hour' } },
      yaxis: { title: { text: 'Target SOC (%)' } },
      zaxis: { title: { text: 'Avg Price (ct/kWh)' } },
    },
    margin: { l: 0, r: 0, b: 0, t: 40 },
  };

  const config = { responsive: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [trace] as any, layout, config).then(() => onReady?.());
}

/**
 * Update an existing chart with new data.
 */
export function update3DChart(
  containerId: string,
  data: ChartData,
  onReady?: () => void
): void {
  const { targetHours, targetSocs, matrix } = data;
  const xLabels = targetHours.map((ts) => {
    const d = new Date(ts);
    return d.getHours();
  });
  const x = xLabels.map((h) => `${h}:00`);
  const y = targetSocs.map((s) => `${s}%`);
  const z = targetSocs.map((_, s) =>
    targetHours.map((_, h) => {
      const v = matrix[h][s];
      return Number.isNaN(v) ? null : v / CT_PER_MWH;
    })
  );
  const text = targetSocs.map((_, s) =>
    targetHours.map((_, h) => {
      const v = matrix[h][s];
      return Number.isNaN(v)
        ? `Target: ${x[h]} / ${y[s]} — Not enough hours`
        : `Target: ${x[h]} / ${y[s]} — Avg: ${(v / CT_PER_MWH).toFixed(2)} ct/kWh (${v.toFixed(2)} Eur/MWh)`;
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.update(containerId, { x, y, z, text } as any, {}).then(() => onReady?.());
}
