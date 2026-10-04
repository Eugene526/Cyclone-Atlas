import {splitMessages,parseFields,parseGrid,parseProduct,decodeFieldValues} from '@azohra/meteo.grib';
// Preserve every original 0.25-degree sample; add just the wrap column at 360°.
export function decodeGFS(bytes,level,run,step){
 const fields=splitMessages(bytes).flatMap(parseFields),decoded={};let geometry=null;
 for(const field of fields){
 const id=field.identification;if(`${id.year}${String(id.month).padStart(2,'0')}${String(id.day).padStart(2,'0')}${String(id.hour).padStart(2,'0')}`!==run)throw Error('GRIB 起報時間不符');
 const p=parseProduct(field.section4);if(p.forecastTime!==step||p.indicatorOfUnitOfTimeRange!==1)throw Error('GRIB 預報時效不符');
 const name=p.parameterCategory===2&&p.parameterNumber===2?'u':p.parameterCategory===2&&p.parameterNumber===3?'v':p.parameterCategory===3&&p.parameterNumber===0?'p':null;
 if(!name)throw Error('GRIB 欄位不是風分量／地面氣壓');
 const expectedType=name==='p'?1:level.endsWith('hPa')?100:103,expectedValue=name==='p'?null:parseInt(level)*(level.endsWith('hPa')?100:1);
 if(p.typeOfFirstFixedSurface!==expectedType||(expectedValue!==null&&p.scaledValueOfFirstFixedSurface*10**(-p.scaleFactorOfFirstFixedSurface)!==expectedValue))throw Error('GRIB 高度不符');
 const g=parseGrid(field.section3);if(g.kind!=='latlon'||g.ni!==1440||g.nj!==721||g.iDirectionIncrement!==.25||g.jDirectionIncrement!==.25||g.iScansNegatively||g.jScansPositively||g.jPointsAreConsecutive||g.alternativeRowScanning||g.uvRelativeToGrid||g.latitudeOfFirstGridPoint!==90||g.longitudeOfFirstGridPoint!==0)throw Error('來源網格格式改變，停止顯示');
 if(geometry&&geometry.gridKey!==g.gridKey)throw Error('風分量格點不一致');geometry=g;
 const result=decodeFieldValues(field);if(result.values.length!==1440*721)throw Error('解碼格點數不符');decoded[name]=result.values;
 }
 if(!decoded.u||!decoded.v||(level.endsWith('hPa')&&!decoded.p))throw Error('缺少必要 GRIB 欄位');
 const cols=1441,rows=721,u=new Float32Array(cols*rows),v=new Float32Array(cols*rows);let valid=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const src=(720-j)*1440+(i%1440),dst=j*cols+i,a=decoded.u[src],b=decoded.v[src],pressure=decoded.p?.[src];const good=Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<250&&Math.abs(b)<250&&(!level.endsWith('hPa')||(Number.isFinite(pressure)&&pressure>=parseInt(level)*100));u[dst]=good?a:NaN;v[dst]=good?b:NaN;if(good)valid++}
 if(!valid)throw Error('原始風場沒有有效格點');
 return {grid:{west:0,east:360,south:-90,north:90,cols,rows,lonStep:.25,latStep:.25},u,v,validFraction:valid/u.length};
}
