export function nextPlaybackTime(date,hour,start,end,min,max,cadence=1){
 const current=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00Z`);
 const first=Date.parse(start+'Z'),last=Date.parse(end+'Z');
 const earliest=Date.parse(`${min}T00:00Z`),latest=Date.parse(`${max}T23:00Z`);
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last||first<earliest||last>latest)return null;
 const increment=Math.max(1,Math.floor(Number(cadence)||1))*3600000;
 const candidate=current<first?first:current+increment;
 const next=current>=last||candidate>last?first:candidate;
 const iso=new Date(next).toISOString();return {date:iso.slice(0,10),hour:new Date(next).getUTCHours()};
}

// datetime-local has no timezone. Keep animation range state in UTC and map
// the input's wall-clock values explicitly to the currently selected display zone.
export function rangeInputFromUTC(value,zone='utc'){
 const instant=Date.parse(`${value}Z`);
 if(!Number.isFinite(instant))return '';
 return new Date(instant+(zone==='tw'?8*3600000:0)).toISOString().slice(0,16);
}
export function rangeInputToUTC(value,zone='utc'){
 const wall=Date.parse(`${value}Z`);
 if(!Number.isFinite(wall))return '';
 return new Date(wall-(zone==='tw'?8*3600000:0)).toISOString().slice(0,16);
}
