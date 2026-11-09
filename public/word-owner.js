// Read only the embedded image beside the lessor signature label, never a shared fallback.
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const elements=(n,name)=>[...n.getElementsByTagNameNS('*',name)];
const text=n=>elements(n,'t').map(t=>t.textContent).join('');
const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export async function ownerSignatureFromWord(zip,parser=DOMParser){
 const doc=new parser().parseFromString(await zip.file('word/document.xml').async('string'),'application/xml');
 const paragraphs=elements(doc,'p').filter(p=>{for(let a=p.parentElement;a;a=a.parentElement)if(a.namespaceURI===W&&a.localName==='p')return false;return true;});
 const isLabel=p=>/ASSINATURA\s+D[OA]\s+(?:LOCADOR\b|PROPRIETARI[OA]\b)/.test(normalized(text(p)));
 const labels=paragraphs.map((p,i)=>isLabel(p)?i:-1).filter(i=>i>=0);
 if(!labels.length)throw Error('Não encontrei o campo de assinatura do locador no Word desta moto. Confira o modelo.');
 const relFile=zip.file('word/_rels/document.xml.rels');
 const rels=relFile?new parser().parseFromString(await relFile.async('string'),'application/xml'):null;
 function candidates(p){return [...elements(p,'blip'),...elements(p,'imagedata')].map(image=>{
  const id=image.getAttributeNS(R,'embed')||image.getAttributeNS(R,'id');let container=image.parentElement;
  while(container&&!['anchor','inline','shape'].includes(container.localName))container=container.parentElement;
  const extent=container&&elements(container,'extent')[0];const width=Number(extent?.getAttribute('cx'))/12700,height=Number(extent?.getAttribute('cy'))/12700;
  // Reject stamps and portrait images when considering adjacent floating anchors.
  return {id,width,height,image,container};
 }).filter(x=>x.id);}
 let found=[];
 for(const i of labels){const same=candidates(paragraphs[i]);if(same.length)found.push(...same);else for(const j of [i-1,i+1]){const p=paragraphs[j];if(p&&!text(p).trim())found.push(...candidates(p).filter(x=>x.width/x.height>2.5&&x.width<=260&&x.height<=90));}}
 found=[...new Map(found.map(x=>[x.id,x])).values()];
 if(!found.length)return null; // A blank Word signature must stay blank.
 if(found.length!==1)throw Error('Há mais de uma imagem junto à assinatura do locador. Deixe somente a assinatura correta nesse campo do Word.');
 const item=found[0],rel=rels&&elements(rels,'Relationship').find(r=>r.getAttribute('Id')===item.id);
 if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('A assinatura do locador precisa estar incorporada no Word.');
 const parts=['word'];for(const part of rel.getAttribute('Target').replace(/^\//,'').split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}
 const path=rel.getAttribute('Target').startsWith('/')?rel.getAttribute('Target').slice(1):parts.join('/'),file=zip.file(path);
 if(!file)throw Error('Imagem da assinatura do locador não encontrada no Word.');
 const bytes=await file.async('uint8array');
 if(!(bytes[0]===137&&bytes[1]===80)&&!(bytes[0]===255&&bytes[1]===216))throw Error('Use PNG ou JPG na assinatura do proprietário dentro do Word.');
 const crop=elements(item.container||item.image,'srcRect')[0];
 if(crop&&['l','t','r','b'].some(k=>Number(crop.getAttribute(k)))){
  const url=URL.createObjectURL(new Blob([bytes]));try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=bad;img.src=url;});const c=document.createElement('canvas'),get=k=>Number(crop.getAttribute(k)||0)/100000;const x=img.naturalWidth*get('l'),y=img.naturalHeight*get('t'),w=img.naturalWidth*(1-get('l')-get('r')),h=img.naturalHeight*(1-get('t')-get('b'));if(w<=0||h<=0)throw Error('Recorte da assinatura inválido no Word.');c.width=Math.round(w);c.height=Math.round(h);c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);return new Uint8Array(await (await new Promise(ok=>c.toBlob(ok,'image/png'))).arrayBuffer());}finally{URL.revokeObjectURL(url);}
 }
 return bytes;
}
