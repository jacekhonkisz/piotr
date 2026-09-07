/**
 * Renders the PDF "Podsumowanie kanałów" channel card at the real page
 * geometry (108mm page, 7mm padding, 2-column grid) and reports how many line
 * boxes each label and value occupies. Two line boxes on a single word is the
 * defect the client reported ("REZERWACJ" + "E").
 *
 * Usage: node scripts/verify-pdf-channel-card-layout.js
 */
const puppeteer = require('puppeteer');

// Verbatim from src/app/api/generate-pdf/route.ts (the rules under audit).
const CURRENT_RULES = `
  dt { min-width: 0; color: var(--muted); font-size: 6.1pt; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.06em; overflow-wrap: anywhere; }
  dd { max-width: 54%; margin: 0; font-size: 7.1pt; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: normal; overflow-wrap: anywhere; }
  .channel-card dd { display: inline-flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 0.7mm; }
  .channel-card dd span { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .channel-card .metric-delta { font-size: 4.5pt; padding: 0.25mm 0.55mm; }
`;

const PATCHED_RULES = `
  dt { min-width: 0; color: var(--muted); font-size: 6.1pt; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.06em; overflow-wrap: break-word; word-break: normal; }
  dd { max-width: 54%; margin: 0; font-size: 7.1pt; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: normal; overflow-wrap: break-word; word-break: normal; }
  .channel-card dt { min-width: min-content; }
  .channel-card dd { display: inline-flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 0.7mm; }
  .channel-card dd span { max-width: 100%; white-space: nowrap; overflow-wrap: normal; }
  .channel-card .metric-delta { font-size: 4.5pt; padding: 0.25mm 0.55mm; flex-wrap: wrap; justify-content: flex-end; white-space: normal; }
`;

const rows = [
  ['Wydatki', '16 804,88 zł', '+4820,6%', 'positive'],
  ['Rezerwacje', '66', '−58,5%', 'negative'],
  ['Wartość rezerwacji', '309 843,44 zł', null, null],
  ['ROAS', '18,44x', null, null],
];

function card(title) {
  return `
    <div class="channel-card">
      <h3>${title}</h3>
      <dl>
        ${rows
          .map(
            ([label, value, delta, tone]) => `
        <div>
          <dt>${label}</dt>
          <dd><span>${value}</span>${
              delta
                ? `<span class="metric-delta ${tone}">${delta} <small>vs rok do roku</small></span>`
                : ''
            }</dd>
        </div>`
          )
          .join('')}
      </dl>
    </div>`;
}

const page = (rules) => `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #0E2742; --muted: #65707A; --terracotta: #D85F36; --terracotta-muted: #C96545;
    --line: rgba(201,101,69,0.35); --line-soft: rgba(201,101,69,0.18);
    --green: #4F8B61; --red: #A84D44;
    --serif: 'DM Serif Display', Georgia, serif; --sans: 'Inter', Arial, sans-serif;
    --page-w: 108mm; --pad-x: 7mm;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: var(--navy); font-family: var(--sans); }
  body { font-feature-settings: 'tnum' 1, 'lnum' 1; }
  .hotel-page { position: relative; width: var(--page-w); padding: 6mm 0; background: #fff; }
  .page-main { margin: 0 var(--pad-x); max-width: calc(var(--page-w) - (2 * var(--pad-x))); }
  .channel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm; width: 100%; max-width: 100%; min-width: 0; }
  .channel-card { border: 0.16mm solid var(--line-soft); border-radius: 2mm; background: rgba(255,253,248,0.72); padding: 4mm; }
  .channel-card h3 { font-family: var(--serif); font-size: 15pt; font-weight: 400; line-height: 1.05; margin: 0 0 3mm; text-align: center; }
  dl { margin: 0; }
  .channel-card dl div { display: flex; justify-content: space-between; gap: 2mm; border-top: 0.12mm solid var(--line-soft); padding: 1.5mm 0; min-width: 0; max-width: 100%; }
  .metric-delta { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.35mm 0.9mm; background: rgba(14,39,66,0.055); font-size: 5.2pt; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .metric-delta small { margin-left: 0.7mm; color: var(--muted); font-size: 4.7pt; font-weight: 700; }
  .metric-delta.positive { color: var(--green); }
  .metric-delta.negative { color: var(--red); }
${rules}
</style></head>
<body>
    <div class="hotel-page"><div class="page-main">
    <div class="channel-grid">${card('Google Ads')}${card('Meta Ads')}</div>
  </div></div>
  <!-- overflow guard: any row wider than its card would print outside the frame -->
</body></html>`;

/** One client rect per line box, so >1 means the text wrapped. */
const measure = () =>
  Array.from(document.querySelectorAll('.channel-card')).map((cardEl) => ({
    platform: cardEl.querySelector('h3').textContent,
    rows: Array.from(cardEl.querySelectorAll('dl > div')).map((rowEl) => {
      const lineBoxes = (el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length;
      };
      const dt = rowEl.querySelector('dt');
      const valueSpan = rowEl.querySelector('dd > span');
      return {
        label: dt.textContent,
        labelLines: lineBoxes(dt),
        labelWidth: +dt.getBoundingClientRect().width.toFixed(1),
        value: valueSpan.textContent,
        valueLines: lineBoxes(valueSpan),
        ddWidth: +rowEl.querySelector('dd').getBoundingClientRect().width.toFixed(1),
        overflowPx: +(rowEl.scrollWidth - rowEl.clientWidth).toFixed(1),
      };
    }),
  }));

async function run(browser, label, rules, screenshotPath) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 800, height: 900, deviceScaleFactor: 3 });
  await tab.setContent(page(rules), { waitUntil: 'networkidle0' });
  await tab.evaluate(() => document.fonts.ready);
  const result = await tab.evaluate(measure);
  await tab.screenshot({ path: screenshotPath, clip: await tab.evaluate(() => {
    const { x, y, width, height } = document.querySelector('.hotel-page').getBoundingClientRect();
    return { x, y, width, height };
  }) });

  console.log(`\n===== ${label} =====`);
  for (const card of result) {
    console.log(`  ${card.platform}`);
    for (const row of card.rows) {
      const broken = row.labelLines > 1 || row.valueLines > 1;
      console.log(
        `    ${broken ? 'WRAPPED ' : 'ok      '} label="${row.label}" lines=${row.labelLines} (w=${row.labelWidth}px)` +
          ` | value="${row.value}" lines=${row.valueLines} (dd w=${row.ddWidth}px)` +
          (row.overflowPx > 0 ? ` | OVERFLOW ${row.overflowPx}px` : '')
      );
    }
  }
  await tab.close();
  return result;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    await run(browser, 'CURRENT CSS (overflow-wrap: anywhere)', CURRENT_RULES, '/tmp/channel-card-current.png');
    await run(browser, 'PATCHED CSS', PATCHED_RULES, '/tmp/channel-card-patched.png');
  } finally {
    await browser.close();
  }
})();
