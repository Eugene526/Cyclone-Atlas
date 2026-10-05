import {decodedWeather,encodeWeather} from '@/lib/weather-server';
export const runtime='nodejs';
import {fetchWeather,latestWeather} from '@/lib/weather-raw.mjs';
import {runDate} from '@/lib/gfs-raw.mjs';
import {validSelection} from '@/lib/weather-data.mjs';
export const maxDuration=120;
export async function GET(req:Request){const q=new URL(req.url).searchParams,model=q.get('model')||'',field=q.get('field')||'',level=Number(q.get('level'));if(!validSelection(model,field,level)||model==='era5')return Response.json({error:'未接入此模式／變數／高度的原始資料'},{status:400});try{if(q.get('latest')==='1')return Response.json(await latestWeather(model,field,level),{headers:{'Cache-Control':'public,max-age=600'}});const run=q.get('run')||'',step=Number(q.get('step')),age=Date.now()-+runDate(run);if(!q.has('step')||!Number.isFinite(age)||age<0||age>4*86400000)return Response.json({error:'起報超出原始來源保留時段'},{status:400});return new Response(encodeWeather(await decodedWeather(model,field,level,run,step)),{headers:{'Content-Type':'application/octet-stream','Content-Encoding':'gzip','Cache-Control':'public,max-age=86400'}})}catch(e){return Response.json({error:e instanceof Error?e.message:'原始天氣圖資料載入失敗'},{status:502})}}
