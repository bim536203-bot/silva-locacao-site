import { getDocumentProxy } from 'npm:unpdf@0.12.1';
import { checkCnhItems, VerificationError } from './validation.js';

export async function verifyCnh(bytes:Uint8Array,name:string,cpf:string){
  let pdf:any;
  try {
    pdf=await getDocumentProxy(new Uint8Array(bytes),{isEvalSupported:false,disableFontFace:true,useSystemFonts:false,disableAutoFetch:true,disableStream:true});
    if(pdf.numPages<1||pdf.numPages>3)throw new VerificationError('Envie somente o PDF digital da CNH, com até três páginas.');
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),content=await page.getTextContent();
      if(content.items.length>15000)throw new VerificationError('Não foi possível conferir este PDF. Envie o PDF digital original da CNH.');
      pages.push(content.items);
    }
    return checkCnhItems(pages,name,cpf);
  }catch(error){
    if(error instanceof VerificationError)throw error;
    throw new VerificationError('Não foi possível ler a CNH. Envie o PDF digital original, legível e sem senha.');
  }finally{if(pdf)await pdf.destroy();}
}
