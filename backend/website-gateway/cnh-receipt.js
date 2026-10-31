const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const fromHex=value=>Uint8Array.from(value.match(/../g)||[],v=>parseInt(v,16));
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function payload(bytes,data,expires){
 const hash=hex(await crypto.subtle.digest('SHA-256',bytes));
 return encoder.encode(JSON.stringify(['cnh-precheck-v1',expires,hash,data.full_name.trim(),data.cpf,data.birth_date]));
}
export async function issueReceipt(secret,bytes,data,now=Date.now()){
 const expires=now+15*60*1000;
 const signature=hex(await crypto.subtle.sign('HMAC',await key(secret),await payload(bytes,data,expires)));
 return {expires,signature};
}
export async function validReceipt(secret,bytes,data,receipt,now=Date.now()){
 if(!receipt||!Number.isSafeInteger(receipt.expires)||receipt.expires<=now||receipt.expires>now+15*60*1000||! /^[a-f0-9]{64}$/.test(receipt.signature||''))return false;
 return crypto.subtle.verify('HMAC',await key(secret),fromHex(receipt.signature),await payload(bytes,data,receipt.expires));
}
