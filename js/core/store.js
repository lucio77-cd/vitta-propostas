// Estado global mínimo com pub/sub. Cada skill lê/escreve apenas suas chaves.
const state = { user: null, authReady: false };
const listeners = new Map();

export const store = {
  get: (key) => state[key],
  set(key, value) {
    state[key] = value;
    (listeners.get(key) || []).forEach((fn) => fn(value));
  },
  subscribe(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  }
};
