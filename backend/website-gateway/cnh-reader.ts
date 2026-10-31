import { getDocumentProxy } from 'npm:unpdf@0.12.1';
import { checkCnhItems, VerificationError } from './validation.js';

const unreadable='Não foi possível ler com segurança o nome, o CPF e a data de nascimento da CNH. Envie o PDF digital original, legível e sem senha.';

// Convert the provider's top-left pixel coordinates into PDF-like points.
// Preserve each line's words separately, so columns are not merged.
export function ocrPages(payload:any,expectedPages:number){
  if(payload?.IsErroredOnProcessing||payload?.OCRExitCode!==1||!Array.isArray(payload.ParsedResults)||payload.ParsedResults.length!==expectedPages)throw new VerificationError('A leitura da CNH não foi concluída. Tente novamente em instantes.');
  return payload.ParsedResults.map((page:any)=>{
    if(page.FileParseExitCode!==1||!Array.isArray(page.TextOverlay?.Lines))throw new VerificationError(unreadable);
    const words=page.TextOverlay.Lines.flatMap((line:any)=>Array.isArray(line.Words)?line.Words:[]);
    if(!words.length||words.length>15000)throw new VerificationError(unreadable);
    const heights=words.map((w:any)=>Number(w.Height)).filter((h:number)=>Number.isFinite(h)&&h>0).sort((a:number,b:number)=>a-b);
    if(!heights.length)throw new VerificationError(unreadable);
    const scale=10/heights[Math.floor(heights.length/2)];
return page.TextOverlay.Lines.flatMap((line:any)=>{
      const blocks:any[]=[];
      for(const w of [...line.Words].sort((a:any,b:any)=>a.Left-b.Left)){
        const x=Number(w.Left),y=Number(w.Top),width=Number(w.Width),height=Number(w.Height);
        if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||typeof w.WordText!=='string'||w.WordText.length>500)throw new VerificationError(unreadable);
        const last=blocks[blocks.length-1];
        if(last&&x-last.right<=4*height&&Math.abs(y-last.top)<=height/2){last.str+=' '+w.WordText;last.right=x+width;last.width=(last.right-last.left)*scale;}
        else blocks.push({str:w.WordText,transform:[1,0,0,1,x*scale,-y*scale],width:width*scale,left:x,right:x+width,top:y});
      }
      return blocks;
    });
  });
}
export async function readImagePdf(bytes:Uint8Array,expectedPages:number){
  const key=Deno.env.get('OCR_SPACE_API_KEY');
  if(!key)throw new VerificationError('A leitura de CNH em imagem está temporariamente indisponível. Tente novamente mais tarde.');
  // Free OCR.space account: do not silently upgrade or change the original stored file.
  if(bytes.length>1000000)throw new VerificationError('Para conferir uma CNH com dados em imagem, o PDF deve ter até 1 MB. O serviço gratuito de leitura não aceita arquivos maiores.');
  const form=new FormData();
  form.append('file',new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),'cnh.pdf');
  form.append('filetype','PDF');form.append('language','por');form.append('OCREngine','2');
  form.append('isOverlayRequired','true');form.append('detectOrientation','true');
  form.append('scale','true');form.append('isCreateSearchablePdf','false');
  let response:Response;
  try{response=await fetch('https://api.ocr.space/parse/image',{method:'POST',headers:{apikey:key},body:form,signal:AbortSignal.timeout(60000),redirect:'error'});}
  catch{throw new VerificationError('O serviço de leitura da CNH não respondeu. Tente novamente em instantes.');}
  if(!response.ok)throw new VerificationError('O serviço de leitura da CNH está temporariamente indisponível. Tente novamente em instantes.');
  const reader=response.body?.getReader();if(!reader)throw new VerificationError(unreadable);
  let length=0;const chunks:Uint8Array[]=[];
  try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>2000000){await reader.cancel();throw new VerificationError(unreadable);}chunks.push(next.value);}}
  catch{throw new VerificationError('A leitura da CNH não foi concluída. Tente novamente em instantes.');}
  let payload:any;try{payload=JSON.parse(await new Blob(chunks).text());}catch{throw new VerificationError(unreadable);}
  return ocrPages(payload,expectedPages);
}
export async function verifyCnh(bytes:Uint8Array,name:string,cpf:string,birthDate:string){
  let pdf:any;const pages:any[]=[];let pageCount=0;
  try{
    pdf=await getDocumentProxy(new Uint8Array(bytes),{isEvalSupported:false,disableFontFace:true,useSystemFonts:false,disableAutoFetch:true,disableStream:true});
    pageCount=pdf.numPages;
    if(pageCount<1||pageCount>3)throw new VerificationError('Envie somente o PDF digital da CNH, com até três páginas.');
    for(let n=1;n<=pageCount;n++){
      const page=await pdf.getPage(n),content=await page.getTextContent();
      if(content.items.length>15000)throw new VerificationError(unreadable);
      pages.push(content.items);
    }
  }catch(error){
    if(error instanceof VerificationError)throw error;
    throw new VerificationError('Não foi possível ler a CNH. Envie o PDF digital original, legível e sem senha.');
  }finally{if(pdf)await pdf.destroy();}
  try{return checkCnhItems(pages,name,cpf,birthDate);}
  catch(error){
    // A proven text mismatch must not be overridden by OCR.
    if(!(error instanceof VerificationError)||error.field!=='cnh')throw error;
  }
  const imagePages=await readImagePdf(bytes,pageCount);
  return checkCnhItems(imagePages,name,cpf,birthDate);
}
