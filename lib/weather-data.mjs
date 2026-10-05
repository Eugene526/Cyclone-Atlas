import {WIND_MODELS} from './wind-data.mjs';
export const WEATHER_FIELDS=[{id:'humidity',name:'相對濕度',unit:'%',description:'越接近 100%，空氣越接近飽和；高濕度不等於一定下雨。'},{id:'height',name:'位勢高度',unit:'gpm',description:'等高線表示同一氣壓面的位勢高度，可用來判讀槽、脊與大尺度環流。'},{id:'temperature',name:'氣溫',unit:'°C',description:'所選氣壓層的氣溫，不是地面體感溫度。'}];
export const WEATHER_LEVELS=[925,850,700,500,300,250,200];
export const WEATHER_MODELS=[...WIND_MODELS,{id:'era5',name:'ERA5 再分析',provider:'ECMWF / ARCO',api:'era5',raw:true,native:'0.25°'}];
export function availableLevels(model,field){if(SURFACE_FIELDS.includes(field))return supportsField(model,field)?[0]:[];if(!supportsField(model,field))return [];return WEATHER_LEVELS.filter(p=>!(model==='jma'&&field==='humidity'&&p<300))}
export function validSelection(model,field,level){return WEATHER_MODELS.some(m=>m.id===model&&m.api)&&(WEATHER_FIELDS.some(f=>f.id===field)||HIDDEN_FIELDS.includes(field))&&availableLevels(model,field).includes(level)}
// Relative humidity with respect to liquid water, from q [kg/kg], T [K], p [hPa].
// This diagnostic is explicitly labelled; it is not native model RH (ice/mixed-phase definitions differ).
export function relativeHumidity(q,t,p){if(!Number.isFinite(q)||q<0||q>=.1||!Number.isFinite(t)||t<150||t>350||p<=0)return NaN;const e=q*p/(.622+.378*q),es=6.112*Math.exp(17.67*(t-273.15)/(t-29.65));return 100*e/es}
export function convertScalar(value,short,field){if(!Number.isFinite(value)||Math.abs(value)>1e8)return NaN;if(field==='height')return short==='z'?value/9.80665:value;if(['temperature','temperature2m','dewpoint2m'].includes(field))return value-273.15;if(field==='pressure')return value/100;return value}
export function sampleScalar(grid,values,lon,lat){if(!grid||!values)return null;lon+=Math.round(((grid.west+grid.east)/2-lon)/360)*360;const x=(lon-grid.west)/grid.lonStep,y=(lat-grid.south)/grid.latStep;if(x<0||y<0||x>grid.cols-1||y>grid.rows-1)return null;const i=Math.min(grid.cols-2,Math.floor(x)),j=Math.min(grid.rows-2,Math.floor(y)),a=x-i,b=y-j,k=j*grid.cols+i,v0=values[k],v1=values[k+1],v2=values[k+grid.cols],v3=values[k+grid.cols+1];if(!Number.isFinite(v0)||!Number.isFinite(v1)||!Number.isFinite(v2)||!Number.isFinite(v3))return null;return v0*(1-a)*(1-b)+v1*a*(1-b)+v2*(1-a)*b+v3*a*b}
export function colorScale(field,level){if(field==='humidity')return {min:0,max:100,colors:[[113,74,51],[176,137,89],[193,201,177],[81,160,154],[48,98,168],[130,100,188]]};if(field==='temperature2m')return {min:-20,max:45,colors:[[95,98,171],[60,145,179],[106,182,140],[219,192,105],[207,103,68],[178,67,109]]};if(field.startsWith('rain'))return {min:0,max:field==='rain6'?60:field==='rain24'?300:600,colors:[[24,44,60],[60,142,164],[87,181,128],[224,200,87],[223,116,62],[182,69,127]]};if(field==='cape')return {min:0,max:4000,colors:[[28,51,67],[49,126,135],[111,178,127],[224,190,92],[202,90,99]]};if(field==='pressure')return {min:950,max:1040,colors:[[122,80,150],[59,119,155],[100,170,162],[215,188,107],[192,99,71]]};if(field==='cloud')return {min:0,max:100,colors:[[20,43,61],[60,85,105],[145,168,183],[233,242,246]]};if(field==='temperature')return {min:-80,max:40,colors:[[125,84,158],[52,98,161],[66,160,185],[111,186,150],[222,192,109],[197,83,71]]};const base={925:750,850:1450,700:3000,500:5500,300:9100,250:10300,200:11800}[level]||5500;return {min:base-900,max:base+900,colors:[[64,79,132],[62,131,160],[110,174,157],[209,188,107],[196,112,77]]}}
export function scalarColor(value,field,level){const {min,max,colors}=colorScale(field,level),p=Math.max(0,Math.min(colors.length-1,(value-min)/(max-min)*(colors.length-1))),i=Math.min(colors.length-2,Math.floor(p)),a=p-i;return colors[i].map((v,k)=>Math.round(v+(colors[i+1][k]-v)*a))}
// Marching squares: return separate segments; never join across a missing cell or date line.
export function contourSegments(grid,values,interval=60,stride=4){const segments=[];for(let j=0;j<grid.rows-stride;j+=stride)for(let i=0;i<grid.cols-stride;i+=stride){const ids=[j*grid.cols+i,j*grid.cols+i+stride,(j+stride)*grid.cols+i+stride,(j+stride)*grid.cols+i],v=ids.map(k=>values[k]);if(!v.every(Number.isFinite))continue;const pts=[[i,j],[i+stride,j],[i+stride,j+stride],[i,j+stride]],min=Math.min(...v),max=Math.max(...v);for(let h=Math.ceil(min/interval)*interval;h<=max;h+=interval){const cuts=[];for(let k=0;k<4;k++){const n=(k+1)%4;if((v[k]<h&&v[n]>=h)||(v[n]<h&&v[k]>=h)){const t=(h-v[k])/(v[n]-v[k]);cuts.push([grid.west+(pts[k][0]+t*(pts[n][0]-pts[k][0]))*grid.lonStep,grid.south+(pts[k][1]+t*(pts[n][1]-pts[k][1]))*grid.latStep])}}if(cuts.length===2)segments.push({height:h,coordinates:cuts});else if(cuts.length===4){const pairs=(v.reduce((a,b)=>a+b,0)/4>=h)===(v[0]>=h)?[[0,1],[2,3]]:[[0,3],[1,2]];for(const [a,b] of pairs)segments.push({height:h,coordinates:[cuts[a],cuts[b]]})}}}return segments}
export const SURFACE_FIELDS=['temperature2m','dewpoint2m','pressure','cloud','cape','rain6','rain24','rainTotal','u10','v10'];
export const HIDDEN_FIELDS=['dewpoint2m','u10','v10','windu','windv'];
export const minimumStep=field=>field==='rain24'?24:field?.startsWith('rain')?6:0;
export const PRODUCTS=[
 {id:'scalar',name:'單一氣象圖層',field:'humidity',level:850},
 {id:'rainwind',name:'6h 降水＋925hPa 風場',field:'rain6',level:0,wind:925},
 {id:'windheight',name:'850hPa 風場＋500hPa 高度場',field:'height',level:500,wind:850},
 {id:'tempheight',name:'2m 氣溫＋500hPa 高度場',field:'temperature2m',level:0,height:500},
 {id:'raincloud',name:'降水與雲量',field:'rain6',level:0,cloud:true},
];
WEATHER_FIELDS.push(
 {id:'temperature2m',name:'2m 氣溫',unit:'°C',description:'模式地表上方 2 公尺的氣溫；仍受模式地形解析度影響。'},
 {id:'rain6',name:'6 小時降水',unit:'mm',description:'有效時間之前六小時的總降水（水當量），包括液態與固態降水，不是雷達實測。'},
 {id:'rain24',name:'24 小時累計降水',unit:'mm',description:'有效時間之前二十四小時的總降水（水當量），由同一起報的原始累積欄位計算。'},
 {id:'rainTotal',name:'起報以來累計降水',unit:'mm',description:'從此模式起報至目前有效時間的總降水（水當量）。'},
 {id:'cape',name:'對流有效位能 CAPE',unit:'J/kg',description:'不穩定能量指標，不是雷雨機率；ECMWF 為最不穩定氣塊 CAPE，GFS 為地面氣塊 CAPE。'},
 {id:'cloud',name:'總雲量',unit:'%',description:'整個大氣柱的總雲覆蓋率，不代表降雨量。'},
 {id:'pressure',name:'海平面氣壓',unit:'hPa',description:'模式換算至海平面的氣壓，與高山測站實際氣壓不同。'},
);
export function supportsField(model,field){if(model==='gfs'&&field==='rainTotal')return false;if(['humidity','height','temperature'].includes(field))return WEATHER_MODELS.some(m=>m.id===model&&m.api);if(['windu','windv'].includes(field))return ['gfs','ecmwf','aifs-single','gefs','icon','cmce','jma'].includes(model);return ['gfs','ecmwf','aifs-single'].includes(model)&&(field!=='cape'||model!=='aifs-single')}
export function dewpointHumidity(t,d){if(!Number.isFinite(t)||!Number.isFinite(d))return null;return 100*Math.exp(17.625*d/(243.04+d)-17.625*t/(243.04+t))}
