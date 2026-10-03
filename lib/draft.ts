import { emptyDraft, type Draft } from './baseline.ts';

const KEY = 'kas-keluarga.draft.v1';

// Storage can throw in private windows or when the person blocked site data; the form still works without it.
export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return parsed?.version === 1 ? { ...emptyDraft(), ...parsed } : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing stored to clear */
  }
}
