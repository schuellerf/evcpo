/**
 * awattar-style 2D bar chart for hourly net prices.
 * Always shows net prices; ignores gross toggle.
 * Horizontal bars, white background, full 24h day.
 */

import Plotly from 'plotly.js-dist-min';
import type { PriceSlot } from './api';
import { t } from './i18n';

const CT_PER_MWH = 10;
const BAR_BLUE = '#2563eb';
const BAR_GREEN = '#22c55e';
const LINE_RED = '#e63946';
const GREEN_THRESHOLD = 9;

/**
 * Render hourly price bar chart (horizontal bars, white background).
 * @param containerId - DOM element ID
 * @param priceSlots - Hourly price slots (expect 24 for full day)
 * @param maxPriceCtPerKwh - Max price (ct/kWh net) for red line and outlines, or null to omit
 * @param dayLabel - Label for the displayed day (e.g. "Fri, 14 Mar 2025")
 */
export function renderPriceBarChart(
  containerId: string,
  priceSlots: PriceSlot[],
  maxPriceCtPerKwh: number | null,
  dayLabel?: string
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dayLabelEl = document.getElementById('bar-chart-day-label');
  if (dayLabelEl) dayLabelEl.textContent = dayLabel ?? '';

  if (priceSlots.length === 0) {
    Plotly.purge(containerId);
    return;
  }

  // Vertical bars: x = hour, y = price
  const x = priceSlots.map((s) => {
    const d = new Date(s.start_timestamp);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  });
  const y = priceSlots.map((s) => s.marketprice / CT_PER_MWH);

  const markerColors = y.map((ct) => (ct <= GREEN_THRESHOLD ? BAR_GREEN : BAR_BLUE));
  const markerLineColors = y.map((ct) =>
    maxPriceCtPerKwh != null && ct <= maxPriceCtPerKwh ? LINE_RED : 'rgba(0,0,0,0)'
  );
  const markerLineWidths = y.map((ct) =>
    maxPriceCtPerKwh != null && ct <= maxPriceCtPerKwh ? 2 : 0
  );

  const barTrace = {
    x,
    y,
    type: 'bar' as const,
    marker: {
      color: markerColors,
      line: {
        color: markerLineColors,
        width: markerLineWidths,
      },
    },
    hoverinfo: 'text' as const,
    text: y.map((ct, i) => `${x[i]}: ${ct.toFixed(2)} ct/kWh`),
  };

  const shapes: Plotly.Layout['shapes'] = [];
  if (maxPriceCtPerKwh != null && Number.isFinite(maxPriceCtPerKwh)) {
    shapes.push({
      type: 'line',
      x0: 0,
      x1: 1,
      xref: 'paper',
      y0: maxPriceCtPerKwh,
      y1: maxPriceCtPerKwh,
      yref: 'y',
      line: { color: LINE_RED, dash: 'dash', width: 2 },
    });
  }

  const layout: Partial<Plotly.Layout> = {
    xaxis: {
      title: { text: t('chartTargetHour') },
      gridcolor: '#ddd',
      tickangle: -45,
    },
    yaxis: {
      title: { text: t('chartAvgPrice') },
      gridcolor: '#ddd',
      zeroline: true,
      zerolinecolor: '#999',
      rangemode: 'tozero' as const,
    },
    margin: { t: 20, b: 50, l: 80, r: 50 },
    paper_bgcolor: '#ffffff' as const,
    plot_bgcolor: '#ffffff' as const,
    font: { color: '#333', size: 12 },
    shapes,
    showlegend: false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Plotly.newPlot(containerId, [barTrace] as any, layout, { responsive: true });
}
