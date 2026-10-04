// Cache accelerates downloads; lack of platform cache access must never block data.
export function bestEffortCache(provider){
 let unavailable=false;
 function get(){if(unavailable)return;try{return provider()}catch{unavailable=true}}
 return {
  async match(key){const cache=get();if(!cache)return;try{return await cache.match(key)}catch{unavailable=true}},
  async put(key,response){const cache=get();if(!cache)return;try{await cache.put(key,response)}catch{unavailable=true}},
 };
}
export const edgeCache=bestEffortCache(()=>globalThis.caches?.default);
