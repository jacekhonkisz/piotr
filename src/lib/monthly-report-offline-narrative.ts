import { isBelmonteClient } from './offline-reservation-estimate';

export type MonthlyOfflineNarrativeParams = {
  totalMicroConversions: number;
  estimatedOfflineReservations: number;
  estimatedOfflineValue: number;
  finalCostPercentage: number;
  totalValue: number;
  monthName: string;
  year: number;
  /** Meta Ads online reservation value (PLN) — required for Belmonte copy */
  metaReservationValue: number;
};

function fmtPlnWhole(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString('pl-PL')} zł`;
}

function fmtDec(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString('pl-PL');
}

/**
 * Polish copy for the monthly email “offline potential” block.
 * Belmonte uses the agreed Meta-only model (custom micro pool + 10× Meta avg); others keep the 20% heuristic text.
 */
export function getMonthlyOfflineNarrative(
  clientName: string,
  p: MonthlyOfflineNarrativeParams
): {
  highlightParagraphsText: [string, string];
  totalClosingLine: string;
  totalBoxLabel: string;
} {
  if (isBelmonteClient(clientName)) {
    const p1 =
      `W modelu uzgodnionym dla Belmonte dla Meta Ads uwzględniamy ${fmtInt(p.totalMicroConversions)} mikrokonwersji ` +
      `(wybrane niestandardowe akcje z eksportu Meta). Szacunkową wartość rezerwacji offline liczymy jako ` +
      `10 × średnia wartość rezerwacji online z Meta Ads — co daje ok. ${fmtPlnWhole(p.estimatedOfflineValue)} ` +
      `obok wartości rezerwacji zmierzonych online w Meta (${fmtPlnWhole(p.metaReservationValue)}).`;
    const p2 =
      `Przy sumie wartości online z Meta i powyższym szacunku offline efektywny koszt pozyskania rezerwacji wynosi ok. ` +
      `${fmtDec(p.finalCostPercentage)}% (wydatki na Meta Ads względem sumy: online Meta + szacunek offline).`;
    return {
      highlightParagraphsText: [p1, p2],
      totalClosingLine: `Zatem suma wartości rezerwacji za ${p.monthName} ${p.year} (wartość online z Meta + szacunek offline) wynosi około: ${fmtPlnWhole(p.totalValue)}.`,
      totalBoxLabel: `Suma wartości rezerwacji za ${p.monthName} ${p.year} (wartość online z Meta + szacunek offline):`
    };
  }

  const thousands = Math.round(p.estimatedOfflineValue / 1000).toLocaleString('pl-PL');
  const p1 =
    `Dodatkowo pozyskaliśmy też ${fmtInt(p.totalMicroConversions)} mikro konwersji (telefonów i e-maili), ` +
    `które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, ` +
    `to pozyskaliśmy ${fmtInt(p.estimatedOfflineReservations)} rezerwacji i dodatkowe ok. ${thousands} tys. zł tą drogą.`;
  const p2 = `Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. ${fmtDec(p.finalCostPercentage)}%.`;
  return {
    highlightParagraphsText: [p1, p2],
    totalClosingLine: `Zatem suma wartości rezerwacji za ${p.monthName} ${p.year} (online + offline) wynosi około: ${fmtPlnWhole(p.totalValue)}.`,
    totalBoxLabel: `Suma wartości rezerwacji za ${p.monthName} ${p.year} (online + offline):`
  };
}
