// Photo gestures are isolated from the form so opening a photo never rebuilds inputs.
export function bindPhotoSwipe(element, move) {
 let start=null,swiped=false;
 element.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};swiped=false;});
 element.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){swiped=true;move(dx<0?1:-1);}});
 element.addEventListener('pointercancel',()=>{start=null;});
 element.addEventListener('click',e=>{if(swiped){e.preventDefault();e.stopImmediatePropagation();swiped=false;}},true);
 element.addEventListener('dragstart',e=>e.preventDefault());
}
export function installPageZoomGuard(){
 const prevent=e=>e.preventDefault();
 document.addEventListener('gesturestart',prevent,{passive:false});
 document.addEventListener('gesturechange',prevent,{passive:false});
 document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
 document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault();},{passive:false});
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault();});
}
export function openPhotoViewer({photos,index=0,onChange=()=>{},focusTarget}){
 if(!photos.length||document.getElementById('photo-viewer'))return;
 const root=document.createElement('div');root.id='photo-viewer';root.className='photo-viewer';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Foto da moto');
 root.innerHTML='<img class="fullscreen-bike-photo" alt="Foto ampliada da moto" draggable="false"><button type="button" class="photo-viewer-back" aria-label="Voltar ao cadastro">← Voltar</button>';
 const image=root.querySelector('img'),back=root.querySelector('button');let current=index,scale=1,x=0,y=0,base=null,multiGesture=false;const points=new Map();
 const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.append(root);history.pushState({photoViewer:true},'');
 const draw=()=>{const w=image.clientWidth||innerWidth,h=image.clientHeight||innerHeight;const ratio=image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:w/h;let iw=w,ih=w/ratio;if(ih>h){ih=h;iw=h*ratio;}const mx=Math.max(0,(iw*scale-w)/2),my=Math.max(0,(ih*scale-h)/2);x=Math.max(-mx,Math.min(mx,x));y=Math.max(-my,Math.min(my,y));image.style.transform=`translate(${x}px,${y}px) scale(${scale})`;};
 const show=()=>{scale=1;x=y=0;image.src=photos[current];draw();onChange(current);};
 const move=delta=>{current=(current+delta+photos.length)%photos.length;show();};
 const snapshot=()=>{const a=[...points.values()];if(a.length>=2){const cx=(a[0].x+a[1].x)/2-innerWidth/2,cy=(a[0].y+a[1].y)/2-innerHeight/2;return {distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),cx,cy,scale,x,y};}return a.length?{px:a[0].x,py:a[0].y,scale,x,y}:null;};
 image.addEventListener('load',draw);
 root.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();root.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size>1)multiGesture=true;base=snapshot();});
 root.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!base)return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...points.values()];if(a.length>=2&&base.distance){const distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);scale=Math.max(1,Math.min(5,base.scale*distance/Math.max(1,base.distance)));const cx=(a[0].x+a[1].x)/2-innerWidth/2,cy=(a[0].y+a[1].y)/2-innerHeight/2;x=cx-(base.cx-base.x)*scale/base.scale;y=cy-(base.cy-base.y)*scale/base.scale;draw();}else if(a.length===1&&scale>1){x=base.x+a[0].x-base.px;y=base.y+a[0].y-base.py;draw();}});
 const release=(e,cancel=false)=>{if(!points.has(e.pointerId))return;const wasSingle=points.size===1;if(!cancel&&!multiGesture&&wasSingle&&base&&base.scale===1&&scale===1&&'px' in base){const dx=e.clientX-base.px,dy=e.clientY-base.py;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)move(dx<0?1:-1);}points.delete(e.pointerId);if(!points.size)multiGesture=false;base=snapshot();};
 root.addEventListener('pointerup',e=>release(e));root.addEventListener('pointercancel',e=>release(e,true));
 root.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(1,Math.min(5,scale*(e.deltaY<0?1.15:1/1.15)));draw();},{passive:false});
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();history.back();}else if(e.key==='ArrowRight'&&scale===1)move(1);else if(e.key==='ArrowLeft'&&scale===1)move(-1);else if(e.key==='Tab'){e.preventDefault();back.focus();}};
 const pop=e=>{e.stopImmediatePropagation();root.remove();document.body.style.overflow=priorOverflow;window.removeEventListener('popstate',pop,true);document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',draw);focusTarget?.focus({preventScroll:true});};
 window.addEventListener('popstate',pop,true);document.addEventListener('keydown',onKey,true);window.addEventListener('resize',draw);back.onclick=()=>history.back();show();back.focus();
}
