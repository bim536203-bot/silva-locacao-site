# Cadastro

Site com publicação automática no Worker dark-dust-9300, branch main, arquivos em public/.

Conferência de cadastro: compara nome e CPF com campos textuais do titular da CNH digital, com unpdf 0.12.1 no servidor. PDFs sem leitura confiável ou divergentes são bloqueados. Isso não comprova autenticidade do documento. Não há comparação facial nem envio a serviços externos de IA.

Contatos de parentes: telefones distintos entre si e do cliente, normalizados para comparação. O mesmo CPF pode fazer solicitações diferentes.

Testados PDFs textuais antigo/novo, nome com acento, CPF/nome divergentes, filiação, ilegível, telefones repetidos e envio real com documentos sintéticos. Testes em aparelhos físicos não executados nesta alteração.

Aplicativos Silva Locação e Bipado de Rota são projetos separados.
