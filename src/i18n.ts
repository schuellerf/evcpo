/**
 * Lightweight i18n for EVCPO. German default, English.
 */

export type Locale = 'de' | 'en';
const STORAGE_KEY = 'evcpo-locale';
const REGION_KEY = 'evcpo-region';

const messages: Record<Locale, Record<string, string>> = {
  de: {
    appTitle: 'EV Lade-Preis-Optimierer',
    subtitle: 'Ladezeiten optimieren basierend auf awattar Strompreisen',
    targetDate: 'Zieldatum',
    targetTime: 'Zielzeit',
    result: 'Ergebnis',
    targetSoc: 'Ziel-SOC (%)',
    maxPrice: 'Maximalpreis',
    avgTotalPrice: 'Durchschnitt/Gesamtpreis',
    totalPriceEur: 'Gesamtpreis (€)',
    settings: 'Einstellungen',
    grossPricesTooltip: 'Netto: Nur EPEX Spot Energiekosten. Brutto: EPEX + 1,5 ct/kWh + MwSt. + zusätzliche Kosten (Netznutzung, Umlagen, etc.).',
    totalGrossPrices: 'Bruttopreise gesamt',
    power: 'Leistung',
    currentSoc: 'Aktueller SOC (%)',
    evCapacity: 'EV-Kapazität (kWh)',
    usage: 'Verbrauch (kWh/100km)',
    amps: 'Ampere',
    phase3: '3 Phasen',
    voltage: 'Spannung',
    region: 'Region',
    austria: 'Österreich',
    germany: 'Deutschland',
    extraCtLabel: 'Zusatzkosten',
    extraCtFootnote: 'Netznutzung, Umlagen und weitere vertragsspezifische Kosten. Ein genauer Wert ist bei monatlichen Pauschalen usw. kaum ermittelbar — Nutzer müssen schätzen.',
    procurement: 'Beschaffung',
    footnoteNet: 'Nettopreise: Nur EPEX Spot Energiekosten. Ohne Beschaffung (1,5 ct/kWh), MwSt., Netzentgelte und Umlagen.',
    loading: 'Lade…',
    targetTimeError: 'Die Zielzeit muss nach der nächsten vollen Stunde liegen.',
    notEnoughSlots: 'Nicht genügend Preisslots. Benötigt {need} Stunden, vorhanden {got}.',
    errorPrefix: 'Fehler: ',
    chargeForHours: 'Laden für {hours} Stunde(n).',
    chargeForHour: 'Laden für 1 Stunde.',
    averagePrice: 'Durchschnittspreis',
    totalPrice: 'Gesamtpreis',
    pricePer100km: 'Preis / 100km',
    noTargetHours: 'Keine Zielstunden verfügbar.',
    chartPriceEur: 'Preis (€)',
    chartAvgPrice: 'Durchschnittspreis (ct/kWh)',
    chartTargetSoc: 'Ziel-SOC (%)',
    chartTargetHour: 'Zielstunde',
    chartAvgPriceBy: 'Durchschnittspreis (ct/kWh) nach Ziel-SOC und Zielstunde',
    chartPriceBy: 'Preis (€) nach Ziel-SOC und Zielstunde',
    chartMaxPrice: 'Maximalpreis (ct/kWh)',
    chartMaxPriceEur: 'Maximalpreis (€)',
    chartMaxPriceBy: 'Maximalpreis (ct/kWh) nach Ziel-SOC und Zielstunde',
    chartMaxPriceEurBy: 'Maximalpreis (€) nach Ziel-SOC und Zielstunde',
    chartNotEnoughHours: 'Nicht genügend Stunden',
    chartNoCharging: 'Kein Laden nötig',
    chartTarget: 'Ziel: ',
    chartAvg: 'Durchschn.',
    chartMax: 'Max',
    chartPriceAt: 'Preis um {hour} nach Ziel-SOC',
    chartMaxPriceAt: 'Maximalpreis um {hour} nach Ziel-SOC',
    chartPriceByHour: 'Preis nach Zielstunde (Ziel-SOC: {soc}%)',
    chartMaxPriceByHour: 'Maximalpreis nach Zielstunde (Ziel-SOC: {soc}%)',
    maxPriceTabDescription: 'Setze diesen Maximalpreis als Limit in deiner Ladebox. Das Laden startet, wenn die Preise bei oder unter diesem Wert liegen – so erreichst du das berechnete Ergebnis (oder ein ähnlich gutes).',
    barChartPrev: 'Vorheriger Tag',
    barChartNext: 'Nächster Tag',
  },
  en: {
    appTitle: 'EV Charge Price Optimizer',
    subtitle: 'Optimize charging based on awattar electricity prices',
    targetDate: 'Target date',
    targetTime: 'Target time',
    result: 'Result',
    targetSoc: 'Target SOC (%)',
    maxPrice: 'Max Price',
    avgTotalPrice: 'Average/Total price',
    totalPriceEur: 'Total Price (€)',
    settings: 'Settings',
    grossPricesTooltip: 'Net: EPEX Spot energy costs only. Gross: EPEX + 1.5 ct/kWh + VAT + extra costs (Netznutzung, Umlagen, etc.).',
    totalGrossPrices: 'Total gross prices',
    power: 'Power',
    currentSoc: 'Current SOC (%)',
    evCapacity: 'EV Capacity (kWh)',
    usage: 'Usage (kWh/100km)',
    amps: 'Amps',
    phase3: '3 phase',
    voltage: 'Voltage',
    region: 'Region',
    austria: 'Austria',
    germany: 'Germany',
    extraCtLabel: 'Extra costs',
    extraCtFootnote: 'Grid fees, levies and other contract-specific costs. This is nearly impossible to determine accurately for a given contract with monthly flat fees etc. — users have to guesstimate.',
    procurement: 'procurement',
    footnoteNet: 'Net prices: EPEX Spot energy costs only. Excludes procurement (1.5 ct/kWh), VAT, grid fees, and levies.',
    loading: 'Loading…',
    targetTimeError: 'Target time must be after the next full hour.',
    notEnoughSlots: 'Not enough price slots. Need {need} hours, got {got}.',
    errorPrefix: 'Error: ',
    chargeForHours: 'Charge for {hours} hours.',
    chargeForHour: 'Charge for 1 hour.',
    averagePrice: 'Average price',
    totalPrice: 'Total price',
    pricePer100km: 'Price / 100km',
    noTargetHours: 'No target hours available.',
    chartPriceEur: 'Price (€)',
    chartAvgPrice: 'Avg Price (ct/kWh)',
    chartTargetSoc: 'Target SOC (%)',
    chartTargetHour: 'Target Hour',
    chartAvgPriceBy: 'Average Price (ct/kWh) by Target SOC and Target Hour',
    chartPriceBy: 'Price (€) by Target SOC and Target Hour',
    chartMaxPrice: 'Max Price (ct/kWh)',
    chartMaxPriceEur: 'Max Price (€)',
    chartMaxPriceBy: 'Max Price (ct/kWh) by Target SOC and Target Hour',
    chartMaxPriceEurBy: 'Max Price (€) by Target SOC and Target Hour',
    chartNotEnoughHours: 'Not enough hours',
    chartNoCharging: 'No charging needed',
    chartTarget: 'Target: ',
    chartAvg: 'Avg',
    chartMax: 'Max',
    chartPriceAt: 'Price at {hour} by Target SOC',
    chartMaxPriceAt: 'Max Price at {hour} by Target SOC',
    chartPriceByHour: 'Price by Target Hour (Target SOC: {soc}%)',
    chartMaxPriceByHour: 'Max Price by Target Hour (Target SOC: {soc}%)',
    maxPriceTabDescription: 'Set this max price as the limit in your charging station. Charging will start when prices are at or below this value, so you achieve the calculated result (or similarly good).',
    barChartPrev: 'Previous day',
    barChartNext: 'Next day',
  },
};

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'de';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'de' || stored === 'en') return stored;
  return 'de';
}

let currentLocale: Locale = getStoredLocale();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === 'de' ? 'de' : 'en';
    window.dispatchEvent(new CustomEvent('localechange'));
  }
}

/**
 * Translate a key. Supports simple {placeholder} interpolation.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const msg = messages[currentLocale][key] ?? messages.en[key] ?? key;
  if (!params) return msg;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    msg
  );
}

export function getStoredRegion(): 'at' | 'de' {
  if (typeof window === 'undefined') return 'at';
  const stored = localStorage.getItem(REGION_KEY);
  if (stored === 'at' || stored === 'de') return stored;
  return 'at';
}

export function setRegion(region: 'at' | 'de'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REGION_KEY, region);
  }
}
