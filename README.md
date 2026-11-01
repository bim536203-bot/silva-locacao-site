# Cadastro

Site com publicação automática no Worker dark-dust-9300, branch main, arquivos em public/.

Conferência de cadastro: compara nome e CPF com campos textuais do titular da CNH digital, com unpdf 0.12.1 no servidor. PDFs sem leitura confiável ou divergentes são bloqueados. Isso não comprova autenticidade do documento. Não há comparação facial nem envio a serviços externos de IA.

Contatos de parentes: telefones distintos entre si e do cliente, normalizados para comparação. O mesmo CPF pode fazer solicitações diferentes.

Testados PDFs textuais antigo/novo, nome com acento, CPF/nome divergentes, filiação, ilegível, telefones repetidos e envio real com documentos sintéticos. Testes em aparelhos físicos não executados nesta alteração.

Aplicativos Silva Locação e Bipado de Rota são projetos separados.

## Contratos V21

Na ADM, salve em cada moto o modelo Word compatível (.docx) e, opcionalmente, o documento do veículo (PDF/JPG/PNG), até 5 MB cada. Os anexos ficam no bucket privado website-motorcycle-documents, acessível somente aos administradores.

Em um cadastro, Gerar contrato PDF solicita número do contrato, início da locação e registro da CNH. Preenche os dados do cliente no modelo e junta foto, CNH e documento da moto. O PDF é preparado no navegador e pode ser visualizado e baixado; não assina nem aprova o cadastro. Confira veículo, valores e cláusulas do modelo antes de gerar. A paginação pode variar em relação ao Word.

Validação: preenchimento do modelo, escape de XML, campos obrigatórios, falha com limpeza dos novos uploads, acesso autenticado/anonimato e geração no navegador de seis páginas A4 com anexos sintéticos.
