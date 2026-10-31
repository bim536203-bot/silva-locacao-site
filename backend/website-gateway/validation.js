export class VerificationError extends Error {
  constructor(message, field='cnh') { super(message); this.name='VerificationError'; this.field=field; }
}
export const digits = value => String(value||'').replace(/\D/g,'');
export const normalizeName = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z\s]/g,' ').replace(/\s+/g,' ').trim();
export function normalizePhone(value) {
  let phone=digits(value); if(phone.length>=12&&phone.startsWith('55'))phone=phone.slice(2);
  if(phone.length===11&&phone[2]==='9')phone=phone.slice(0,2)+phone.slice(3);
  return phone;
}
export function checkContacts(data) {
  const customer=normalizePhone(data.phone),first=normalizePhone(data.relative_1_phone),second=normalizePhone(data.relative_2_phone);
  if(first&&first===customer)throw new VerificationError('Não é possível concluir o envio. Seu telefone é o mesmo número de seu parente.','relative_1_phone');
  if(second&&second===customer)throw new VerificationError('Não é possível concluir o envio. Seu telefone é o mesmo número de seu parente.','relative_2_phone');
  if(first&&first===second)throw new VerificationError('Informe um telefone diferente para o 2º parente. Este contato já foi usado no 1º parente.','relative_2_phone');
}
function validCpf(value) {
  const s=digits(value);if(s.length!==11||/^(\d)\1{10}$/.test(s))return false;
  for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=+s[i]*(n+1-i);if(((sum*10)%11)%10!==+s[n])return false;}return true;
}
const cpfPattern=/\b\d{3}\s*\.?\s*\d{3}\s*\.?\s*\d{3}\s*[-.]?\s*\d{2}\b/g;
function cpfs(text){return (text.match(cpfPattern)||[]).map(digits).filter(validCpf);}
function rows(items){const result=[];for(const item of items){let row=result.find(r=>Math.abs(r.y-item.y)<3);if(!row){row={y:item.y,items:[]};result.push(row);}row.items.push(item);}return result.sort((a,b)=>b.y-a.y).map(r=>({...r,text:r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')}));}
export function checkCnhItems(pages,fullName,cpf,birthDate) {
  const names=new Set(),documentCpfs=new Set(),birthDates=new Set();let hasCnh=false;
  for(const page of pages){
    const items=page.filter(i=>typeof i.str==='string'&&i.str.trim()&&i.transform).map(i=>({text:i.str.trim(),x:i.transform[4],y:i.transform[5],width:i.width||0}));
    const all=normalizeName(items.map(i=>i.text).join(' '));
    if(/CARTEIRA NACIONAL DE HABILITACAO|PERMISSAO PARA DIRIGIR|DRIVER LICENSE/.test(all))hasCnh=true;
    for(const label of items){
      const text=normalizeName(label.text);
      if(/\bDATA\b.*\bNASCIMENTO\b|DATE OF BIRTH|^NASCIMENTO$/.test(text)){
        const nearby=items.filter(i=>i!==label&&i.x>=label.x-10&&i.x<=label.x+260&&i.y<=label.y+3&&i.y>=label.y-55);
        const sources=[label.text,...rows(nearby).map(r=>r.text)];
        for(const source of sources){const match=source.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/);if(match){const iso=match[3]+'-'+match[2]+'-'+match[1];const date=new Date(iso+'T12:00:00Z');if(!isNaN(+date)&&date.toISOString().slice(0,10)===iso)birthDates.add(iso);break;}}
      }
      if(/\bCPF\b/.test(text)){
        const own=cpfs(label.text);const nearby=items.filter(i=>i!==label&&i.x>=label.x-10&&i.x<=label.x+220&&i.y<=label.y+3&&i.y>=label.y-55);
        const found=own.length?own:cpfs(rows(nearby).map(r=>r.text).join(' '));found.forEach(c=>documentCpfs.add(c));
      }
      if(!/\bNOME(?: E SOBRENOME)?\b|\bNAME AND SURNAME\b/.test(text)||/PAI|MAE|FILIACAO|SOCIAL/.test(text))continue;
      const inline=label.text.replace(/\/.*$/,'').replace(/^.*?(?:NOME(?:\s+E\s+SOBRENOME)?|NAME AND SURNAME)\s*[:\-]?\s*/i,'');
      if(normalizeName(inline).split(' ').length>=2&&normalizeName(inline)!==text){names.add(normalizeName(inline));continue;}
      const nearby=items.filter(i=>i!==label&&i.x>=label.x-10&&i.x<=label.x+350&&i.y<=label.y+3&&i.y>=label.y-50);
      const candidates=rows(nearby).filter(r=>!/[0-9]/.test(r.text)&&normalizeName(r.text).split(' ').length>=2&&!/^(?:DATA(?: DE)? NASCIMENTO|DATA LOCAL E UF DE NASCIMENTO|DATE OF BIRTH|NASCIMENTO|FILIACAO|NACIONALIDADE|HABILITACAO|SOBRENOME|DOC(?:UMENTO)?\b.*|IDENTIDADE\b.*|CPF|VALIDADE|PERMISSAO|CAT HAB|CATEGORIA)$/.test(normalizeName(r.text)));
      if(candidates.length)names.add(normalizeName(candidates[0].text));
    }
  }
  if(!hasCnh||names.size!==1||documentCpfs.size!==1||birthDates.size!==1)throw new VerificationError('Não foi possível ler com segurança o nome, o CPF e a data de nascimento da CNH. Envie o PDF digital original, legível e sem senha.');
  if(!documentCpfs.has(digits(cpf)))throw new VerificationError('Os seus dados preenchidos não estão de acordo com os dados da CNH enviada.','cpf');
  if(!names.has(normalizeName(fullName)))throw new VerificationError('Os seus dados preenchidos não estão de acordo com os dados da CNH enviada.','full_name');
  if(!birthDates.has(birthDate))throw new VerificationError('Os seus dados preenchidos não estão de acordo com os dados da CNH enviada.','birth_date');
  return {matched:true};
}
