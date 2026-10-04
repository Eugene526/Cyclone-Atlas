// NOAA GFS public GRIB2: fixed origin and indexed byte ranges only.
export const GFS_ORIGIN='https://noaa-gfs-bdp-pds.s3.amazonaws.com';
export function gfsUrl(run,step){
 if(!/^\d{8}(00|06|12|18)$/.test(run)||!Number.isInteger(step)||step<0||step>384||(step>120&&step%3))throw Error('無效 GFS 起報時間／預報時效');
 if(!Number.isFinite(+runDate(run))||formatRun(runDate(run))!==run)throw Error('無效 GFS 起報日期');
 return `${GFS_ORIGIN}/gfs.${run.slice(0,8)}/${run.slice(8)}/atmos/gfs.t${run.slice(8)}z.pgrb2.0p25.f${String(step).padStart(3,'0')}`;
}
export function runDate(run){return new Date(`${run.slice(0,4)}-${run.slice(4,6)}-${run.slice(6,8)}T${run.slice(8)}:00:00Z`)}
export function formatRun(d){return d.toISOString().slice(0,13).replace(/[-T]/g,'')}
export function forecastStep(run,date,hour){const raw=(Date.parse(`${date}T${String(hour).padStart(2,'0')}:00Z`)-+runDate(run))/3600000;return raw>120?Math.round(raw/3)*3:raw}
export function windRanges(idx,level){
 const layer=level.endsWith('hPa')?`${parseInt(level)} mb`:`${parseInt(level)} m above ground`;
 const rows=idx.trim().split('\n').map(s=>s.split(':'));
 const vars=['UGRD','VGRD',...(level.endsWith('hPa')?['PRES']:[])];
 return vars.map(variable=>{const n=rows.findIndex(r=>r[3]===variable&&r[4]===(variable==='PRES'?'surface':layer));if(n<0||!rows[n+1])throw Error(`NOAA 未提供 ${variable} ${layer}`);const start=Number(rows[n][1]),end=Number(rows[n+1][1])-1;if(!Number.isSafeInteger(start)||end<start||end-start>8000000)throw Error('GRIB 索引範圍無效');return {variable,start,end}});
}
