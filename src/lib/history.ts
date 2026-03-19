const STORAGE_KEY = 'tardis_furniture_history';
const MAX_ITEMS = 20;

export interface HistoryItem {
  id: string;
  name: string;
  category: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  imageDataUrl: string;
  taskId: string;
  createdAt: string;
}

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: HistoryItem): void {
  const history = getHistory();
  // Remove duplicate if exists
  const filtered = history.filter(h => h.id !== item.id);
  filtered.unshift(item);
  // Keep only recent items
  const trimmed = filtered.slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function removeFromHistory(id: string): void {
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
