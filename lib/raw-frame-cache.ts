// Bound memory across all providers, not six independent caches.
const cache=new Map<string,any>();
export function getRawFrame(key:string){const value=cache.get(key);if(value){cache.delete(key);cache.set(key,value)}return value}
export function putRawFrame(key:string,value:any){cache.delete(key);cache.set(key,value);while(cache.size>6)cache.delete(cache.keys().next().value!)}
