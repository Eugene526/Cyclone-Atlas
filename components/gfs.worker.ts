import {decodeGFS} from '@/lib/gfs-decode.mjs';
self.onmessage=(e)=>{try{const {bytes,level,run,step}=e.data;const result=decodeGFS(new Uint8Array(bytes),level,run,step);self.postMessage({result}, {transfer:[result.u.buffer,result.v.buffer]})}catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)})}};
