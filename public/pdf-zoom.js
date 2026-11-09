// Zoom document content, leaving the surrounding application fixed.
export function bindPdfZoom(scroll,resize,{onPinch=()=>{}}={}){
 let scale=1,gesture=null;
 function set(value,cx=scroll.clientWidth/2,cy=scroll.clientHeight/2){const next=Math.max(1,Math.min(4,value)),ratio=next/scale,left=(scroll.scrollLeft+cx)*ratio-cx,top=(scroll.scrollTop+cy)*ratio-cy;scale=next;resize(scale);scroll.scrollLeft=left;scroll.scrollTop=top;}
 const pair=e=>{const [a,b]=e.touches,r=scroll.getBoundingClientRect();return {distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};};
 scroll.addEventListener('touchstart',e=>{if(e.touches.length===2){const p=pair(e);gesture={...p,scale};onPinch();e.preventDefault();}},{passive:false});
 scroll.addEventListener('touchmove',e=>{if(e.touches.length===2&&gesture){e.preventDefault();const p=pair(e);set(gesture.scale*p.distance/Math.max(1,gesture.distance),p.x,p.y);}},{passive:false});
 const end=e=>{if(e.touches.length<2)gesture=null;};scroll.addEventListener('touchend',end);scroll.addEventListener('touchcancel',end);
 scroll.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=scroll.getBoundingClientRect();set(scale*(e.deltaY<0?1.15:1/1.15),e.clientX-r.left,e.clientY-r.top);}},{passive:false});
 const toolbar=document.createElement('div');toolbar.className='pdf-toolbar';toolbar.innerHTML='<button type="button" class="mini" aria-label="Diminuir zoom">−</button><output>100%</output><button type="button" class="mini" aria-label="Aumentar zoom">+</button>';
 const update=resize;resize=s=>{update(s);toolbar.querySelector('output').textContent=Math.round(s*100)+'%';};toolbar.children[0].onclick=()=>set(scale-.25);toolbar.children[2].onclick=()=>set(scale+.25);scroll.before(toolbar);
 return {set,get scale(){return scale;}};
}
