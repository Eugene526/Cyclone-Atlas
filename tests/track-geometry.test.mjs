import assert from 'node:assert/strict';
import {densifyTrack} from '../lib/track-geometry.mjs';

const haversine=(a,b)=>{const r=Math.PI/180,lat1=a[1]*r,lat2=b[1]*r,dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r,h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 12742.0176*Math.asin(Math.sqrt(h));};
const path=densifyTrack([{lon:120,lat:10},{lon:145,lat:35},{lon:160,lat:42}],100);
assert.deepEqual(path[0],[120,10]);
assert.deepEqual(path.at(-1),[160,42]);
assert(path.length>3,'long API segments should be densified');
assert(path.slice(1).every((p,i)=>haversine(path[i],p)<=100.01),'segments should stay within requested sampling interval');
assert(path.some(p=>Math.abs(p[1]-22.5)>0.1),'intermediate coordinates should follow a great-circle arc, not a straight lat/lon chord');
const crossing=densifyTrack([{lon:179,lat:15},{lon:-179,lat:16}],50);
assert(crossing.length>2);
assert(crossing.every((p,i)=>i===0||Math.abs(p[0]-crossing[i-1][0])<2),'date-line crossings must not create a world-spanning line');
console.log('track geometry: great-circle interpolation, segment limits and date-line continuity passed');
