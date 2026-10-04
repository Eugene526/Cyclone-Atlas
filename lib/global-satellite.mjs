// EUMETView's multimission geostationary ring has a three-hour cadence.
export const GLOBAL_START = '2021-06-06T15:00:00.000Z';
export function globalFrame(time) {
 const ms = Date.parse(time);
 if (!Number.isFinite(ms)) throw new Error('無效衛星時間');
 return new Date(Math.floor(ms / 10800000) * 10800000).toISOString();
}
export function globalTileURL(time, z, x, y, rgb = false) {
 if (![z,x,y].every(Number.isInteger) || z<0 || z>6 || x<0 || y<0 || x>=2**z || y>=Math.max(1,2**(z-1))) throw new Error('無效圖磚');
 const size=360/2**z;
 const bbox=[-180+x*size,90-(y+1)*size,-180+(x+1)*size,90-y*size];
 const q=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:rgb?'mumi:wideareacoverage_rgb_natural':'mumi:worldcloudmap_ir108',styles:'',srs:'EPSG:4326',bbox:bbox.join(','),width:'256',height:'256',format:'image/png',transparent:'true',time:globalFrame(time)});
 return 'https://view.eumetsat.int/geoserver/wms?'+q;
}
