export function nextPlaybackTime(date,hour,start,end,min,max){
 const current=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00Z`);
 const first=Date.parse(start+'Z'),last=Date.parse(end+'Z');
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last||start.slice(0,10)<min||end.slice(0,10)>max)return null;
 const next=current<first||current>=last?first:Math.min(current+3600000,last);
 const iso=new Date(next).toISOString();return {date:iso.slice(0,10),hour:new Date(next).getUTCHours()};
}
