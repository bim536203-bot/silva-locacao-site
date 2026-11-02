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

## Contratos V22

A conversão visual de Word foi substituída por preenchimento de uma base PDF fixa de quatro páginas, derivada da referência aprovada e mantida privadamente no banco. Bordas, linhas, cláusulas e posições estáticas permanecem no PDF original. Dados e imagens variáveis são inseridos em retângulos fixos; textos longos reduzem a fonte até 6 pt e são recusados se ainda não couberem.

A ADM importa um selo PNG/JPG por moto, no mesmo armazenamento privado dos anexos. Ao gerar, informa número, início, registro CNH e CEP. Placa, Renavam, chassi e cor são lidos do Word da moto; o ano é conferido contra a moto cadastrada. Modelo/ano e valores semanais/caução vêm do cadastro da moto. As cláusulas seguem o PDF aprovado (edições de cláusulas no Word não são aplicadas). O selo é reproduzido como enviado: confira se seu número corresponde ao número informado.

A foto fica na tabela, sem página separada; CNH e documento do veículo são anexados em seguida. Assinaturas de locatários anteriores e seus dados foram removidos da base. A assinatura do locador, já existente no modelo aprovado, permanece. Não cria assinatura do cliente.

Testes V22: geração real no navegador com dados fictícios, base de quatro páginas, CNH anexa, posição da foto, upload privado de selo e autorização da base (admin permitido, demais usuários e anônimos bloqueados). Nenhum aparelho físico foi testado.

## Contratos V23

A janela solicita somente número do contrato e data de início, em campos separados verticalmente. Registro CNH e CEP deixaram de ser exigidos e preenchidos; suas legendas foram ocultadas na base fixa sem alterar as bordas da tabela.

## Contratos V24

Tabela do locatário reorganizada conforme FERNANDO moto VERMELHA: nome completo em toda a linha; nascimento e CPF lado a lado; endereço em toda a linha; bairro e telefone lado a lado; parentes e e-mail nas três linhas seguintes. As proporções das colunas seguem a tabela do novo Word. Mantém o contorno e a área da foto da base aprovada. Não exige registro CNH nem CEP.

## V29 — assinatura pela galeria

Na ADM, os botões de assinar e gerar contrato são retangulares e ficam um abaixo do outro. Assinar contrato abre o seletor de imagens do aparelho, sem solicitar acesso à câmera. A prévia permite conferir a máscara de transparência e ajustar a remoção de fundo, preservando as cores dos traços. A imagem permanece em memória e só é aplicada ao PDF após confirmação. A posição na quarta página permanece fixa sobre a linha do locatário; não há editor de posição ou tamanho nesta versão.

## V30 — posição da assinatura
Assinar abre o seletor de imagem e prepara a prévia na quarta página, centrada na linha do locatário. Permite arrastar por toque/mouse, mover pelas setas e alterar o tamanho proporcionalmente por controle deslizante. Confirmar aplica as coordenadas em pontos do PDF ao arquivo completo, mantendo os anexos. Cancelar descarta a imagem. A prévia começa com a data atual de Boa Vista e mantém um campo para alterar a data de início; quando alterada, o contrato é atualizado antes da confirmação.

## V31
Ícone de copiar à direita de Assinar contrato copia somente o texto solicitado. PDFs baixados usam CONTRATO PrimeiroNome.pdf e CONTRATO PrimeiroNome assinado.pdf.
