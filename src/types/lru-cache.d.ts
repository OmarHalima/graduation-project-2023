declare module 'lru-cache' {
  export class LRUCache<K = any, V = any> {
    constructor(options?: LRUCache.Options<K, V>);
    set(key: K, value: V, options?: { ttl?: number }): boolean;
    get(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
  }

  namespace LRUCache {
    interface Options<K = any, V = any> {
      max?: number;
      ttl?: number;
      maxSize?: number;
      sizeCalculation?: (value: V, key: K) => number;
      dispose?: (value: V, key: K) => void;
      updateAgeOnGet?: boolean;
      updateAgeOnHas?: boolean;
    }
  }
}