/* Private, admin-only document workflow. Customer documents never leave this browser and Supabase. */
const BUCKET='website-motorcycle-documents';
const DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const scripts=new Map();
async function script(src){if(!scripts.has(src))scripts.set(src,new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{scripts.delete(src);reject(new Error('Não foi possível carregar o gerador. Confira a internet e tente novamente.'))};document.head.appendChild(el)}));return scripts.get(src)}
async function libs(){await script('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');await script('https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js');await script('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');await script('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')}
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
 }else if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){ext='pdf';mime='application/pdf';}else if(bytes[0]===255&&bytes[1]===216){ext='jpg';mime='image/jpeg';}else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){ext='png';mime='image/png';}else throw new Error('O documento da moto deve ser PDF, JPG ou PNG.');
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
 const values=[['NOME COMPLETO:',a.full_name],['CPF:',a.cpf],['DATA DE NASCIMENTO:',birth],['NÚMERO DO REGISTRO DA CNH:',details.cnhRegistration||''],['ENDEREÇO:',[a.address,a.house_number&&'nº '+a.house_number].filter(Boolean).join(', ')],['BAIRRO:',a.neighborhood],['CONTATO PRINCIPAL:',a.phone],['CONTATO PARENTE PRÓXIMO 01:',[a.relative_1_name,a.relative_1_phone,a.relative_1_relation].filter(Boolean).join(' — ')],['CONTATO PARENTE PRÓXIMO 02:',[a.relative_2_name,a.relative_2_phone,a.relative_2_relation].filter(Boolean).join(' — ')],['E-MAIL:',a.email]];
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
export async function generateContract({db,bike,application,docs,gateway,details}){
 if(!bike?.contract_template_path)throw new Error('Anexe e salve o modelo Word nesta moto primeiro.');
 if(!details.number?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(details.startDate))throw new Error('Informe o número do contrato e a data de início.');
 await libs();const template=await download(db,bike.contract_template_path),zip=await JSZip.loadAsync(template);
 zip.file('word/document.xml',fillTemplateXml(await zip.file('word/document.xml').async('string'),application,details));
 const filled=await zip.generateAsync({type:'blob',mimeType:DOCX});
 const host=document.createElement('div');host.style.cssText='position:absolute;left:-12000px;top:0;width:1000px;background:white;pointer-events:none';document.body.appendChild(host);
 try{
 const styles=document.createElement('div');const appendStyle=styles.appendChild.bind(styles);styles.appendChild=node=>{if(node.nodeName==='STYLE')node.setAttribute('nonce','cadastro-docx-v21');return appendStyle(node)};
 await docx.renderAsync(filled,host,styles,{inWrapper:true,ignoreWidth:false,ignoreHeight:false,breakPages:true,ignoreLastRenderedPageBreak:false,useBase64URL:true});host.prepend(styles);await document.fonts.ready;
 await Promise.all([...host.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Imagem do Word não pôde ser carregada.'))})));
 const pages=[...host.querySelectorAll('section.docx')];if(!pages.length||pages.length>30)throw new Error('Não foi possível paginar o modelo Word.');
 const pdf=await PDFLib.PDFDocument.create();
 for(const page of pages){const canvas=await html2canvas(page,{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:false});const image=await pdf.embedPng(canvas.toDataURL('image/png'));const width=parseFloat(getComputedStyle(page).width)*.75,height=parseFloat(getComputedStyle(page).minHeight)*.75;if(!width||!height)throw new Error('Tamanho de página do modelo inválido.');const fit=image.scaleToFit(width,height);pdf.addPage([width,height]).drawImage(image,{x:(width-fit.width)/2,y:(height-fit.height)/2,width:fit.width,height:fit.height});canvas.width=1;canvas.height=1;}
 for(const kind of ['face','cnh']){const d=docs.find(x=>x.kind===kind);if(!d)throw new Error('Falta '+(kind==='face'?'a foto do cliente.':'a CNH do cliente.'));const r=await gateway('document',{document_id:d.id,action:'view'},true);await appendPdfOrImage(pdf,await r.blob());}
 if(bike.vehicle_document_path)await appendPdfOrImage(pdf,await download(db,bike.vehicle_document_path));
 return new Blob([await pdf.save()],{type:'application/pdf'});
 }finally{host.remove();}
}
