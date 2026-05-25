/**
 * Dynamic conversion / action discovery for admin "Dane API" modal.
 * Surfaces raw API identifiers + counts beyond the fixed metric catalog.
 */

import { createHash } from 'crypto';

function hash16(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
}

/** Config + snapshot key for a Meta `action_type` (same id → same key forever). */
export function stableMetaDynamicKey(actionType: string): string {
  return `dyn_meta_${hash16(actionType)}`;
}

/** Config + snapshot key for a Google conversion action name. */
export function stableGoogleDynamicKey(conversionName: string): string {
  return `dyn_google_${hash16(conversionName)}`;
}

export type DynamicConversionApiRow = {
  /** Stable id (Meta: action_type, Google: conversion action name) */
  id: string;
  /** Human-readable label (defaults to id) */
  label: string;
  count: number;
  /** Same key used in metrics config and discovery snapshots */
  key: string;
  /** Google: sum of all_conversions_value for that action */
  value?: number;
};

const MAX_ROWS = 120;

/**
 * Aggregate Meta Insights `actions[]` across all campaigns in the payload.
 */
export function extractMetaDynamicActionRows(
  campaigns: unknown[] | undefined | null
): DynamicConversionApiRow[] {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return [];
  const totals = new Map<string, number>();
  for (const raw of campaigns) {
    const c = raw as Record<string, unknown>;
    const actions = c.actions;
    if (!Array.isArray(actions)) continue;
    for (const rawA of actions) {
      const a = rawA as Record<string, unknown>;
      const actionType = String(a.action_type || '').trim();
      if (!actionType) continue;
      const v = parseInt(String(a.value ?? '0'), 10);
      if (Number.isNaN(v) || v <= 0) continue;
      totals.set(actionType, (totals.get(actionType) || 0) + v);
    }
  }
  return Array.from(totals.entries())
    .map(([id, count]) => ({
      id,
      label: id,
      key: stableMetaDynamicKey(id),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_ROWS);
}

/** Flat map for merging into metric snapshots (dashboard / API). */
export function metaCampaignsToDynamicMetricMap(
  campaigns: unknown[] | null | undefined
): Record<string, number> {
  const rows = extractMetaDynamicActionRows(campaigns);
  const m: Record<string, number> = {};
  for (const r of rows) {
    m[r.key] = r.count;
  }
  return m;
}
