/**
 * BET SLIP STORE (client).
 *
 * UI CONTRACT (spec §5) - enforced here and covered by unit tests:
 *   * ONLY a dedicated bet-slip control may open the slip (`openFromControl`)
 *   * adding/removing a selection toggles; clicking a match, team, league, score or
 *     market title never calls into this store
 *   * once the user closes the slip it STAYS closed (`userClosedUntilExplicitOpen`)
 *     until the user opens it again or adds a new selection
 * The store holds display data only: prices, payouts and balances are always the server's.
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SlipItem {
  selectionId: string; marketId: string; matchId: string;
  label: string; marketLabel: string; matchLabel: string; sportSlug: string;
  /** Odds the user SAW. Never authoritative. */
  oddsScaled: string; oddsVersionSeen: number;
  addedAt: number;
}

interface BetSlipState {
  items: SlipItem[];
  isOpen: boolean;
  /** True when the user closed the slip: it must not reopen by itself. */
  userClosed: boolean;
  mode: 'SINGLE' | 'MULTIPLE';
  fundingSource: 'main' | 'bonus';
  bonusGrantId: string | null;
  stakeMinor: string;
  isSubmitting: boolean;
  lastError: string | null;
  lastSuccess: string | null;
  toggle(item: SlipItem): { action: 'ADDED' | 'REMOVED' | 'REPLACED' | 'REJECTED'; reason?: string };
  replaceItems(items: SlipItem[], mode: 'SINGLE' | 'MULTIPLE'): void;
  remove(selectionId: string): void;
  clear(): void;
  /** Only a dedicated bet-slip control may call this. */
  openFromControl(): void;
  close(): void;
  setMode(mode: 'SINGLE' | 'MULTIPLE'): void;
  setFundingSource(source: 'main' | 'bonus'): void;
  setBonusGrantId(id: string | null): void;
  setStake(minor: string): void;
  setSubmitting(value: boolean): void;
  setError(message: string | null): void;
  setSuccess(message: string | null): void;
  /** After an odds change is accepted, refresh the stored price for a selection. */
  applyAcceptedOdds(selectionId: string, oddsScaled: string, oddsVersion: number): void;
  /** Sync current market odds into selections already present in the Bet Slip. */
  syncOdds(updates: Array<{ selectionId: string; oddsScaled: string; oddsVersion: number }>): void;
}

export const MAX_SLIP_ITEMS = 20;

export const useBetSlip = create<BetSlipState>()(
  persist(
    (set, get) => ({
      items: [], isOpen: false, userClosed: false, mode: 'SINGLE', fundingSource: 'main', bonusGrantId: null, stakeMinor: '0',
      isSubmitting: false, lastError: null, lastSuccess: null,

      replaceItems(items, mode) {
        set({ items: items.slice(0, MAX_SLIP_ITEMS), mode, isOpen: true, userClosed: false, lastError: null, lastSuccess: null });
      },
      toggle(item) {
        const items = get().items;
        const existing = items.find((i) => i.selectionId === item.selectionId);
        if (existing) {
          set({ items: items.filter((i) => i.selectionId !== item.selectionId) });
          return { action: 'REMOVED' };
        }
        const sameMarket = items.find((i) => i.marketId === item.marketId);
        if (sameMarket) {
          set({ items: [...items.filter((i) => i.marketId !== item.marketId), item] });
          return { action: 'REPLACED' };
        }
        if (items.length >= MAX_SLIP_ITEMS) {
          return { action: 'REJECTED', reason: `MAX_ITEMS_${MAX_SLIP_ITEMS}` };
        }
        const nextItems = [...items, item];
        // Adding a selection is an explicit user action: the slip may open for it.
        set({ items: nextItems, userClosed: false, isOpen: true, lastError: null });
        return { action: 'ADDED' };
      },

      remove(selectionId) {
        set({ items: get().items.filter((i) => i.selectionId !== selectionId) });
      },

      clear() {
        set({
          items: [],
          stakeMinor: '0',
          fundingSource: 'main',
          bonusGrantId: null,
          lastError: null,
          lastSuccess: null,
        });
      },

      openFromControl() {
        set({ isOpen: true, userClosed: false });
      },

      close() {
        // Closing keeps it closed.
        set({ isOpen: false, userClosed: true });
      },

      setMode(mode) { set({ mode }); },
      setFundingSource(source) {
        set({
          fundingSource: source,
          bonusGrantId: source === 'main' ? null : get().bonusGrantId,
          lastError: null,
        });
      },
      setBonusGrantId(id) { set({ bonusGrantId: id, lastError: null }); },
      setStake(minor) { set({ stakeMinor: minor.replace(/[^\d]/g, '') || '0' }); },
      setSubmitting(isSubmitting) { set({ isSubmitting }); },
      setError(lastError) { set({ lastError, isSubmitting: false }); },
      setSuccess(lastSuccess) { set({ lastSuccess, isSubmitting: false }); },

      applyAcceptedOdds(selectionId, oddsScaled, oddsVersion) {
        set({
          items: get().items.map((i) => (i.selectionId === selectionId ? { ...i, oddsScaled, oddsVersionSeen: oddsVersion } : i)),
        });
      },
      syncOdds(updates) {
        if (!updates.length) return;
        const bySelection = new Map(
          updates.map((update) => [
            update.selectionId,
            { oddsScaled: update.oddsScaled, oddsVersion: update.oddsVersion },
          ]),
        );
        const current = get().items;
        let changed = false;
        const next = current.map((item) => {
          const update = bySelection.get(item.selectionId);
          if (!update) return item;
          if (
            item.oddsScaled === update.oddsScaled &&
            item.oddsVersionSeen === update.oddsVersion
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            oddsScaled: update.oddsScaled,
            oddsVersionSeen: update.oddsVersion,
          };
        });
        if (changed) set({ items: next });
      },
    }),
    {
      name: 'nova-betslip',
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        mode: state.mode,
        fundingSource: state.fundingSource,
        bonusGrantId: state.bonusGrantId,
        stakeMinor: state.stakeMinor,
        userClosed: state.userClosed,
      }),
    },
  ),
);

export const betSlipSelectors = {
  count: (state: BetSlipState) => state.items.length,
  isVisible: (state: BetSlipState) => state.isOpen && !state.userClosed,
};
