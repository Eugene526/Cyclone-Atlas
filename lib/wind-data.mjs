export const WIND_MODELS = [
 {id:'gfs',name:'GFS',provider:'NOAA',api:'gfs_global',days:16,native:'約 0.11°–0.25°'},
 {id:'ecmwf',name:'ECMWF IFS',provider:'ECMWF',api:'ecmwf_ifs025',days:10,native:'0.25°'},
 {id:'aifs-single',name:'AIFS Single',provider:'ECMWF',api:'ecmwf_aifs025_single',days:15,native:'0.25°'},
 {id:'ifs',name:'IFS ENS 平均',provider:'ECMWF',api:'ecmwf_ifs025_ensemble_mean',days:10,native:'0.25°',ensemble:true},
 {id:'aifs',name:'AIFS ENS 平均',provider:'ECMWF',api:'ecmwf_aifs025_ensemble_mean',days:15,native:'0.25°',ensemble:true},
 {id:'gefs',name:'GEFS 平均',provider:'NOAA',api:'ncep_gefs05_ensemble_mean',days:16,native:'0.5°',ensemble:true},
 {id:'aigefs',name:'AIGEFS 平均',provider:'NOAA',api:'ncep_aigefs025_ensemble_mean',no100:true,days:16,native:'0.25°',ensemble:true},
 {id:'cmce',name:'GEPS 平均',provider:'ECCC',api:'cmc_gem_geps_ensemble_mean',no100:true,days:10,native:'約 0.5°',ensemble:true,surfaceOnly:true},
 {id:'weathernext2',name:'WeatherNext 2 平均',provider:'Google',api:'google_weathernext2_ensemble_mean',days:15,native:'0.25° · 原生 6 小時',ensemble:true},
 {id:'icon',name:'ICON Global',provider:'DWD',api:'icon_global',days:7,native:'約 13 km'},
 {id:'jma',name:'JMA GSM',provider:'JMA',api:'jma_gsm',no100:true,days:7,native:'約 20 km'},
 {id:'fens',name:'FNMOC ENS',provider:'FNMOC',reason:'目前接入的是氣旋路徑，尚無已驗證的全球風場來源'},
 {id:'wnv3',name:'WeatherNext 3',provider:'Google',reason:'尚無已驗證的免費全球風場來源；不以 WeatherNext 2 代替'},
 {id:'google',name:'WeatherNext Cyclones',provider:'Google',reason:'目前接入的是氣旋路徑，不是完整格點風場'},
 {id:'fnv3',name:'FNV3P',provider:'Google',reason:'尚無已驗證的免費全球風場來源'},
];
export const WIND_LEVELS=[
 {id:'10m',label:'地面 · 10 公尺',surface:true},
 {id:'100m',label:'近地層 · 100 公尺',surface:true},
 {id:'925hPa',label:'925 百帕 · 約 0.8 公里'},
 {id:'850hPa',label:'850 百帕 · 約 1.5 公里'},
 {id:'700hPa',label:'700 百帕 · 約 3 公里'},
 {id:'500hPa',label:'500 百帕 · 約 5.6 公里'},
 {id:'300hPa',label:'300 百帕 · 約 9.2 公里'},
 {id:'250hPa',label:'250 百帕 · 約 10.4 公里'},
 {id:'200hPa',label:'200 百帕 · 約 11.8 公里'},
];
export const normalizeLon=lon=>((lon+180)%360+360)%360-180;
export function windUV(speed,direction){
 if(!Number.isFinite(speed)||speed<0||!Number.isFinite(direction))return null;
 const rad=direction*Math.PI/180;
 return [-speed*Math.sin(rad),-speed*Math.cos(rad)];
}
export function timeLimits(kind,model,now=new Date()){
 const today=new Date(now);today.setUTCHours(0,0,0,0);
 if(kind==='history'){
  const min=new Date(today),day=min.getUTCDate();min.setUTCDate(1);min.setUTCMonth(min.getUTCMonth()-3);min.setUTCDate(Math.min(day,new Date(Date.UTC(min.getUTCFullYear(),min.getUTCMonth()+1,0)).getUTCDate()));
  return {min:min.toISOString().slice(0,10),max:new Date(+today-6*86400000).toISOString().slice(0,10)};
 }
 return {min:today.toISOString().slice(0,10),max:new Date(+today+((model?.days||7)-1)*86400000).toISOString().slice(0,10)};
}
export function makeGrid(bounds,cols=20,rows=12){
 if(bounds.length!==4||!bounds.every(Number.isFinite))throw Error('無效地圖範圍');
 let [west,south,east,north]=bounds;
 if(east<=west||east-west>360.001||north<=south||south < -85||north>85)throw Error('地圖範圍超出限制');
 const lonStep=(east-west)/(cols-1),latStep=(north-south)/(rows-1);
 const points=[];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)points.push([west+i*lonStep,south+j*latStep]);
 return {west,south,east,north,cols,rows,lonStep,latStep,points};
}
// Interpolate u/v, not compass angles; never fill missing samples with zero.
export function sampleWind(grid,frame,lon,lat){
 const center=(grid.west+grid.east)/2;lon+=Math.round((center-lon)/360)*360;
 const x=(lon-grid.west)/grid.lonStep,y=(lat-grid.south)/grid.latStep;
 if(x<0||y<0||x>grid.cols-1||y>grid.rows-1)return null;
 const i=Math.min(grid.cols-2,Math.floor(x)),j=Math.min(grid.rows-2,Math.floor(y)),a=x-i,b=y-j;
 const ids=[j*grid.cols+i,j*grid.cols+i+1,(j+1)*grid.cols+i,(j+1)*grid.cols+i+1];
 if(ids.some(k=>!Number.isFinite(frame.u[k])||!Number.isFinite(frame.v[k])))return null;
 const weights=[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b];
 const u=ids.reduce((s,k,n)=>s+frame.u[k]*weights[n],0),v=ids.reduce((s,k,n)=>s+frame.v[k]*weights[n],0);
 return {u,v,speed:Math.hypot(u,v),direction:(Math.atan2(-u,-v)*180/Math.PI+360)%360};
}
const palette=[[0,[22,40,65]],[3,[35,82,104]],[7,[34,125,134]],[12,[75,158,122]],[18,[177,171,94]],[25,[207,127,78]],[35,[168,74,111]],[50,[105,66,130]],[75,[223,188,230]]];
export function windColor(speed){
 const s=Math.max(0,Math.min(75,speed));let i=1;while(i<palette.length-1&&s>palette[i][0])i++;
 const [x,a]=palette[i-1],[y,b]=palette[i],t=(s-x)/(y-x);return a.map((c,k)=>Math.round(c+(b[k]-c)*t));
}
