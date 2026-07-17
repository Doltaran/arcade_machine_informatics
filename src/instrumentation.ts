type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
};

const createMemoryStorage = (): StorageLike => {
  let store = new Map<string, string>();

  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map<string, string>();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
};

const ensureLocalStorage = () => {
  const g = globalThis as typeof globalThis & { localStorage?: StorageLike };
  const ls = g.localStorage;
  const hasApi =
    ls &&
    typeof ls.getItem === "function" &&
    typeof ls.setItem === "function" &&
    typeof ls.removeItem === "function";

  if (!hasApi) {
    const memoryStorage = createMemoryStorage();
    try {
      Object.defineProperty(g, "localStorage", {
        value: memoryStorage,
        writable: false,
        configurable: true,
      });
    } catch {
      g.localStorage = memoryStorage;
    }
  }
};

export function register() {
  ensureLocalStorage();
}
