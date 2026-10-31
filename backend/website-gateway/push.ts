import webpush from 'npm:web-push@3.6.7';
export function validEndpoint(value:unknown){
 if(typeof value!=='string'||value.length>4096)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
export function validSubscription(s:any){try{return validEndpoint(s?.endpoint)&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth)&&atob(s.keys.p256dh.replace(/-/g,'+').replace(/_/g,'/'))[0].charCodeAt(0)===4;}catch{return false;}}
async function signingKeys(db:any){
 let r=await db.from('website_push_keys').select('public_key,private_key').eq('id',true).maybeSingle();if(r.error)throw new Error('Notificações indisponíveis.');
 if(!r.data){const pair=webpush.generateVAPIDKeys();await db.from('website_push_keys').insert({id:true,public_key:pair.publicKey,private_key:pair.privateKey});r=await db.from('website_push_keys').select('public_key,private_key').eq('id',true).single();}
 if(r.error||!r.data)throw new Error('Não foi possível configurar as notificações.');return r.data;
}
async function deliver(db:any,s:any,tag:string,test=false){
 if(!validSubscription(s))return {ok:false,gone:true};
 const pair=await signingKeys(db);
 const payload=JSON.stringify({title:test?'NOTIFICAÇÕES ATIVADAS':'NOVO CADASTRO RECEBIDO!',body:test?'Este aparelho está pronto para receber os avisos do Cadastro.':'Abra a Área ADM para conferir o novo cadastro.',tag,url:'/?adm=1'});
 try{const details=webpush.generateRequestDetails({endpoint:s.endpoint,keys:s.keys},payload,{vapidDetails:{subject:'https://dark-dust-9300.bim536203.workers.dev',publicKey:pair.public_key,privateKey:pair.private_key},TTL:86400,urgency:'high',contentEncoding:'aes128gcm'});
 const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:new Uint8Array(details.body),redirect:'error',signal:AbortSignal.timeout(8000)});await response.body?.cancel();return {ok:response.status===201||response.status===200||response.status===202,gone:response.status===404||response.status===410};}catch{return {ok:false,gone:false};}
}
export async function pushAction(db:any,admin:string,action:string,body:any){
 if(action==='push_config'){const pair=await signingKeys(db);return {publicKey:pair.public_key};}
 if(action==='push_subscribe'){
  const s=body.subscription;if(!validSubscription(s))throw new Error('Inscrição de notificações inválida.');
  const prior=await db.from('website_push_subscriptions').select('id,admin_id').eq('endpoint',s.endpoint).maybeSingle();
  if(prior.error)throw new Error('Não foi possível ativar as notificações.');
  if(prior.data&&prior.data.admin_id!==admin)throw new Error('Desative as notificações da outra conta neste aparelho primeiro.');
  const count=await db.from('website_push_subscriptions').select('id',{count:'exact',head:true}).eq('admin_id',admin);
  if(!prior.data&&(count.count||0)>=20)throw new Error('Limite de aparelhos atingido. Desative um aparelho antigo.');
  const r=await db.from('website_push_subscriptions').upsert({admin_id:admin,endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth},updated_at:new Date().toISOString()},{onConflict:'endpoint'});
  if(r.error)throw new Error('Não foi possível ativar as notificações.');return {ok:true};
 }
 if(action==='push_unsubscribe'){
  const r=await db.from('website_push_subscriptions').delete().eq('admin_id',admin).eq('endpoint',String(body.endpoint||''));if(r.error)throw new Error('Não foi possível desativar as notificações.');return {ok:true};
 }
 if(action==='push_test'){
  const quota=await db.rpc('website_rate_limit',{p_key:'website-push-test:'+admin,p_limit:5,p_seconds:60});if(quota.error||!quota.data)throw new Error('Aguarde um minuto antes de testar novamente.');
  const s=await db.from('website_push_subscriptions').select('*').eq('admin_id',admin).eq('endpoint',String(body.endpoint||'')).maybeSingle();if(s.error||!s.data)throw new Error('Ative as notificações neste aparelho primeiro.');
  const sent=await deliver(db,s.data,'cadastro-push-test',true);if(sent.gone)await db.from('website_push_subscriptions').delete().eq('id',s.data.id);if(!sent.ok)throw new Error('O serviço do aparelho não aceitou o teste. Reative as notificações e tente novamente.');return {ok:true};
 }
 throw new Error('Ação inválida.');
}
export async function dispatchPush(db:any){
 await signingKeys(db);
 const claim=await db.rpc('website_claim_push');if(claim.error)throw new Error('Fila indisponível.');const jobs=claim.data||[];
 for(let start=0;start<jobs.length;start+=5){await Promise.all(jobs.slice(start,start+5).map(async(job:any)=>{
  const member=await db.from('website_admin_users').select('user_id').eq('user_id',job.admin_id).maybeSingle();
  if(member.error)return;
  if(!member.data){await db.from('website_push_subscriptions').delete().eq('id',job.subscription_id);return;}
  const sent=await deliver(db,job,'cadastro-'+job.notification_id);
  if(sent.gone){await db.from('website_push_subscriptions').delete().eq('id',job.subscription_id);return;}
  const patch=sent.ok?{delivered_at:new Date().toISOString()}:{available_at:new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString()};
  await db.from('website_push_deliveries').update(patch).eq('id',job.job_id);
 }));}
 await db.from('website_push_deliveries').delete().lt('created_at',new Date(Date.now()-7*86400000).toISOString());
 return {ok:true,processed:jobs.length};
}
