import { VOIVODESHIP_BY_CODE } from './poland-voivodeships';
import { POLISH_CITY_DISPLAY_BY_ASCII_KEY } from './polish-city-display-names';

const PL_CHAR_TO_ASCII: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'a',
  Ć: 'c',
  Ę: 'e',
  Ł: 'l',
  Ń: 'n',
  Ó: 'o',
  Ś: 's',
  Ź: 'z',
  Ż: 'z',
};

function foldPolishCharsToAscii(s: string): string {
  let out = '';
  for (const ch of s) {
    out += PL_CHAR_TO_ASCII[ch] ?? ch;
  }
  return out;
}

/** Lowercase ASCII key for city display-name lookups (Google geo names). */
export function normalizeCityLookupKey(input: string): string {
  return foldPolishCharsToAscii(input).trim().toLowerCase().replace(/\s+/g, ' ');
}

const CITY_NAME_PL: Record<string, string> = {
  warsaw: 'Warszawa',
  wroclaw: 'Wrocław',
  krakow: 'Kraków',
  lodz: 'Łódź',
  czestochowa: 'Częstochowa',
  bialystok: 'Białystok',
  'busko-zdroj': 'Busko-Zdrój',
  'jastrzebie-zdroj': 'Jastrzębie-Zdrój',
  hajnowka: 'Hajnówka',
  'ostrowiec swietokrzyski': 'Ostrowiec Świętokrzyski',
  plock: 'Płock',
  przemysl: 'Przemyśl',
  rzeszow: 'Rzeszów',
  chorzow: 'Chorzów',
  'jelenia gora': 'Jelenia Góra',
  staszow: 'Staszów',
  wloszczowa: 'Włoszczowa',
  zory: 'Żory',
  'nowy sacz': 'Nowy Sącz',
  andrychow: 'Andrychów',
  rogozno: 'Rogoźno',
};

const REGION_NAME_PL: Record<string, string> = {
  warsaw: 'Mazowieckie',
  dolnoslaskie: 'Dolnośląskie',
  'dolnoslaskie voivodeship': 'Dolnośląskie',
  kujawsko: 'Kujawsko-Pomorskie',
  'kujawsko pomorskie': 'Kujawsko-Pomorskie',
  'kujawsko-pomorskie': 'Kujawsko-Pomorskie',
  lubelskie: 'Lubelskie',
  lubuskie: 'Lubuskie',
  lodzkie: 'Łódzkie',
  malopolskie: 'Małopolskie',
  mazowieckie: 'Mazowieckie',
  opolskie: 'Opolskie',
  podkarpackie: 'Podkarpackie',
  podlaskie: 'Podlaskie',
  pomorskie: 'Pomorskie',
  slaskie: 'Śląskie',
  swietokrzyskie: 'Świętokrzyskie',
  'warminsko mazurskie': 'Warmińsko-Mazurskie',
  'warminsko-mazurskie': 'Warmińsko-Mazurskie',
  wielkopolskie: 'Wielkopolskie',
  zachodniopomorskie: 'Zachodniopomorskie',
  'masovian voivodeship': 'Mazowieckie',
  'lower silesian voivodeship': 'Dolnośląskie',
  'lesser poland voivodeship': 'Małopolskie',
  'lodz voivodeship': 'Łódzkie',
  'silesian voivodeship': 'Śląskie',
  'podlaskie voivodeship': 'Podlaskie',
  'swietokrzyskie voivodeship': 'Świętokrzyskie',
  'subcarpathian voivodeship': 'Podkarpackie',
  'podkarpackie voivodeship': 'Podkarpackie',
  'lublin voivodeship': 'Lubelskie',
  'greater poland voivodeship': 'Wielkopolskie',
  'west pomeranian voivodeship': 'Zachodniopomorskie',
  'pomeranian voivodeship': 'Pomorskie',
  'warmian-masurian voivodeship': 'Warmińsko-Mazurskie',
  'kuyavian-pomeranian voivodeship': 'Kujawsko-Pomorskie',
  'lubusz voivodeship': 'Lubuskie',
  'opole voivodeship': 'Opolskie',
};

const REGION_NAME_TO_CODE: Record<string, string> = {
  warsaw: 'PL-MZ',
  dolnoslaskie: 'PL-DS',
  'dolnoslaskie voivodeship': 'PL-DS',
  kujawsko: 'PL-KP',
  'kujawsko pomorskie': 'PL-KP',
  'kujawsko-pomorskie': 'PL-KP',
  lubelskie: 'PL-LU',
  lubuskie: 'PL-LB',
  lodzkie: 'PL-LD',
  malopolskie: 'PL-MA',
  mazowieckie: 'PL-MZ',
  opolskie: 'PL-OP',
  podkarpackie: 'PL-PK',
  podlaskie: 'PL-PD',
  pomorskie: 'PL-PM',
  slaskie: 'PL-SL',
  swietokrzyskie: 'PL-SK',
  'warminsko mazurskie': 'PL-WN',
  'warminsko-mazurskie': 'PL-WN',
  wielkopolskie: 'PL-WP',
  zachodniopomorskie: 'PL-ZP',
  'masovian voivodeship': 'PL-MZ',
  'lower silesian voivodeship': 'PL-DS',
  'lesser poland voivodeship': 'PL-MA',
  'lodz voivodeship': 'PL-LD',
  'silesian voivodeship': 'PL-SL',
  'podlaskie voivodeship': 'PL-PD',
  'swietokrzyskie voivodeship': 'PL-SK',
  'subcarpathian voivodeship': 'PL-PK',
  'podkarpackie voivodeship': 'PL-PK',
  'lublin voivodeship': 'PL-LU',
  'greater poland voivodeship': 'PL-WP',
  'west pomeranian voivodeship': 'PL-ZP',
  'pomeranian voivodeship': 'PL-PM',
  'warmian-masurian voivodeship': 'PL-WN',
  'kuyavian-pomeranian voivodeship': 'PL-KP',
  'lubusz voivodeship': 'PL-LB',
  'opole voivodeship': 'PL-OP',
};

const CITY_TO_REGION_CODE: Record<string, string> = {
  warsaw: 'PL-MZ',
  wroclaw: 'PL-DS',
  krakow: 'PL-MA',
  lodz: 'PL-LD',
  katowice: 'PL-SL',
  gliwice: 'PL-SL',
  czestochowa: 'PL-SL',
  bialystok: 'PL-PD',
  'busko-zdroj': 'PL-SK',
  hajnowka: 'PL-PD',
  'jastrzebie-zdroj': 'PL-SL',
  kielce: 'PL-SK',
  'ostrowiec swietokrzyski': 'PL-SK',
  plock: 'PL-MZ',
  przemysl: 'PL-PK',
  rzeszow: 'PL-PK',
  siedlce: 'PL-MZ',
  staszow: 'PL-SK',
  trzebinia: 'PL-MA',
  chorzow: 'PL-SL',
  'jelenia gora': 'PL-DS',
  wloszczowa: 'PL-SK',
  zory: 'PL-SL',
  'nowy sacz': 'PL-MA',
  andrychow: 'PL-MA',
  rogozno: 'PL-WP',
};

function key(value?: string | null): string {
  return normalizeCityLookupKey(value || '').replace(/\s+/g, ' ');
}

export function formatPolishCityName(cityName?: string | null): string {
  const raw = cityName?.trim();
  if (!raw || raw === '(nieznane)') return raw || '—';
  const k = normalizeCityLookupKey(raw);
  return CITY_NAME_PL[k] || POLISH_CITY_DISPLAY_BY_ASCII_KEY[k] || raw;
}

export function formatPolishVoivodeshipName(row: {
  regionCode?: string | null;
  regionName?: string | null;
  cityName?: string | null;
}): string {
  if (row.regionCode && VOIVODESHIP_BY_CODE[row.regionCode]) {
    return VOIVODESHIP_BY_CODE[row.regionCode].name;
  }

  const byRegionName = REGION_NAME_PL[key(row.regionName)];
  if (byRegionName) return byRegionName;

  const byCityName = CITY_TO_REGION_CODE[key(row.cityName)];
  if (byCityName && VOIVODESHIP_BY_CODE[byCityName]) return VOIVODESHIP_BY_CODE[byCityName].name;

  return row.regionName?.trim() || '—';
}

export function resolvePolishVoivodeshipCode(row: {
  regionCode?: string | null;
  regionName?: string | null;
  cityName?: string | null;
}): string | null {
  if (row.regionCode && VOIVODESHIP_BY_CODE[row.regionCode]) {
    return row.regionCode;
  }

  const byRegionName = REGION_NAME_TO_CODE[key(row.regionName)];
  if (byRegionName && VOIVODESHIP_BY_CODE[byRegionName]) return byRegionName;

  const byCityName = CITY_TO_REGION_CODE[key(row.cityName)];
  if (byCityName && VOIVODESHIP_BY_CODE[byCityName]) return byCityName;

  return null;
}

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
};

/** When API sends English `countryName` without a resolvable ISO code. */
const ENGLISH_COUNTRY_NAME_PL: Record<string, string> = {
  germany: 'Niemcy',
  france: 'Francja',
  'united kingdom': 'Wielka Brytania',
  'united states': 'Stany Zjednoczone',
  netherlands: 'Holandia',
  spain: 'Hiszpania',
  italy: 'Włochy',
  'czech republic': 'Czechy',
  czechia: 'Czechy',
  austria: 'Austria',
  sweden: 'Szwecja',
  norway: 'Norwegia',
  denmark: 'Dania',
  belgium: 'Belgia',
  ireland: 'Irlandia',
  portugal: 'Portugalia',
  hungary: 'Węgry',
  slovakia: 'Słowacja',
  lithuania: 'Litwa',
  latvia: 'Łotwa',
  estonia: 'Estonia',
  ukraine: 'Ukraina',
  romania: 'Rumunia',
  bulgaria: 'Bułgaria',
  greece: 'Grecja',
  turkey: 'Turcja',
  switzerland: 'Szwajcaria',
  croatia: 'Chorwacja',
  finland: 'Finlandia',
  luxembourg: 'Luksemburg',
  slovenia: 'Słowenia',
  cyprus: 'Cypr',
  malta: 'Malta',
  israel: 'Izrael',
  canada: 'Kanada',
  australia: 'Australia',
  japan: 'Japonia',
  china: 'Chiny',
  india: 'Indie',
  brazil: 'Brazylia',
  mexico: 'Meksyk',
  russia: 'Rosja',
  poland: 'Polska',
};

/**
 * Polish UI label for a country row (ISO 3166-1 alpha-2 when available).
 */
export function formatPolishCountryName(row: {
  countryCode?: string | null;
  countryName?: string | null;
}): string {
  const raw = row.countryCode?.trim().toUpperCase();
  if (raw === 'PL') return 'Polska';

  if (!raw) {
    const fromEn = ENGLISH_COUNTRY_NAME_PL[key(row.countryName)];
    if (fromEn) return fromEn;
    return row.countryName?.trim() || 'Polska';
  }

  const code = (COUNTRY_CODE_ALIASES[raw] || raw).slice(0, 2);
  if (code.length === 2) {
    try {
      const label = new Intl.DisplayNames(['pl'], { type: 'region' }).of(code);
      if (label) return label;
    } catch {
      /* ignore */
    }
  }
  const fromEn = ENGLISH_COUNTRY_NAME_PL[key(row.countryName)];
  if (fromEn) return fromEn;
  return row.countryName?.trim() || raw;
}
