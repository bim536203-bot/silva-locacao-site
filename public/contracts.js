/* Private, admin-only document workflow. Customer documents never leave this browser and Supabase. */
const BUCKET='website-motorcycle-documents';
const DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const scripts=new Map();
async function script(src){if(!scripts.has(src))scripts.set(src,new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{scripts.delete(src);reject(new Error('Não foi possível carregar o gerador. Confira a internet e tente novamente.'))};document.head.appendChild(el)}));return scripts.get(src)}
async function libs(){await script('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');await script('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')}
export async function saveBikeAttachments(db,bike,inputs){
 const uploaded=[],patch={};
 try{for(const [kind,file] of inputs){if(!file)continue;if(file.size<1||file.size>5242880)throw new Error('Cada anexo deve ter até 5 MB.');let ext,mime;
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(kind==='contract_template_path'){
 if(!/\.docx$/i.test(file.name)||bytes[0]!==80||bytes[1]!==75)throw new Error('O modelo deve ser um arquivo Word .docx.');
 await script('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');const zip=await JSZip.loadAsync(bytes);if(!zip.file('word/document.xml'))throw new Error('Modelo Word inválido.');
 // Refuse active or external content. Prevent a template from fetching private/external resources.
 for(const n of Object.keys(zip.files)){if(/vbaProject|embeddings\//i.test(n))throw new Error('Use um Word sem macros ou objetos incorporados.');if(n.endsWith('.rels')&&/TargetMode\s*=\s*["']External["']/i.test(await zip.file(n).async('string')))throw new Error('Remova links e imagens externas do modelo Word antes de anexar.');}
 ext='docx';mime=DOCX;
 }else if(kind==='contract_seal_path'){if(bytes[0]===255&&bytes[1]===216){ext='jpg';mime='image/jpeg';}else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){ext='png';mime='image/png';}else throw new Error('O selo deve ser uma imagem PNG ou JPG.');}else if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){ext='pdf';mime='application/pdf';}else if(bytes[0]===255&&bytes[1]===216){ext='jpg';mime='image/jpeg';}else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){ext='png';mime='image/png';}else throw new Error('O documento da moto deve ser PDF, JPG ou PNG.');
 const path=`${bike.id}/${crypto.randomUUID()}.${ext}`;const r=await db.storage.from(BUCKET).upload(path,bytes,{contentType:mime,upsert:false});if(r.error)throw new Error('Não foi possível salvar o anexo: '+r.error.message);uploaded.push(path);patch[kind]=path;
 }
 if(uploaded.length){const r=await db.from('website_motorcycles').update(patch).eq('id',bike.id);if(r.error)throw r.error;Object.assign(bike,patch);}return patch;
 }catch(e){if(uploaded.length)await db.storage.from(BUCKET).remove(uploaded);throw e;}
}
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
export function fillTemplateXml(xml,a,details,parser=DOMParser,serializer=XMLSerializer){
 const doc=new parser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Modelo Word inválido.');
 const birth=/^\d{4}-\d{2}-\d{2}$/.test(a.birth_date||'')?a.birth_date.split('-').reverse().join('/'):(a.birth_date||'');
 const values=[['NOME COMPLETO:',a.full_name],['CPF:',a.cpf],['DATA DE NASCIMENTO:',birth],['ENDEREÇO:',[a.address,a.house_number&&'nº '+a.house_number].filter(Boolean).join(', ')],['BAIRRO:',a.neighborhood],['CONTATO PRINCIPAL:',a.phone],['CONTATO PARENTE PRÓXIMO 01:',[a.relative_1_name,a.relative_1_phone,a.relative_1_relation].filter(Boolean).join(' — ')],['CONTATO PARENTE PRÓXIMO 02:',[a.relative_2_name,a.relative_2_phone,a.relative_2_relation].filter(Boolean).join(' — ')],['E-MAIL:',a.email]];
 const cells=[...doc.getElementsByTagNameNS(W,'tc')];let matched=0;
 for(const cell of cells){const text=[...cell.getElementsByTagNameNS(W,'t')].map(x=>x.textContent).join('');const pair=values.find(([label])=>normalize(text).startsWith(normalize(label)));if(!pair)continue;
 const [label,value]=pair;if(!value&&label!=='NÚMERO DO REGISTRO DA CNH:')throw new Error('Complete o campo '+label+' no cadastro antes de gerar o contrato.');
 const paragraphs=[...cell.childNodes].filter(x=>x.localName==='p');const originalRun=cell.getElementsByTagNameNS(W,'rPr')[0];for(const p of paragraphs)cell.removeChild(p);
 for(const line of [label,String(value||'')]){const p=doc.createElementNS(W,'w:p'),r=doc.createElementNS(W,'w:r'),t=doc.createElementNS(W,'w:t');if(originalRun)r.appendChild(originalRun.cloneNode(true));t.textContent=line;r.appendChild(t);p.appendChild(r);cell.appendChild(p);}matched++;
 }
 if(matched<9)throw new Error('Este modelo não contém os campos esperados. Use o modelo Word enviado para o Cadastro.');
 for(const p of [...doc.getElementsByTagNameNS(W,'p')]){const ts=[...p.getElementsByTagNameNS(W,'t')];const text=ts.map(x=>x.textContent).join('');let value=null;if(/^\s*CONTRATO N[º°]/i.test(text))value='CONTRATO Nº '+details.number;if(/Data de início da locação:/i.test(text))value='Data de início da locação: '+details.startDate.split('-').reverse().join('/');if(value!==null&&ts.length){ts[0].textContent=value;for(const t of ts.slice(1))t.textContent='';}}
 return new serializer().serializeToString(doc);
}
async function download(db,path){const r=await db.storage.from(BUCKET).download(path);if(r.error||!r.data)throw new Error('Anexo da moto indisponível. Confira os arquivos salvos na moto.');return r.data}
async function appendPdfOrImage(pdf,blob){const bytes=new Uint8Array(await blob.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){const src=await PDFLib.PDFDocument.load(bytes);if(src.getPageCount()>30)throw new Error('Documento com páginas demais. Use até 30 páginas por anexo.');const pages=await pdf.copyPages(src,src.getPageIndices());pages.forEach(p=>pdf.addPage(p));}else{const image=bytes[0]===137?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const p=pdf.addPage([595.28,841.89]);const fit=image.scaleToFit(535,760);p.drawImage(image,{x:(595.28-fit.width)/2,y:(841.89-fit.height)/2,width:fit.width,height:fit.height});}}
// Coordinates use the approved PDF's original top-left coordinate system (points).
export function vehicleFromWord(xml,parser=DOMParser){
 const doc=new parser().parseFromString(xml,'application/xml');
 const cells=[...doc.getElementsByTagNameNS(W,'tc')];const out={};
 for(const c of cells){const text=[...c.getElementsByTagNameNS(W,'t')].map(x=>x.textContent).join('');const m=text.match(/^\s*(MODELO D[O]? VEÍCULO|ANO|COR|PLACA|RENAVAM|CHASSI)\s*:\s*(.+)/i);if(m)out[normalize(m[1])]=m[2].trim();}
 for(const k of ['PLACA','RENAVAM','CHASSI','COR'])if(!out[k])throw new Error('Complete '+k+' no modelo Word da moto.');return out;
}
const cleanText=s=>String(s??'').normalize('NFC').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
export async function fillFixedLayout(pdf,{bike,application:a,details,vehicle,faceBytes,sealBytes,bikeBytes}){
 const font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica),bold=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold),serif=await pdf.embedFont(PDFLib.StandardFonts.TimesRoman);
 if(pdf.getPageCount()!==4)throw new Error('Base do contrato inválida.');
 const pages=pdf.getPages();for(const p of pages)p.pushOperators(PDFLib.beginText(),PDFLib.setCharacterSpacing(0),PDFLib.setWordSpacing(0),PDFLib.setCharacterSqueeze(100),PDFLib.setTextRise(0),PDFLib.endText());
 function line(page,text,x,top,width,size=10,f=font,color=PDFLib.rgb(0,0,0)){text=cleanText(text);try{while(f.widthOfTextAtSize(text,size)>width&&size>6)size-=.1;if(f.widthOfTextAtSize(text,size)>width)throw Error();page.drawText(text,{x,y:page.getHeight()-top-size,font:f,size,color});}catch{throw new Error('Um dos campos é longo demais ou contém caracteres incompatíveis. Revise os dados antes de gerar.');}}
 const imageCache=new Map();
 async function picture(page,bytes,box){if(!imageCache.has(bytes))imageCache.set(bytes,bytes[0]===137?await pdf.embedPng(bytes):await pdf.embedJpg(bytes));const image=imageCache.get(bytes);const [x,top,w,h]=box,fit=image.scaleToFit(w,h);page.drawImage(image,{x:x+(w-fit.width)/2,y:page.getHeight()-top-h+(h-fit.height)/2,width:fit.width,height:fit.height});}
 // Original stamp rectangles and header positions are preserved on each contract page.
 const stamps=[[429.22,723.77,145.21,73.1],[430.27,724.72,145.21,73.1],[429.02,539.67,145.21,73.1],[429.52,667.27,145.21,73.1]];
 for(let i=0;i<4;i++){
  const [originalX,top,originalSize]=[[482.62,37.77,9],[471.7,29.28,11.04],[470.26,30.72,11.04],[471.82,31.08,11.04]][i];
  const title='CONTRATO Nº '+cleanText(details.number);let size=originalSize;
  while(font.widthOfTextAtSize(title,size)>164&&size>6)size-=.1;
  const width=font.widthOfTextAtSize(title,size);if(width>164)throw new Error('O número do contrato é longo demais.');
  const x=Math.min(originalX,568-width),left=x-3;
  pages[i].drawRectangle({x:left,y:pages[i].getHeight()-top-originalSize-4,width:571-left,height:originalSize+6,color:PDFLib.rgb(1,1,0)});
  line(pages[i],title,x,top,164,size,font);
  await picture(pages[i],sealBytes,stamps[i]);
 }
 const p=pages[1];
 line(p,bike.model,61.1,126.9,135);line(p,String(bike.year),203.2,126.9,48);
 line(p,vehicle.COR,61.1,164,73);line(p,vehicle.PLACA,143.1,164,100);
 line(p,vehicle.RENAVAM,61.1,207.5,185);line(p,vehicle.CHASSI,61.1,247.3,185);
 await picture(p,bikeBytes,[259,112,277,194]);
 const cpf=String(a.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
 const birth=a.birth_date.split('-').reverse().join('/');
 // Client grid follows the updated Word: merged name/address rows, CPF beside birth,
 // neighborhood beside phone. Keep the approved outer table and portrait positions.
 const left=36.72,right=369.2,top=407.13,bottom=649.78;
 p.drawRectangle({x:left-.5,y:p.getHeight()-bottom-.5,width:right-left+1,height:bottom-top+1,color:PDFLib.rgb(1,1,1)});
 const rows=[
  [['NOME COMPLETO:',a.full_name,1]],
  [['DATA DE NASCIMENTO:',birth,3397/6668],['CPF:',cpf,3271/6668]],
  [['ENDEREÇO:',[a.address,a.house_number].filter(Boolean).join(', '),1]],
  [['BAIRRO:',a.neighborhood,3114/6668],['CONTATO PRINCIPAL:',a.phone,3554/6668]],
  [['CONTATO PARENTE PRÓXIMO 01:',`(${a.relative_1_relation} – ${a.relative_1_name})  ${a.relative_1_phone}`,1]],
  [['CONTATO PARENTE PRÓXIMO 02:',`(${a.relative_2_relation} – ${a.relative_2_name})  ${a.relative_2_phone}`,1]],
  [['E-MAIL:',a.email,1]]
 ];
 const weights=[27.85,34.05,37.35,34.95,28,29.2,27.5],total=weights.reduce((a,b)=>a+b,0);
 const rule=(x1,y1,x2,y2)=>p.drawLine({start:{x:x1,y:p.getHeight()-y1},end:{x:x2,y:p.getHeight()-y2},thickness:.5,color:PDFLib.rgb(0,0,0)});
 let y=top;rule(left,top,right,top);rule(left,top,left,bottom);rule(right,top,right,bottom);
 rows.forEach((cells,i)=>{const height=weights[i]/total*(bottom-top);let x=left;
  cells.forEach(([label,value,fraction],j)=>{const width=fraction*(right-left);if(j)rule(x,y,x,y+height);line(p,label,x+3.5,y+3,width-7,10,bold);line(p,value,x+3.5,y+17,width-7,10);x+=width;});
  y+=height;rule(left,y,right,y);
 });
 await picture(p,faceBytes,[379.89,425.4,148.8,198.4]);
 // Keep the signature line at the approved location; never carry a prior tenant's signature.
 line(pages[3],'Assinatura do locatário '+a.full_name+':',37.7,581.8,190,8,serif);
 pages[3].drawLine({start:{x:230,y:pages[3].getHeight()-591},end:{x:407,y:pages[3].getHeight()-591},thickness:.5,color:PDFLib.rgb(0,0,0)});
 const d=new Date(details.startDate+'T12:00:00Z');const date=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Boa_Vista'}).format(d);
 line(pages[3],'Data de início da locação:',54,781.4,138,11,serif,PDFLib.rgb(1,1,1));line(pages[3],date,192.17,781.4,188,11,serif,PDFLib.rgb(1,1,0));
 const money=n=>'R$'+Number(n).toFixed(2).replace('.',',');
 for(const [key,x,top] of [['weekly_price',228.18,192.26],['deposit',420.16,105.98],['deposit',196.75,213.74]])line(pages[3],money(bike[key]),x,top,42.1,10,serif);
}
export async function generateContract({db,bike,application,docs,gateway,details}){
 if(!bike?.contract_template_path)throw new Error('Anexe e salve o modelo Word nesta moto primeiro.');
 if(!bike.contract_seal_path)throw new Error('Importe e salve a imagem do selo no cadastro desta moto.');
 if(!bike.photos?.length)throw new Error('Cadastre uma foto desta moto.');
 if(!details.number?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(details.startDate))throw new Error('Informe o número do contrato e a data de início.');
 for(const key of ['full_name','cpf','birth_date','phone','email','address','house_number','neighborhood','relative_1_name','relative_1_phone','relative_1_relation','relative_2_name','relative_2_phone','relative_2_relation'])if(!application[key])throw new Error('Complete os dados do cliente antes de gerar o contrato.');
 await libs();
 const [template,seal,layout]=await Promise.all([download(db,bike.contract_template_path),download(db,bike.contract_seal_path),db.rpc('website_contract_layout')]);
 if(layout.error||!layout.data)throw new Error('Modelo de contrato indisponível. Entre novamente na ADM.');
 const zip=await JSZip.loadAsync(template);const vehicle=vehicleFromWord(await zip.file('word/document.xml').async('string'));
 if(String(vehicle.ANO)!==String(bike.year))throw new Error('O ano no Word é diferente do ano desta moto. Atualize o modelo Word antes de gerar.');
 const photo=await db.storage.from('website-motorcycle-photos').download(bike.photos[0]);if(photo.error||!photo.data)throw new Error('Foto da moto indisponível.');
 const face=docs.find(x=>x.kind==='face'),cnh=docs.find(x=>x.kind==='cnh');if(!face||!cnh)throw new Error('Falta a foto ou a CNH do cliente.');
 const [faceResponse,cnhResponse]=await Promise.all([gateway('document',{document_id:face.id,action:'view'},true),gateway('document',{document_id:cnh.id,action:'view'},true)]);
 const pdf=await PDFLib.PDFDocument.load(Uint8Array.from(atob(layout.data),c=>c.charCodeAt(0)));
 await fillFixedLayout(pdf,{bike,application,details,vehicle,faceBytes:new Uint8Array(await faceResponse.arrayBuffer()),sealBytes:new Uint8Array(await seal.arrayBuffer()),bikeBytes:new Uint8Array(await photo.data.arrayBuffer())});
 await appendPdfOrImage(pdf,await cnhResponse.blob());if(bike.vehicle_document_path)await appendPdfOrImage(pdf,await download(db,bike.vehicle_document_path));
 return new Blob([await pdf.save()],{type:'application/pdf'});
}
