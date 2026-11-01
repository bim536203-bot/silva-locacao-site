import { issueReceipt, validReceipt } from './cnh-receipt.js';
import { pushAction, dispatchPush } from './push.ts';
import { verifyCnh } from './cnh-reader.ts';
import { checkContacts, VerificationError } from './validation.js';
import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
const url=Deno.env.get('SUPABASE_URL')!, secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
const hkey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
async function signed(s:string){return hex(await crypto.subtle.sign('HMAC',hkey,encoder.encode(s)))}
function result(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}})}
function assert(ok:unknown,msg:string){if(!ok)throw new Error(msg)}
async function limit(key:string,n:number,seconds:number){const r=await db.rpc('website_rate_limit',{p_key:key,p_limit:n,p_seconds:seconds});assert(!r.error&&r.data,'Muitas tentativas. Aguarde e tente novamente.');}
function cpfValid(s:string){if(!/^\d{11}$/.test(s)||/^(\d)\1{10}$/.test(s))return false;for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=+s[i]*(n+1-i);if(((sum*10)%11)%10!==+s[n])return false}return true}
async function checkedFile(v:FormDataEntryValue|null,kind:string){assert(v instanceof File,'Anexe a CNH e a foto.');const f=v as File;assert(f.size>0&&f.size<=5242880,'Cada arquivo deve ter até 5 MB.');const bytes=new Uint8Array(await f.arrayBuffer());let mime='',ext='';if(kind==='cnh'){assert(f.type==='application/pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-','CNH deve ser PDF válido.');const text=new TextDecoder('latin1').decode(bytes);assert(text.includes('%%EOF')&&!/\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|Encrypt|RichMedia)\b/i.test(text),'Envie um PDF sem senha, anexos ou conteúdo ativo.');mime='application/pdf';ext='pdf';}else if(f.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217){mime='image/jpeg';ext='jpg';}else if(f.type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&new TextDecoder().decode(bytes.slice(12,16))==='IHDR'&&new TextDecoder().decode(bytes.slice(-8,-4))==='IEND'){mime='image/png';ext='png';}else throw new Error('Foto deve ser JPG ou PNG válido.');return {bytes,mime,ext,size:f.size};}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return result({error:'Método inválido'},405);
 try{
 const action=new URL(req.url).searchParams.get('action')||'submit';
 // Public submission: no customer account or anonymous Auth session is created.
 if(action==='challenge'){
 await limit('challenge:global',200,60);const id=crypto.randomUUID(),expires=Date.now()+300000;const text=`${id}:${expires}`;return result({id,expires,signature:await signed(text),difficulty:4});
 }
 if(action==='submit'||action==='precheck_cnh'){
 assert(Number(req.headers.get('content-length')||0)<=11000000,'Arquivos muito grandes.');
 const chunks:Uint8Array[]=[];let length=0;const reader=req.body?.getReader();assert(reader,'Envio vazio.');while(true){const next=await reader!.read();if(next.done)break;length+=next.value.length;if(length>11000000){await reader!.cancel();throw new Error('Arquivos muito grandes.')}chunks.push(next.value)}const form=await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();const id=String(form.get('challenge_id')||''),expires=Number(form.get('challenge_expires')),sig=String(form.get('challenge_signature')||''),proof=String(form.get('proof')||'');
 assert(/^[a-f0-9-]{36}$/.test(id)&&expires>Date.now()&&expires<Date.now()+301000&&/^[a-f0-9]{64}$/.test(sig)&&/^\d{1,10}$/.test(proof),'Verificação expirada. Tente novamente.');
 const sigBytes=Uint8Array.from(sig.match(/../g)!,x=>parseInt(x,16));
 assert(await crypto.subtle.verify('HMAC',hkey,sigBytes,encoder.encode(`${id}:${expires}`)),'Verificação inválida.');
 assert((await digest(`${id}:${expires}:${proof}`)).startsWith('0000'),'Verificação inválida.');
 const data={motorcycle_id:String(form.get('motorcycle_id')||''),full_name:String(form.get('full_name')||'').trim(),cpf:String(form.get('cpf')||'').replace(/\D/g,''),phone:String(form.get('phone')||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,''),birth_date:String(form.get('birth_date')||'')};
 if(action==='precheck_cnh'){
 assert(data.full_name.length>=5&&data.full_name.length<=150&&data.full_name.split(/\s+/).length>=2&&cpfValid(data.cpf),'Confira nome e CPF.');
 const birth=new Date(data.birth_date+'T12:00:00');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)&&!isNaN(+birth)&&birth.toISOString().slice(0,10)===data.birth_date,'Nascimento inválido.');
 await limit('precheck:global',60,60);
 const cnh=await checkedFile(form.get('cnh'),'cnh');
 await verifyCnh(cnh.bytes,data.full_name,data.cpf,data.birth_date);
 return result({receipt:await issueReceipt(secret,cnh.bytes,data)});
 }
 const extraKeys=['neighborhood','address','house_number','email','relative_1_name','relative_1_phone','relative_1_relation','relative_2_name','relative_2_phone','relative_2_relation'] as const;
 if(extraKeys.some(key=>form.has(key))){
 const extras=Object.fromEntries(extraKeys.map(key=>[key,String(form.get(key)||'').trim()]));
 if(form.has('neighborhood'))assert(extras.neighborhood.length>=2&&extras.neighborhood.length<=100,'Informe o bairro (de 2 a 100 caracteres).');assert(extras.address.length>=3&&extras.address.length<=200&&extras.house_number.length>=1&&extras.house_number.length<=20,'Informe endereço e número da casa.');assert(extras.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extras.email),'Informe um e-mail válido.');
 for(const n of [1,2]){
 const name=extras[`relative_${n}_name`],phone=extras[`relative_${n}_phone`].replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,''),relation=extras[`relative_${n}_relation`];
 if(name.length<2||name.length>150)throw new VerificationError('Informe o nome do '+n+'º parente.','relative_'+n+'_name');
 if(!/^\d{10,11}$/.test(phone))throw new VerificationError('Informe um telefone com DDD válido para o '+n+'º parente.','relative_'+n+'_phone');
 if(!['Pai','Mãe','Irmão','Irmã','Avô','Avó','Tio','Tia','Filho','Filha','Primo','Prima','Cunhado','Cunhada','Sogro','Sogra','Genro','Nora','Outro'].includes(relation))throw new VerificationError('Selecione o grau de parentesco do '+n+'º parente.','relative_'+n+'_relation');
 extras[`relative_${n}_phone`]=phone;
 }
 Object.assign(data,extras);
 checkContacts({...data,...extras});
 }
 assert(data.full_name.length>=5&&data.full_name.length<=150&&data.full_name.split(/\s+/).length>=2&&cpfValid(data.cpf)&&/^\d{10,11}$/.test(data.phone),'Confira nome, CPF e telefone.');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date),'Nascimento inválido.');
 const today=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Boa_Vista'}));const birth=new Date(data.birth_date+'T12:00:00');const age=today.getFullYear()-birth.getFullYear()-(today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())?1:0);
 assert(!isNaN(+birth)&&birth.toISOString().slice(0,10)===data.birth_date&&age>=18&&age<=120,'É necessário ter pelo menos 18 anos.');
 assert(form.get('privacy')==='true'&&form.get('requirements')==='true','Confirme os requisitos e o aviso de privacidade.');
 const previous=await db.from('website_applications').select('id').eq('id',id).maybeSingle();if(previous.data)return result({id});
 await limit('submit:burst:global',120,60);
 const bike=await db.from('website_motorcycles').select('id').eq('id',data.motorcycle_id).eq('available',true).maybeSingle();assert(bike.data,'Moto indisponível.');
 const cnh=await checkedFile(form.get('cnh'),'cnh'),face=await checkedFile(form.get('face'),'face');let receipt;try{receipt=JSON.parse(String(form.get('cnh_receipt')||'null'))}catch{}
 if(!await validReceipt(secret,cnh.bytes,data,receipt))await verifyCnh(cnh.bytes,data.full_name,data.cpf,data.birth_date);const paths=[`${id}/cnh.pdf`,`${id}/face.${face.ext}`];
 const reserve=await db.rpc('website_upload_session',{p_id:id,p_paths:paths});assert(!reserve.error,'Este envio já está sendo processado. Atualize e tente novamente.');
 const docs=[];let complete=false;
 try{
 const files=[[0,'cnh',cnh],[1,'face',face]] as const;
 const uploads=await Promise.allSettled(files.map(([i,,f])=>db.storage.from('website-application-documents').upload(paths[i],f.bytes,{contentType:f.mime,upsert:false})));
 assert(uploads.every(r=>r.status==='fulfilled'&&!r.value.error),'Falha ao armazenar documentos. Tente novamente.');
 for(const [i,kind,f] of files)docs.push({kind,path:paths[i],mime_type:f.mime,size_bytes:f.size});
 const r=await db.rpc('website_finalize',{p_id:id,p_data:data,p_docs:docs});assert(!r.error,'Não foi possível concluir o cadastro. Tente novamente.');complete=true;const sending=dispatchPush(db).catch(()=>console.warn('website_push_dispatch_failed'));const runtime=(globalThis as any).EdgeRuntime;if(runtime?.waitUntil)runtime.waitUntil(sending);else await sending;return result({id:r.data});
 }finally{if(!complete)await db.storage.from('website-application-documents').remove(paths);}
 }
 // All other actions require a real Auth user AND membership, rechecked server-side.
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');let adminId:string|null=null;
 if(action==='scheduled_clean'||action==='scheduled_push'){const valid=await db.rpc('website_maintenance_token_valid',{p_token:token});if(valid.error||!valid.data)return result({error:'Acesso negado'},401);}else{const user=await db.auth.getUser(token);if(user.error||!user.data.user)return result({error:'Acesso negado'},401);const admin=await db.from('website_admin_users').select('user_id').eq('user_id',user.data.user.id).maybeSingle();if(!admin.data)return result({error:'Acesso negado'},403);adminId=user.data.user.id;}
 const body=await req.json();
 if(action==='scheduled_push')return result(await dispatchPush(db));
 if(action.startsWith('push_')){if(!adminId)return result({error:'Acesso negado'},403);return result(await pushAction(db,adminId,action,body));}
 if(action==='document'){
 assert(['view','download'].includes(body.action),'Ação inválida.');
 const r=await db.from('website_application_documents').select('*').eq('id',body.document_id).single();assert(r.data&&!r.error,'Documento não encontrado.');
 const f=await db.storage.from('website-application-documents').download(r.data.path);assert(f.data&&!f.error,'Documento indisponível.');
 const log=await db.from('website_document_access_logs').insert({application_id:r.data.application_id,document_id:r.data.id,kind:r.data.kind,action:body.action==='view'?'Visualização':'Download',admin_id:adminId});assert(!log.error,'Não foi possível registrar o acesso.');
 return new Response(f.data,{headers:{...headers,'Content-Type':r.data.mime_type,'Content-Disposition':`${body.action==='download'?'attachment':'inline'}; filename="${r.data.kind}.${r.data.mime_type==='application/pdf'?'pdf':r.data.mime_type==='image/png'?'png':'jpg'}"`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }
 if(action==='housekeeping'||action==='scheduled_clean'){
 const stale=await db.rpc('website_stale_uploads');assert(!stale.error,'Limpeza indisponível.');
 for(const row of stale.data||[]){const removed=await db.storage.from('website-application-documents').remove(row.paths);if(!removed.error)await db.rpc('website_forget_upload',{p_id:row.id});}
 const archived=await db.from('website_applications').update({archived_at:new Date().toISOString()}).lt('deleted_at',new Date(Date.now()-7*86400000).toISOString()).is('archived_at',null);assert(!archived.error,'Arquivamento indisponível.');return result({ok:true});
 }
 return result({error:'Ação inválida'},404);
 }catch(e){return result({error:e instanceof Error?e.message:'Não foi possível concluir a operação.',field:e instanceof VerificationError?e.field:undefined},400)}
});
