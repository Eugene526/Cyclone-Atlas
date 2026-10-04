export async function upstream(url:string,init:RequestInit={}){
 const r=await fetch(url,{...init,signal:AbortSignal.timeout(18000),headers:init.headers});
 if(!r.ok)throw new Error(`來源回覆 ${r.status}`);return r;
}
export const json=(data:unknown,age=60)=>Response.json(data,{headers:{'Cache-Control':`public, max-age=${age}, stale-while-revalidate=30`}});
export const failed=(e:unknown)=>Response.json({error:e instanceof Error?e.message:'資料暫時未取得',checkedAt:new Date().toISOString()},{status:502});
