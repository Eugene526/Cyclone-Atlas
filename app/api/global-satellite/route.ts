import { upstream, json, failed } from '@/lib/upstream';
import { GLOBAL_START } from '@/lib/global-satellite.mjs';
export async function GET() {
 try {
  const xml=await(await upstream('https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetCapabilities')).text();
  const section=xml.split('<Name>mumi:worldcloudmap_ir108</Name>')[1]?.split('</Layer>')[0];
  const time=section?.match(/<Dimension[^>]*default="([^"]+)"/)?.[1];
  if(!time || !Number.isFinite(Date.parse(time))) throw Error('全球衛星時間未提供');
  return json({time,start:GLOBAL_START,cadenceMinutes:180,source:'EUMETSAT / GOES / Himawari 多衛星合成',checkedAt:new Date().toISOString()},60);
 }catch(e){return failed(e)}
}
