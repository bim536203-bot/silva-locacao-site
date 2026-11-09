// Native touch scrolling keeps the next photo attached to the finger.
export function bindSlidingGallery(image,photos,onChange){
 const host=image.parentElement;host.classList.add('sliding-gallery');let current=0,start=null,suppress=false,timer;
 const images=photos.map((src,i)=>{const el=i?image.cloneNode(false):image;if(i)el.removeAttribute('id');el.src=src;el.draggable=false;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`Abrir foto ${i+1} da moto em tela cheia`);if(i)host.append(el);return el;});
 const select=()=>{const i=Math.max(0,Math.min(photos.length-1,Math.round(host.scrollLeft/(host.clientWidth||1))));if(i!==current){current=i;onChange(i);}};
 host.addEventListener('scroll',()=>{select();clearTimeout(timer);timer=setTimeout(select,120);},{passive:true});
 host.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};suppress=false;});
 host.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)suppress=true;});
 host.addEventListener('pointerup',()=>{start=null;});host.addEventListener('pointercancel',()=>{start=null;suppress=true;});
 host.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
 host.addEventListener('dragstart',e=>e.preventDefault());
 const show=(i,smooth=true)=>{current=(i+photos.length)%photos.length;host.scrollTo({left:current*host.clientWidth,behavior:smooth?'smooth':'instant'});onChange(current);};
 const observer=new ResizeObserver(()=>show(current,false));observer.observe(host);
 // Disconnect after the modal is removed, so reopening does not retain old photos.
 const cleanup=new MutationObserver(()=>{if(!host.isConnected){observer.disconnect();cleanup.disconnect();clearTimeout(timer);}});cleanup.observe(document.body,{childList:true,subtree:true});
 return {images,show,move:delta=>show(current+delta),get current(){return current;}};
}
