// Mensagens geradas a partir dos dados persistidos do cadastro.
// Nenhum envio é feito automaticamente.
const digits = v => String(v ?? '').replace(/\D/g, '');
const relationArticles = {Pai:'o pai',Mãe:'a mãe',Irmão:'o irmão',Irmã:'a irmã',Avô:'o avô',Avó:'a avó',Tio:'o tio',Tia:'a tia',Filho:'o filho',Filha:'a filha',Primo:'o primo',Prima:'a prima',Cunhado:'o cunhado',Cunhada:'a cunhada',Sogro:'o sogro',Sogra:'a sogra',Genro:'o genro',Nora:'a nora'};
export function relativeMessage(application, n) {
  const name = String(application[`relative_${n}_name`] ?? '').trim();
  const relation = String(application[`relative_${n}_relation`] ?? '').trim();
  const customer = String(application.full_name ?? '').trim();
  const title = relationArticles[relation] || (relation ? `parente (${relation})` : 'parente');
  // Linguagem neutra quando não há informação explícita sobre gênero do cliente.
  return `Olá, você é ${title} ${name}, parente de ${customer}?\n\nÉ somente para confirmar, porque vamos alugar uma moto para essa pessoa e sempre pedimos o contato de dois parentes próximos.`;
}
export function relativeWhatsappUrl(application, n) {
  let phone = digits(application[`relative_${n}_phone`]);
  if (phone.length === 12 || phone.length === 13) {
    if (!phone.startsWith('55')) return null;
    phone = phone.slice(2);
  }
  if (!/^\d{2}(?:\d{8}|\d{9})$/.test(phone)) return null;
  return `https://wa.me/55${phone}?text=${encodeURIComponent(relativeMessage(application,n))}`;
}
