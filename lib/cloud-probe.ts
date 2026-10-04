import {alphaTemperature} from './probe-state.mjs';
import {stamp} from './satellite';
export async function cloudTemperature(time:string,coordinate:number[]){
 const [gx,gy]=coordinate,n=10,pixel=11000000/(550*n),x=(gx+5500000)/pixel,y=(5500000-gy)/pixel;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=550*n||y>=550*n)throw Error('此位置不在衛星觀測範圍');
 const h=35786023,H=h+6378137,sy=Math.sin(gy/h)**2,cx=Math.cos(gx/h),ratio=(6378137/6356752.314245)**2;
 if(H*H*cx*cx*(1-sy)-(1+(ratio-1)*sy)*(H*H-6378137**2)<0)throw Error('此位置不在衛星可見地球範圍');
 const tx=Math.floor(x/550),ty=Math.floor(y/550),img=new Image();img.src=`/api/tile?mode=ir&time=${stamp(time)}&n=${n}&x=${tx}&y=${ty}`;
 await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('此時間的紅外線影像未能載入'))});
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,0,0);
 const alpha=ctx.getImageData(Math.min(img.width-1,Math.floor(x-tx*550)),Math.min(img.height-1,Math.floor(y-ty*550)),1,1).data[3];
 return {temperature:alphaTemperature(alpha),alpha};
}
