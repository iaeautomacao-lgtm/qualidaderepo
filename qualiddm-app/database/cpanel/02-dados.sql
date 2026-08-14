-- ===========================================================================
-- QualiDDM — DADOS (parte 2 de 2)
--
-- Execute DEPOIS de `01-estrutura.sql`, no mesmo banco.
--
-- IMPORTANTE — use a aba SQL (colar e executar), NÃO a aba Import.
-- O importador do phpMyAdmin quebra arquivos grandes em blocos, e as variáveis
-- de sessão (`@form`, `@s_abertura`...) se perdem entre um bloco e outro. O
-- comando seguinte então casa com nada e grava ZERO linhas — sem reportar erro.
-- Foi exatamente o que aconteceu no primeiro import: 23 comandos "executados",
-- avaliação e respostas vazias.
--
-- Os comandos da avaliação já foram reescritos com JOIN e não dependem mais de
-- variável. Os das seções e critérios ainda dependem, por isso o aviso.
--
-- Origem dos dados: transcrição dos 41 prints do QualiTalk (pasta PRINTS/).
-- Nomes de clientes, campanhas, monitores, critérios e enunciados são REAIS,
-- copiados literalmente.
--
-- O QUE NÃO É REAL, e você precisa corrigir depois:
--   - E-mails marcados com [gerado]: os prints só mostravam 3 e-mails. Os
--     demais foram derivados do nome para o sistema funcionar. Substitua pela
--     exportação do RH antes de qualquer uso real.
--   - Senha de todos os usuários: a mesma senha inicial (ver no fim do arquivo).
--   - Peso de 2 critérios estava ilegível no print e entrou como 0.00.
--     Procure por "PESO PENDENTE" abaixo e corrija com o valor correto.
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Usuários
--
-- Todos nascem com a mesma senha inicial (hash PBKDF2-SHA256, 210 mil
-- iterações). Cada pessoa deve trocar no primeiro acesso.
-- ---------------------------------------------------------------------------

INSERT INTO users (name, email, password_hash, role) VALUES
-- Administradora — e-mail real do print
('Gisele Oliveira', 'gisele.oliveira@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'administrador'),

-- Supervisor — e-mail real do print
('Fábio Batista Oliveira', 'fabiobatista@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'supervisor'),

-- Monitores (os 5 do filtro "Avaliador"). Só o de Fernanda é real.
('Fernanda Alves', 'fernandaferreira@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'monitor'),
('Dayara Jovita', 'dayara.jovita@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'monitor'),               -- [gerado]
('Denise Esquivel', 'denise.esquivel@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'monitor'),           -- [gerado]
('Raphael Outstand', 'raphael.outstand@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'monitor'),         -- [gerado]
('Roberta Bruna Pereira Diniz', 'roberta.diniz@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'monitor'), -- [gerado]

-- Operadores avaliados. Camilly tem e-mail real (aparece na ficha do print);
-- os demais são [gerado]. Esta é uma AMOSTRA — o print trazia 104 operadores.
-- Importe a lista completa do RH em vez de digitar aqui.
('Camilly Vitoria Valerio da Silva', 'camilly.v@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Luana Santos de Oliveira', 'luana.oliveira@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Weslley da Silva Bessa', 'weslley.bessa@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Acassya Mota da Silva', 'acassya.silva@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Adriana Monteiro Lima', 'adriana.lima@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Ana Carolina Dutra Moraes', 'ana.moraes@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Carlos Eduardo de Oliveira Nogueira', 'carlos.nogueira@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Daniel Luiz Pina', 'daniel.pina@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Felipe Silva Batista', 'felipe.batista@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Gabriela Alves Machado', 'gabriela.machado@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Juliana Tavares', 'juliana.tavares@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Leonardo Nunes da Silva', 'leonardo.silva@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Marcia Lima Peixoto', 'marcia.peixoto@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Mariana Nunes da Motta', 'mariana.motta@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Renata Barros Ribeiro', 'renata.ribeiro@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Thayana Brito Torres da Silva', 'thayana.silva@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador'),
('Valéria de Oliveira Alves', 'valeria.alves@grupoddm.com.br', 'pbkdf2$210000$Pptn4SPEYpfeSxqZ0FCwjg$z7qDsY3rDDrC8v4vmLnJxx4Dz10q30v3ZNdeolhjClI', 'operador');

-- ---------------------------------------------------------------------------
-- Clientes (operações) — os 12 reais
-- ---------------------------------------------------------------------------

INSERT INTO clientes (slug, nome, contrato) VALUES
('anima',                'Ânima',                  NULL),
('cobranca-isaac',       'Cobrança- Isaac',        NULL),
('cruzeiro-do-sul',      'Cruzeiro do Sul',        NULL),
('educacional',          'Educacional',            NULL),
('empresarial-cobranca', 'Empresarial - Cobrança', NULL),
('fiergs',               'FIERGS',                 '2026'),
('firjan',               'FIRJAN',                 '2026'),
('grupo-avenida',        'Grupo Avenida',          NULL),
('receptivo',            'Receptivo',              NULL),
('teste-1',              'teste 1',                NULL),
('vero',                 'Vero',                   NULL),
('yduqs',                'Yduqs',                  NULL);

-- ---------------------------------------------------------------------------
-- Campanhas
--
-- O print não mostrava a qual cliente cada campanha pertence. As que têm o
-- nome do cliente embutido foram vinculadas; as demais ficaram sem cliente
-- (valem para a operação toda). Revise essa amarração com a operação.
-- ---------------------------------------------------------------------------

INSERT INTO campanhas (cliente_id, nome, canal, favorita) VALUES
(NULL, 'Ativo - Prospecção',                          'telefone', 1),
(NULL, 'Ativo 20 a 44',                               'telefone', 1),
(NULL, 'Ativo 45 a 75',                               'telefone', 1),
(NULL, 'Ativo 76 a 120',                              'telefone', 1),
(NULL, 'Campanha teste Raphael',                      'outro',    0),
(NULL, 'Canais Online (E-mail, Chat e WhatsApp)',     'chat',     0),
(NULL, 'Chat',                                        'chat',     0),
(NULL, 'E - Saúde Digital',                           'outro',    0),
(NULL, 'MONITORIAS IA',                               'outro',    0),
(NULL, 'Monitorias IA - Telefone Ativo',              'telefone', 0),
(NULL, 'Monitorias IA - Telefone Receptivo',          'telefone', 0),
(NULL, 'Odontologia e Massagem relaxante (Offline)',  'offline',  0),
(NULL, 'Pré Churn - Telefone',                        'telefone', 0),
(NULL, 'Telefone',                                    'telefone', 0),
(NULL, 'Telefone Ativo',                              'telefone', 0),
(NULL, 'Telefone Receptivo',                          'telefone', 0),
(NULL, 'Telefone ativo',                              'telefone', 0),
(NULL, 'Teste receptivo',                             'telefone', 0),
((SELECT id FROM clientes WHERE slug='empresarial-cobranca'), 'Chat - Empresarial',           'chat',     0),
((SELECT id FROM clientes WHERE slug='empresarial-cobranca'), 'Telefone ativo Empresarial',   'telefone', 0),
((SELECT id FROM clientes WHERE slug='cobranca-isaac'),       'Isaac Ativo - Telefone',       'telefone', 0),
((SELECT id FROM clientes WHERE slug='vero'),                 'Vero Churn',                   'telefone', 0),
((SELECT id FROM clientes WHERE slug='vero'),                 'Vero Churn - Telefone',        'telefone', 0),
((SELECT id FROM clientes WHERE slug='vero'),                 'Vero Pré churn',               'telefone', 0),
((SELECT id FROM clientes WHERE slug='vero'),                 'Vero2 - Bck',                  'outro',    0),
((SELECT id FROM clientes WHERE slug='teste-1'),              'teste 1 campanha',             'outro',    0);

-- ---------------------------------------------------------------------------
-- Formulário "Formulário Educacional | Cruzeiro" — o da ficha QA-26-000541
-- ---------------------------------------------------------------------------

INSERT INTO formularios (cliente_id, nome, categoria, status, versao)
SELECT id, 'Formulário Educacional | Cruzeiro', 'padrao', 'ativo', 1
  FROM clientes WHERE slug = 'cruzeiro-do-sul';

SET @form := (SELECT id FROM formularios WHERE nome = 'Formulário Educacional | Cruzeiro' LIMIT 1);

-- COLLATE utf8mb4_bin força comparação sensível a maiúsculas. Sem isso o MySQL
-- casa 'Telefone Ativo' com 'Telefone ativo' — e o print traz as DUAS como
-- campanhas distintas, o que fazia a subconsulta devolver 2 linhas (erro #1242).
--
-- Daqui em diante o vínculo é feito por JOIN, sem variável de sessão: o
-- phpMyAdmin quebra arquivos grandes em blocos e as variáveis `@` se perdem
-- entre um bloco e outro, fazendo o INSERT casar com nada e gravar zero linhas
-- SEM reportar erro.
-- `BINARY` no lugar de `COLLATE utf8mb4_bin`, e junção por vírgula no lugar de
-- JOIN/ON: sintaxe antiga, aceita por qualquer versão de MySQL e MariaDB. A
-- forma moderna foi recusada pelo servidor do cPanel.
INSERT IGNORE INTO formulario_campanhas (formulario_id, campanha_id)
SELECT f.id, c.id
  FROM formularios f, campanhas c
 WHERE f.nome = 'Formulário Educacional | Cruzeiro'
   AND BINARY c.nome = 'Telefone Ativo'
   AND c.cliente_id IS NULL;

INSERT INTO formulario_secoes (formulario_id, nome, descricao, posicao) VALUES
(@form, 'ABERTURA', 'Avaliação da abertura do atendimento, com foco na abordagem inicial, identificação do cliente e clareza na comunicação, garantindo um início cordial, profissional e alinhado aos padrões estabelecidos.', 1),
(@form, 'DESENVOLVIMENTO', NULL, 2),
(@form, 'NEGOCIAÇÃO/COBRANÇA', NULL, 3),
(@form, 'NCG', 'Critérios eliminatórios: a falha em qualquer um deles zera a avaliação.', 4);

SET @s_abertura        := (SELECT id FROM formulario_secoes WHERE formulario_id=@form AND posicao=1);
SET @s_desenvolvimento := (SELECT id FROM formulario_secoes WHERE formulario_id=@form AND posicao=2);
SET @s_negociacao      := (SELECT id FROM formulario_secoes WHERE formulario_id=@form AND posicao=3);
SET @s_ncg             := (SELECT id FROM formulario_secoes WHERE formulario_id=@form AND posicao=4);

-- --- ABERTURA (8 critérios) ---
INSERT INTO formulario_criterios (secao_id, nome, enunciado, peso_pts, eliminatoria, posicao) VALUES
(@s_abertura, 'Prontidão', 'Interagiu em até 5 (cinco) segundos após o início do contato.', 6.00, 0, 1),
(@s_abertura, 'Saudação inicial', 'O operador informou sua identificação, apresentando-se como representante da área financeira da Estácio ou equivalente, deixando claro o motivo institucional do contato. (Ex.: José! Bom Dia! Meu nome é Maria falo da Estácio, tudo bem?)', 2.00, 0, 2),
-- PESO PENDENTE: ilegível no print. Corrija o 0.00 abaixo.
(@s_abertura, 'Personalização', 'Chamou o cliente pelo nome ao menos 2 vezes, garantindo uma experiência acolhedora, humanizada e alinhada às suas necessidades.', 0.00, 0, 3),
(@s_abertura, 'Vícios de Linguagem / Erros de Português', 'Avaliação de vícios de linguagem e erros de português, considerando a clareza, correção e fluidez na comunicação. Atenção: a partir de 3 ocorrências de vícios de linguagem, o critério passa a ser considerado não conforme. Comunicou-se sem falar erro grave de português como: plural, concordância, pronúncia...?', 10.00, 0, 4),
(@s_abertura, 'Dicção - Tom de voz', 'Considerando clareza na fala, ritmo adequado e entonação, garantindo uma comunicação compreensível, segura e alinhada a um atendimento acolhedor e profissional.', 8.00, 0, 5),
(@s_abertura, 'Empatia', 'Considerando a capacidade de compreender a situação do cliente, demonstrar acolhimento e conduzir a interação com respeito e sensibilidade, garantindo uma experiência mais humana e positiva.', 5.00, 0, 6),
(@s_abertura, 'Condução - Escuta ativa', 'Avaliação da condução e escuta ativa, considerando a capacidade de ouvir atentamente, compreender a real necessidade do cliente e conduzir o atendimento de forma clara, organizada e assertiva, garantindo uma interação fluida e focada na solução.', 1.00, 0, 7),
(@s_abertura, 'Saudação Final', 'Considerando o encerramento cordial, a disponibilidade para novas orientações e a finalização clara do atendimento.', 2.00, 0, 8);

-- --- DESENVOLVIMENTO (4 critérios) ---
INSERT INTO formulario_criterios (secao_id, nome, enunciado, peso_pts, eliminatoria, posicao) VALUES
(@s_desenvolvimento, 'Comunicação de Ausência / Tempo Excedente em Espera', 'Avaliação da comunicação de ausência ou tempo excedente em espera, considerando se o cliente é informado de forma clara e adequada sobre pausas, retornos e possíveis demoras, garantindo transparência e uma experiência mais segura durante o atendimento.', 1.00, 0, 1),
(@s_desenvolvimento, 'Domínio e Segurança', 'Considerando o conhecimento do atendente sobre os processos, clareza nas informações e confiança na condução do atendimento, garantindo assertividade e credibilidade na comunicação com o aluno.', 1.00, 0, 2),
-- PESO PENDENTE: ilegível no print. Corrija o 0.00 abaixo.
(@s_desenvolvimento, 'Atualização cadastral', 'Realização e atualização do cadastro, considerando a coleta e validação correta dos dados do cliente, bem como a atualização adequada das informações em sistema.', 0.00, 0, 3),
(@s_desenvolvimento, 'Autoatendimento', 'Avaliação do direcionamento ao autoatendimento, considerando se o atendente informou, quando aplicável, sobre os canais disponíveis da IES (Portal do Aluno/Giz, Meu Arco), incentivando a autonomia do aluno e facilitando futuras consultas e solicitações.', 1.00, 0, 4);

-- --- NEGOCIAÇÃO/COBRANÇA (5 critérios) ---
INSERT INTO formulario_criterios (secao_id, nome, enunciado, peso_pts, eliminatoria, posicao) VALUES
(@s_negociacao, 'Abordagem', 'Avaliação da apresentação do motivo do contato, considerando se o atendente seguiu o roteiro ao expor a proposta, informando de forma clara os valores, débitos incluídos na negociação, forma de pagamento a vista, pix, parcelado e a data de pagamento disponível na plataforma, utilizando comunicação estratégica para valorizar a oportunidade de regularização.', 12.00, 0, 1),
(@s_negociacao, 'Sondagem', 'Avaliação da sondagem, considerando a capacidade do atendente de compreender o cenário do cliente após apresentar o motivo do contato e a proposta, explorando de forma estratégica as necessidades e possibilidades, a fim de direcionar a negociação de maneira mais assertiva.', 12.00, 0, 2),
(@s_negociacao, 'Argumentação', 'Avaliação da argumentação, considerando a capacidade do atendente de utilizar o discurso do cliente para construir colocações pertinentes, destacando características e benefícios da proposta, com o objetivo de conduzir o atendimento de forma estratégica rumo ao aceite da negociação.', 12.00, 0, 3),
(@s_negociacao, 'Contorno de objeção', 'Avaliação do contorno de objeção, considerando se, diante das objeções apresentadas pelo aluno, o agente realizou no mínimo três tentativas de contorno ao longo do contato, de forma coerente e alinhada ao contexto da ligação, indo além do cumprimento de protocolo e buscando conduzir a negociação com estratégia.', 12.00, 0, 4),
(@s_negociacao, 'Fechamento da negociação', 'Avaliação do fechamento da negociação, aplicável tanto para casos de acordo formalizado quanto para recusa, considerando se o atendente orientou de forma clara sobre as condições ou, quando necessário, sobre as consequências do não pagamento, garantindo transparência e um encerramento adequado do atendimento.', 12.00, 0, 5);

-- --- NCG (8 critérios eliminatórios, sem peso) ---
INSERT INTO formulario_criterios (secao_id, nome, enunciado, peso_pts, eliminatoria, posicao) VALUES
(@s_ncg, 'Informações erradas', 'Avaliação de informações erradas, considerando se o atendente deixou de transmitir corretamente as informações conforme descrito nas ferramentas de suporte (roteiro de atendimento, etc.), sendo aplicável apenas quando houver erro por parte do operador na orientação prestada ao cliente.', NULL, 1, 1),
(@s_ncg, 'Informações incompletas', 'Avaliação de informações incompletas, considerando se o atendente deixou de informar ou realizar itens previstos no checklist/roteiro do acompanhamento, como, por exemplo, o cadastro CPC em casos de acordo realizado, sendo registrada quando essa ausência puder gerar prejuízo para as partes envolvidas.', NULL, 1, 2),
(@s_ncg, 'Acordo indevido', 'Avaliar, considerando se o atendente registrou a negociação sem a devida confirmação do devedor, sendo analisado neste item possíveis indícios de má-fé na condução e no registro do atendimento.', NULL, 1, 3),
(@s_ncg, 'Tabulação (Registro do atendimento)', 'Considerar se o atendente registrou corretamente o motivo do contato e as informações do atendimento em sistema, sendo apontado quando houver ausência de registro.', NULL, 1, 4),
(@s_ncg, 'Quebra de Sigilo', 'Avaliar se houve compartilhamento indevido de informações a terceiros ou falha na confirmação dos dados do titular antes de prosseguir com o atendimento, em desacordo com as diretrizes da LGPD, comprometendo a segurança e confidencialidade das informações.', NULL, 1, 5),
(@s_ncg, 'Mau atendimento', 'Considerando se o atendente adotou postura desrespeitosa, impaciente, grosseira ou ríspida, bem como a realização de comentários impróprios, irônicos ou uso de palavras inadequadas, comprometendo a qualidade e a experiência do cliente.', NULL, 1, 6),
(@s_ncg, 'Desconexão da chamada (Derrubar a ligação)', 'Considerando se o atendente encerrou a ligação sem justificativa, desconectando o cliente de forma indevida. Não deve ser aplicado em casos de falha sistêmica ou quando houver utilização do script adequado para encerramento por falta de comunicação.', NULL, 1, 7),
(@s_ncg, 'Omissão de atendimento', 'Considerando se o atendente iniciou o contato após tempo superior a 20 segundos da entrada da chamada, manteve a ligação sem justificativa após recado da operadora ou caixa postal, ou abandonou o atendimento sem motivo. Também se aplica quando permanece em linha diante de chamada muda, sem a devida tratativa, caracterizando falha na condução do atendimento.', NULL, 1, 8);

-- ---------------------------------------------------------------------------
-- Avaliação QA-26-000541 — a ficha completa do print
-- ---------------------------------------------------------------------------

-- Tudo por JOIN, sem variável de sessão: se o importador quebrar o arquivo em
-- blocos, cada comando ainda encontra sozinho as chaves de que precisa.
INSERT INTO avaliacoes (
  codigo, cod_gravacao, cliente_id, campanha_id, formulario_id,
  avaliado_id, avaliador_id, supervisor_id,
  categoria, origem, score, zerada, duracao_segundos,
  data_contato, data_avaliacao, status_feedback,
  total_conformes, total_nao_conformes, total_nao_aplicaveis, total_criterios
)
SELECT
  'QA-26-000541', '04201062600',
  cl.id, ca.id, f.id,
  av.id, mo.id, su.id,
  'padrao', 'humana', 88.00, 0, 344,          -- 344s = 5:44
  '2026-08-03 09:40:00', '2026-08-07 09:46:00', 'pendente',
  24, 1, 0, 25
FROM formularios f, clientes cl, campanhas ca, users av, users mo, users su
WHERE f.nome = 'Formulário Educacional | Cruzeiro'
  AND cl.slug = 'cruzeiro-do-sul'
  AND BINARY ca.nome = 'Telefone Ativo'
  AND ca.cliente_id IS NULL
  AND av.email = 'camilly.v@grupoddm.com.br'
  AND mo.email = 'fernandaferreira@grupoddm.com.br'
  AND su.email = 'fabiobatista@grupoddm.com.br';

-- Todos os 25 critérios entram como conformes...
INSERT INTO avaliacao_respostas (avaliacao_id, criterio_id, resposta, status, peso_aplicado)
SELECT a.id, c.id, 'sim', 'conforme', c.peso_pts
  FROM avaliacoes a, formulario_secoes s, formulario_criterios c
 WHERE a.codigo = 'QA-26-000541'
   AND s.formulario_id = a.formulario_id
   AND c.secao_id = s.id;

-- ...menos um. Este é o único Não Conforme da ficha.
UPDATE avaliacao_respostas r, formulario_criterios c, avaliacoes a
   SET r.resposta = 'nao',
       r.status = 'nao_conforme',
       r.peso_aplicado = 0.00,
       r.observacao_monitor = 'A operadora realizou o fechamento da negociação, porém deixou de orientar o cliente sobre a aplicação de juros e multa em caso de inadimplência, não atendendo integralmente ao critério de fechamento da negociação.'
 WHERE c.id = r.criterio_id
   AND a.id = r.avaliacao_id
   AND a.codigo = 'QA-26-000541'
   AND c.nome = 'Fechamento da negociação';

-- Status 'pendente' (e não 'aberto'): os estados do feedback passaram a ser
-- os 5 dos cards da tela — Pendente, Assinatura, Concluída, Justificada e
-- Revisão.
INSERT INTO feedbacks (avaliacao_id, autor_id, status, mensagem)
SELECT a.id, u.id, 'pendente',
       'Reforçar a orientação sobre juros e multa no fechamento da negociação.'
  FROM avaliacoes a, users u
 WHERE a.codigo = 'QA-26-000541'
   AND u.email = 'fernandaferreira@grupoddm.com.br';

-- ===========================================================================
-- CATÁLOGOS (migration 003)
--
-- Tudo daqui para baixo é CATÁLOGO, não dado de operação: são as listas que
-- as telas de Feedback, Contestações, Administração e Relatórios oferecem em
-- dropdown. Sem estas linhas as tabelas existem mas as telas abrem vazias.
--
-- Os textos vêm dos prints em PRINTS/TELAS/. O que NÃO veio do print e você
-- precisa revisar com a operação está marcado com "[REVISAR]".
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Categorias de formulário
--
-- As duas que já existiam como ENUM. O `categoria_id` dos formulários é
-- preenchido logo depois, a partir do ENUM antigo.
-- ---------------------------------------------------------------------------

INSERT INTO formulario_categorias (slug, nome, descricao, cor_hex, posicao, sistema) VALUES
  ('padrao',      'Padrão',      'Monitoria de rotina',                       '#2563eb', 1, 1),
  ('diagnostico', 'Diagnóstico', 'Monitoria de diagnóstico, não pontua meta', '#7c3aed', 2, 1);

UPDATE formularios f, formulario_categorias c
   SET f.categoria_id = c.id
 WHERE c.slug = f.categoria;

UPDATE avaliacoes a, formulario_categorias c
   SET a.categoria_id = c.id
 WHERE c.slug = a.categoria;

-- ---------------------------------------------------------------------------
-- Cores e prazos dos status de feedback
--
-- Labels e cores conferem com os badges do print de Feedback. [REVISAR] os
-- prazos em dias: o print não mostra o número, só o status.
-- ---------------------------------------------------------------------------

INSERT INTO feedback_status_configuracoes (status, label, prazo_dias, cor_hex, cor_texto_hex, posicao) VALUES
  ('pendente',    'Feedback Pendente', 5,    '#2563eb', '#ffffff', 1),
  ('assinatura',  'Assinatura',        3,    '#f59e0b', '#ffffff', 2),
  ('concluida',   'Concluída',         NULL, '#16a34a', '#ffffff', 3),
  ('justificada', 'Justificada',       NULL, '#0891b2', '#ffffff', 4),
  ('revisao',     'Revisão',           2,    '#dc2626', '#ffffff', 5),
  ('dispensado',  'Dispensado',        NULL, '#6b7280', '#ffffff', 6);

-- ---------------------------------------------------------------------------
-- Motivos de justificativa
--
-- [REVISAR] a lista inteira: o print mostra que a tela existe, não quais
-- motivos a DDM usa. Estes são os motivos usuais de operação de call center.
-- ---------------------------------------------------------------------------

INSERT INTO justificativa_motivos (escopo, slug, nome, exige_texto, posicao, sistema) VALUES
  ('ausencia_monitoria', 'ferias',            'Férias',                          0, 1, 0),
  ('ausencia_monitoria', 'afastamento',       'Afastamento médico',              0, 2, 0),
  ('ausencia_monitoria', 'desligamento',      'Desligamento no período',         0, 3, 0),
  ('ausencia_monitoria', 'admissao-recente',  'Admissão recente',                0, 4, 0),
  ('ausencia_monitoria', 'sem-gravacao',      'Sem gravação disponível',         1, 5, 0),
  ('ausencia_monitoria', 'troca-campanha',    'Troca de campanha no período',    0, 6, 0),
  ('ausencia_monitoria', 'outro',             'Outro motivo',                    1, 7, 0),
  ('ausencia_feedback',  'operador-ausente',  'Operador ausente',                0, 1, 0),
  ('ausencia_feedback',  'agenda-superior',   'Indisponibilidade do superior',   0, 2, 0),
  ('ausencia_feedback',  'desligamento',      'Desligamento antes do feedback',  0, 3, 0),
  ('ausencia_feedback',  'prazo-expirado',    'Prazo expirado',                  1, 4, 0),
  ('ausencia_feedback',  'outro',             'Outro motivo',                    1, 5, 0),
  ('exclusao_ficha',     'duplicada',         'Ficha duplicada',                 0, 1, 0),
  ('exclusao_ficha',     'audio-errado',      'Áudio de outro operador',         1, 2, 0),
  ('exclusao_ficha',     'formulario-errado', 'Formulário aplicado incorreto',   1, 3, 0),
  ('exclusao_ficha',     'teste',             'Ficha de teste',                  0, 4, 0),
  ('contestacao',        'criterio-indevido', 'Critério avaliado indevidamente', 1, 1, 0),
  ('contestacao',        'audio-divergente',  'Áudio não corresponde à ficha',   1, 2, 0),
  ('contestacao',        'peso-incorreto',    'Peso aplicado incorretamente',    1, 3, 0);

-- ---------------------------------------------------------------------------
-- Faixas de performance
--
-- [REVISAR] as faixas e os prazos: o print só mostra que a tela existe. Os
-- quadrantes 1Q..5Q batem com o ENUM de `avaliacoes.quadrante`.
-- ---------------------------------------------------------------------------

INSERT INTO faixa_conjuntos (nome, descricao, padrao) VALUES
  ('Padrão DDM', 'Conjunto usado por campanha que não tem conjunto próprio', 1);

INSERT INTO faixas_performance
  (conjunto_id, nome, score_min, score_max, cor_hex, prazo_feedback_dias, quadrante, posicao)
SELECT c.id, f.nome, f.score_min, f.score_max, f.cor_hex, f.prazo, f.quadrante, f.posicao
  FROM faixa_conjuntos c,
       (
         SELECT 'Crítico'      AS nome,  0.00 AS score_min,  59.99 AS score_max, '#dc2626' AS cor_hex, 1 AS prazo, '5Q' AS quadrante, 1 AS posicao
         UNION ALL SELECT 'Insuficiente', 60.00,  69.99, '#f97316', 2, '4Q', 2
         UNION ALL SELECT 'Regular',      70.00,  84.99, '#f59e0b', 3, '3Q', 3
         UNION ALL SELECT 'Bom',          85.00,  94.99, '#16a34a', 5, '2Q', 4
         UNION ALL SELECT 'Excelente',    95.00, 100.00, '#0891b2', 7, '1Q', 5
       ) f
 WHERE c.nome = 'Padrão DDM';

-- ---------------------------------------------------------------------------
-- Cargos
--
-- 11 cargos, como no card "Cargos Cadastrados" do print. [REVISAR] os nomes
-- com a estrutura real da DDM: o print mostra a contagem, não a lista.
-- `role_base` é o papel que as rotas checam.
-- ---------------------------------------------------------------------------

INSERT INTO cargos (slug, nome, descricao, role_base, nivel, sistema) VALUES
  ('administrador',        'Administrador',              'Acesso total ao sistema',                    'administrador', 100, 1),
  ('gestor-qualidade',     'Gestor de Qualidade',        'Gestão da operação de monitoria',            'administrador',  90, 1),
  ('coordenador',          'Coordenador',                'Coordena supervisores e monitores',          'supervisor',     80, 1),
  ('supervisor',           'Supervisor',                 'Aplica feedback e julga contestação',        'supervisor',     70, 1),
  ('monitor-senior',       'Monitor Sênior',             'Monitoria e calibração',                     'monitor',        60, 1),
  ('monitor',              'Monitor',                    'Realiza monitorias',                         'monitor',        50, 1),
  -- Usuário técnico sob o qual as avaliações de origem = 'ia' são gravadas:
  -- `avaliacoes.avaliador_id` é NOT NULL, então a ficha automática precisa de
  -- um usuário responsável mesmo sem monitor humano.
  ('monitor-ia',           'Monitor IA',                 'Responsável técnico das avaliações por IA',  'monitor',        45, 1),
  ('analista-qualidade',   'Analista de Qualidade',      'Relatórios e análises',                      'viewer',         40, 1),
  ('operador',             'Operador',                   'Avaliado; assina e contesta feedback',       'operador',       20, 1),
  ('auditor',              'Auditor',                    'Leitura de trilha de auditoria (compliance)','viewer',         30, 1),
  ('visualizador',         'Visualizador',               'Somente leitura',                            'viewer',         10, 1);

-- Amarra os usuários do seed aos cargos, pelo papel que já tinham.
UPDATE users u, cargos c
   SET u.cargo_id = c.id
 WHERE c.slug = 'administrador' AND u.role = 'administrador';

UPDATE users u, cargos c
   SET u.cargo_id = c.id
 WHERE c.slug = 'supervisor' AND u.role = 'supervisor';

UPDATE users u, cargos c
   SET u.cargo_id = c.id
 WHERE c.slug = 'monitor' AND u.role = 'monitor';

UPDATE users u, cargos c
   SET u.cargo_id = c.id
 WHERE c.slug = 'operador' AND u.role = 'operador';

-- Todo mundo do seed nasce com a mesma senha; a troca é obrigatória.
UPDATE users SET trocar_senha = 1;

-- ---------------------------------------------------------------------------
-- Catálogo de permissões
--
-- 68 permissões: os módulos do menu lateral x as ações que cada um oferece.
--
-- O print do QualiTalk mostra "71 Permissões no Catálogo". O número aqui é
-- menor de propósito: as 7 permissões de gestão de personas de IA
-- (monitor_ia.*) saíram junto com a tela Monitor IA, e no lugar entrou uma só
-- (monitoria.avaliacao.avaliar_ia) para a avaliação automática, que continua
-- existindo. O card da tela vai mostrar 68 — é o catálogo real do QualiDDM,
-- não o do sistema de origem.
--
-- [REVISAR] contra a matriz real de acesso antes de ligar a checagem por
-- permissão nas rotas.
-- ---------------------------------------------------------------------------

INSERT INTO permissoes (slug, modulo, recurso, acao, nome) VALUES
  ('dashboard.painel.ver',            'dashboard',     'painel',        'ver',        'Ver dashboard'),
  ('dashboard.painel.exportar',       'dashboard',     'painel',        'exportar',   'Exportar dashboard'),
  ('clientes.cliente.listar',         'clientes',      'cliente',       'listar',     'Listar clientes'),
  ('clientes.cliente.ver',            'clientes',      'cliente',       'ver',        'Ver cliente'),
  ('clientes.cliente.criar',          'clientes',      'cliente',       'criar',      'Criar cliente'),
  ('clientes.cliente.editar',         'clientes',      'cliente',       'editar',     'Editar cliente'),
  ('clientes.cliente.inativar',       'clientes',      'cliente',       'inativar',   'Inativar cliente'),
  ('clientes.campanha.listar',        'clientes',      'campanha',      'listar',     'Listar campanhas'),
  ('clientes.campanha.criar',         'clientes',      'campanha',      'criar',      'Criar campanha'),
  ('clientes.campanha.editar',        'clientes',      'campanha',      'editar',     'Editar campanha'),
  ('clientes.campanha.inativar',      'clientes',      'campanha',      'inativar',   'Inativar campanha'),
  ('formularios.formulario.listar',   'formularios',   'formulario',    'listar',     'Listar formulários'),
  ('formularios.formulario.ver',      'formularios',   'formulario',    'ver',        'Ver formulário'),
  ('formularios.formulario.criar',    'formularios',   'formulario',    'criar',      'Criar formulário'),
  ('formularios.formulario.editar',   'formularios',   'formulario',    'editar',     'Editar formulário'),
  ('formularios.formulario.publicar', 'formularios',   'formulario',    'publicar',   'Publicar formulário'),
  ('formularios.formulario.versionar','formularios',   'formulario',    'versionar',  'Versionar formulário'),
  ('formularios.criterio.editar',     'formularios',   'criterio',      'editar',     'Editar critérios'),
  ('formularios.categoria.gerenciar', 'formularios',   'categoria',     'gerenciar',  'Gerenciar categorias'),
  ('monitoria.avaliacao.listar',      'monitoria',     'avaliacao',     'listar',     'Listar avaliações'),
  ('monitoria.avaliacao.ver',         'monitoria',     'avaliacao',     'ver',        'Ver avaliação'),
  ('monitoria.avaliacao.criar',       'monitoria',     'avaliacao',     'criar',      'Criar avaliação'),
  ('monitoria.avaliacao.editar',      'monitoria',     'avaliacao',     'editar',     'Editar avaliação'),
  ('monitoria.avaliacao.excluir',     'monitoria',     'avaliacao',     'excluir',    'Excluir avaliação'),
  ('monitoria.avaliacao.ver_todas',   'monitoria',     'avaliacao',     'ver_todas',  'Ver avaliações de todos os avaliados'),
  ('monitoria.avaliacao.ouvir_audio', 'monitoria',     'avaliacao',     'ouvir_audio','Ouvir áudio da avaliação'),
  ('monitoria.justificativa.registrar','monitoria',    'justificativa', 'registrar',  'Registrar justificativa de ausência'),
  ('feedback.feedback.listar',        'feedback',      'feedback',      'listar',     'Listar feedbacks'),
  ('feedback.feedback.ver',           'feedback',      'feedback',      'ver',        'Ver feedback'),
  ('feedback.feedback.aplicar',       'feedback',      'feedback',      'aplicar',    'Aplicar feedback'),
  ('feedback.feedback.assinar',       'feedback',      'feedback',      'assinar',    'Assinar feedback'),
  ('feedback.feedback.justificar',    'feedback',      'feedback',      'justificar', 'Justificar ausência de feedback'),
  ('feedback.feedback.solicitar_revisao','feedback',   'feedback',      'solicitar_revisao','Solicitar revisão de feedback'),
  ('feedback.feedback.reabrir',       'feedback',      'feedback',      'reabrir',    'Reabrir feedback'),
  ('feedback.pesquisa.responder',     'feedback',      'pesquisa',      'responder',  'Responder pesquisa de satisfação'),
  ('contestacao.contestacao.listar',  'contestacao',   'contestacao',   'listar',     'Listar contestações'),
  ('contestacao.contestacao.ver',     'contestacao',   'contestacao',   'ver',        'Ver contestação'),
  ('contestacao.contestacao.abrir',   'contestacao',   'contestacao',   'abrir',      'Abrir contestação'),
  ('contestacao.contestacao.julgar',  'contestacao',   'contestacao',   'julgar',     'Julgar contestação'),
  ('contestacao.contestacao.cancelar','contestacao',   'contestacao',   'cancelar',   'Cancelar contestação'),
  ('contestacao.sla.gerenciar',       'contestacao',   'sla',           'gerenciar',  'Configurar SLA de contestações'),
  -- A gestão de personas de IA saiu do escopo do projeto; a AVALIAÇÃO por IA
  -- continua (rotas /api/avaliar e /api/analyze), e é o que esta permissão
  -- cobre.
  ('monitoria.avaliacao.avaliar_ia',  'monitoria',     'avaliacao',     'avaliar_ia', 'Disparar avaliação automática por IA'),
  ('transcricao.gravacao.listar',     'transcricao',   'gravacao',      'listar',     'Listar gravações'),
  ('transcricao.gravacao.enviar',     'transcricao',   'gravacao',      'enviar',     'Enviar gravação'),
  ('transcricao.gravacao.excluir',    'transcricao',   'gravacao',      'excluir',    'Excluir gravação'),
  ('transcricao.transcricao.ver',     'transcricao',   'transcricao',   'ver',        'Ver transcrição'),
  ('transcricao.transcricao.gerar',   'transcricao',   'transcricao',   'gerar',      'Gerar transcrição'),
  ('transcricao.transcricao.exportar','transcricao',   'transcricao',   'exportar',   'Exportar transcrição em JSON'),
  ('relatorio.relatorio.listar',      'relatorio',     'relatorio',     'listar',     'Listar relatórios'),
  ('relatorio.relatorio.executar',    'relatorio',     'relatorio',     'executar',   'Executar relatório'),
  ('relatorio.relatorio.exportar',    'relatorio',     'relatorio',     'exportar',   'Exportar relatório'),
  ('relatorio.relatorio.carregar_tudo','relatorio',    'relatorio',     'carregar_tudo','Carregar base inteira sem filtro'),
  ('relatorio.relatorio.ia',          'relatorio',     'relatorio',     'ia',         'Executar análise com IA'),
  ('admin.usuario.listar',            'admin',         'usuario',       'listar',     'Listar usuários'),
  ('admin.usuario.convidar',          'admin',         'usuario',       'convidar',   'Convidar usuário'),
  ('admin.usuario.editar',            'admin',         'usuario',       'editar',     'Editar usuário'),
  ('admin.usuario.inativar',          'admin',         'usuario',       'inativar',   'Inativar usuário'),
  ('admin.usuario.redefinir_senha',   'admin',         'usuario',       'redefinir_senha','Redefinir senha de usuário'),
  ('admin.cargo.gerenciar',           'admin',         'cargo',         'gerenciar',  'Gerenciar cargos e permissões'),
  ('admin.sessao.listar',             'admin',         'sessao',        'listar',     'Ver sessões e presença'),
  ('admin.sessao.revogar',            'admin',         'sessao',        'revogar',    'Revogar sessão'),
  ('admin.auditoria.ver',             'admin',         'auditoria',     'ver',        'Ver trilha de auditoria'),
  ('admin.automacao.gerenciar',       'admin',         'automacao',     'gerenciar',  'Gerenciar automações'),
  ('admin.faixa.gerenciar',           'admin',         'faixa',         'gerenciar',  'Gerenciar faixas de performance'),
  ('admin.meta.gerenciar',            'admin',         'meta',          'gerenciar',  'Gerenciar metas mensais'),
  ('admin.turno.gerenciar',           'admin',         'turno',         'gerenciar',  'Gerenciar turnos'),
  ('admin.workflow.ver',              'admin',         'workflow',      'ver',        'Ver workflow ativo'),
  ('admin.bug_report.ver',            'admin',         'bug_report',    'ver',        'Ver bug reports');

-- Administrador e Gestor de Qualidade recebem o catálogo inteiro.
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id
  FROM cargos c, permissoes p
 WHERE c.slug IN ('administrador', 'gestor-qualidade');

-- Visualizador e Auditor: só leitura.
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id
  FROM cargos c, permissoes p
 WHERE c.slug = 'visualizador'
   AND p.acao IN ('listar', 'ver');

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id
  FROM cargos c, permissoes p
 WHERE c.slug = 'auditor'
   AND (p.acao IN ('listar', 'ver') OR p.slug = 'admin.auditoria.ver');

-- Operador: vê a própria ficha, assina o feedback e contesta.
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id
  FROM cargos c, permissoes p
 WHERE c.slug = 'operador'
   AND p.slug IN (
     'monitoria.avaliacao.ver',
     'feedback.feedback.ver',
     'feedback.feedback.assinar',
     'feedback.feedback.solicitar_revisao',
     'feedback.pesquisa.responder',
     'contestacao.contestacao.abrir',
     'contestacao.contestacao.ver'
   );

-- [REVISAR] as demais amarrações cargo x permissão com a operação. Monitor,
-- Supervisor e Coordenador ficaram sem linha aqui de propósito: definir isso
-- por chute travaria gente em produção.

-- ---------------------------------------------------------------------------
-- Turnos — [REVISAR] com a escala real da operação.
-- ---------------------------------------------------------------------------

INSERT INTO turnos (nome, hora_inicio, hora_fim, dias_semana) VALUES
  ('Manhã',       '08:00:00', '14:00:00', 'seg,ter,qua,qui,sex'),
  ('Tarde',       '14:00:00', '20:00:00', 'seg,ter,qua,qui,sex'),
  ('Integral',    '09:00:00', '18:00:00', 'seg,ter,qua,qui,sex'),
  ('Sábado',      '08:00:00', '14:00:00', 'sab');

-- ---------------------------------------------------------------------------
-- Tipos de relatório
--
-- Os 14 "Sistema" e as 4 análises com IA, na ordem e com a descrição do print
-- de Relatórios. `permissao_slug` liga o relatório à permissão que ele exige.
-- ---------------------------------------------------------------------------

INSERT INTO relatorio_tipos (slug, nome, descricao, grupo, permissao_slug, posicao) VALUES
  ('base-monitoria',       'Base de Monitoria',          'Relatório completo de avaliações com todos os campos',                            'sistema', 'monitoria.avaliacao.listar',  1),
  ('base-monitoria-ia',    'Base de Monitoria IA',       'Monitorias realizadas pelo Monitor IA (avaliações automáticas via IA)',           'sistema', 'monitoria.avaliacao.listar',  2),
  ('usuarios',             'Usuários',                   'Listagem completa de usuários',                                                   'sistema', 'admin.usuario.listar',       3),
  ('fichas-avaliacao',     'Fichas de Avaliação',        'Detalhamento de avaliações por critério',                                         'sistema', 'monitoria.avaliacao.listar',  4),
  ('contestacoes',         'Contestações',               'Relatório de contestações abertas e resolvidas',                                  'sistema', 'contestacao.contestacao.listar', 5),
  ('monitoria-analitico',  'Monitoria Analítico',        'Consolidado de monitorias por período',                                           'sistema', 'monitoria.avaliacao.listar',  6),
  ('analitico-calibracao', 'Analítico de Calibração',    'Dados de sessões de calibração',                                                  'sistema', NULL,                         7),
  ('pesquisa-satisfacao',  'Pesquisa de Satisfação',     'Respostas dos operadores sobre feedbacks',                                        'sistema', 'feedback.feedback.listar',    8),
  ('justificativas',       'Justificativas de Avaliação','Critérios com justificativas do monitor',                                         'sistema', 'monitoria.avaliacao.listar',  9),
  ('fichas-excluidas',     'Fichas Excluídas/Avulsas',   'Auditoria de exclusões com autor, data, motivo e dados da avaliação',             'sistema', 'admin.auditoria.ver',        10),
  ('ausencia-monitoria',   'Ausência de Monitoria',      'Justificativas de por que operadores não foram avaliados no período',             'sistema', 'monitoria.justificativa.registrar', 11),
  ('monitoria-editada',    'Monitoria Editada',          'Trilha de auditoria de edições realizadas em avaliações',                         'sistema', 'admin.auditoria.ver',        12),
  ('extracao-campanhas',   'Extração de Campanhas',      'Listagem de todos os clientes e campanhas (ativos e inativos)',                   'sistema', 'clientes.campanha.listar',   13),
  ('monitoria-detalhada',  'Monitoria Detalhada',        'Consolidado detalhado por avaliação e critério',                                  'sistema', 'monitoria.avaliacao.listar', 14),
  ('ia-resumo-executivo',  'Resumo Executivo',           'Síntese do período em linguagem natural, com o que mudou e por quê',              'ia',      'relatorio.relatorio.ia',     15),
  ('ia-analise-ofensores', 'Análise de Ofensores',       'Critérios que mais reprovam, agrupados por causa provável',                       'ia',      'relatorio.relatorio.ia',     16),
  ('ia-plano-coaching',    'Plano de Coaching',          'Ações recomendadas por operador, priorizadas por impacto',                        'ia',      'relatorio.relatorio.ia',     17),
  ('ia-risco-ncg',         'Risco de NCG',               'Operadores e campanhas com maior chance de falha eliminatória',                   'ia',      'relatorio.relatorio.ia',     18);

-- As 4 estrelas marcadas no print, na conta da administradora. Favorito é por
-- usuário: quem logar depois começa sem estrela nenhuma.
INSERT INTO relatorio_favoritos (user_id, relatorio_tipo_id)
SELECT u.id, t.id
  FROM users u, relatorio_tipos t
 WHERE u.email = 'gisele.oliveira@grupoddm.com.br'
   AND t.slug IN ('base-monitoria', 'usuarios', 'monitoria-analitico', 'ausencia-monitoria', 'monitoria-detalhada');

-- ---------------------------------------------------------------------------
-- Workflow ativo
--
-- É o que a tela "Ver meu Workflow" exibe. [REVISAR] os prazos de cada etapa.
-- ---------------------------------------------------------------------------

INSERT INTO workflows (slug, nome, descricao, versao, ativo) VALUES
  ('monitoria-padrao', 'Monitoria padrão', 'Da gravação ao encerramento da contestação', 1, 1);

-- `cargo_id` fica NULL de propósito: qual cargo responde por cada etapa é
-- [REVISAR] com a operação, e chutar isso trava gente em produção.
INSERT INTO workflow_etapas (workflow_id, chave, nome, descricao, ordem, prazo_dias, obrigatoria)
SELECT w.id, e.chave, e.nome, e.descricao, e.ordem, e.prazo, e.obrigatoria
  FROM workflows w,
       (
         SELECT 'gravacao'  AS chave, 'Gravação recebida' AS nome, 'Áudio disponível para monitoria' AS descricao, 1 AS ordem, NULL AS prazo, 1 AS obrigatoria
         UNION ALL SELECT 'monitoria',  'Monitoria realizada',   'Monitor aplica a ficha e fecha a nota',      2, 3,    1
         UNION ALL SELECT 'feedback',   'Feedback aplicado',     'Superior aplica o feedback ao operado',      3, 5,    1
         UNION ALL SELECT 'assinatura', 'Assinatura do operado', 'Operado dá ciência do feedback',             4, 3,    1
         UNION ALL SELECT 'contestacao','Prazo de contestação',  'Janela em que o operado pode contestar',     5, 5,    0
         UNION ALL SELECT 'julgamento', 'Julgamento',            'ADM julga item por item e recalcula a nota', 6, 5,    0
         UNION ALL SELECT 'encerrada',  'Encerrada',             'Ciclo concluído',                           7, NULL, 1
       ) e
 WHERE w.slug = 'monitoria-padrao';

-- ---------------------------------------------------------------------------
-- Templates de automação — [REVISAR] os textos com quem escreve a comunicação
-- oficial. Estes são só o esqueleto para a tela não abrir vazia.
-- ---------------------------------------------------------------------------

INSERT INTO automacao_templates (slug, nome, canal, assunto, corpo, variaveis_json) VALUES
  ('feedback-pendente', 'Aviso de feedback pendente', 'email',
   'Você tem feedback pendente ({{codigo}})',
   'Olá, {{avaliado}}.\n\nA monitoria {{codigo}} da campanha {{campanha}} está aguardando feedback. O prazo é {{prazo}}.\n\nQualiDDM',
   '["avaliado","codigo","campanha","prazo"]'),
  ('feedback-assinatura', 'Feedback aguardando assinatura', 'email',
   'Assine o feedback da monitoria {{codigo}}',
   'Olá, {{avaliado}}.\n\nO feedback da monitoria {{codigo}} foi aplicado por {{superior}} e aguarda sua ciência até {{prazo}}.\n\nQualiDDM',
   '["avaliado","codigo","superior","prazo"]'),
  ('contestacao-aberta', 'Contestação aberta', 'email',
   'Nova contestação na monitoria {{codigo}}',
   'A monitoria {{codigo}} recebeu contestação de {{avaliado}} em {{itens}} item(ns). Prazo para julgar: {{prazo}}.\n\nQualiDDM',
   '["codigo","avaliado","itens","prazo"]'),
  ('transcricao-erro', 'Falha na transcrição', 'interno',
   'Falha ao transcrever gravação',
   'A gravação {{arquivo}} falhou na transcrição depois de {{tentativas}} tentativa(s). Erro: {{erro}}',
   '["arquivo","tentativas","erro"]');

-- ---------------------------------------------------------------------------
-- Conferência — o resultado esperado está no comentário de cada linha
-- ---------------------------------------------------------------------------

SELECT 'usuarios'   AS tabela, COUNT(*) AS total FROM users               -- 24
UNION ALL SELECT 'clientes',   COUNT(*) FROM clientes                     -- 12
UNION ALL SELECT 'campanhas',  COUNT(*) FROM campanhas                    -- 26
UNION ALL SELECT 'formularios', COUNT(*) FROM formularios                 --  1
UNION ALL SELECT 'secoes',     COUNT(*) FROM formulario_secoes            --  4
UNION ALL SELECT 'criterios',  COUNT(*) FROM formulario_criterios         -- 25
UNION ALL SELECT 'avaliacoes', COUNT(*) FROM avaliacoes                   --  1
UNION ALL SELECT 'respostas',  COUNT(*) FROM avaliacao_respostas          -- 25
UNION ALL SELECT 'feedbacks',  COUNT(*) FROM feedbacks                    --  1
-- Catálogos da migration 003
UNION ALL SELECT 'cargos',            COUNT(*) FROM cargos                -- 11
UNION ALL SELECT 'permissoes',        COUNT(*) FROM permissoes            -- 68
UNION ALL SELECT 'cargo_permissoes',  COUNT(*) FROM cargo_permissoes      -- ~190
UNION ALL SELECT 'turnos',            COUNT(*) FROM turnos                --  4
UNION ALL SELECT 'categorias_form',   COUNT(*) FROM formulario_categorias --  2
UNION ALL SELECT 'faixas',            COUNT(*) FROM faixas_performance    --  5
UNION ALL SELECT 'motivos_justif',    COUNT(*) FROM justificativa_motivos -- 19
UNION ALL SELECT 'status_feedback',   COUNT(*) FROM feedback_status_configuracoes -- 6
UNION ALL SELECT 'relatorio_tipos',   COUNT(*) FROM relatorio_tipos       -- 18
UNION ALL SELECT 'workflow_etapas',   COUNT(*) FROM workflow_etapas       --  7
UNION ALL SELECT 'templates_autom',   COUNT(*) FROM automacao_templates;  --  4

-- `cargo_permissoes` = 68 x 2 (administrador + gestor) + leitura do
-- visualizador + leitura/auditoria do auditor + 7 do operador. O número exato
-- depende de quantas permissões têm ação 'listar'/'ver'; não precisa fechar
-- na régua, só não pode ser zero.

-- ===========================================================================
-- ACESSO INICIAL
--
--   E-mail: gisele.oliveira@grupoddm.com.br
--   Senha:  QualiDDM@2026
--
-- Vale para TODOS os usuários criados acima. Troque a sua no primeiro acesso
-- e não distribua essa senha para a equipe — cada pessoa deve receber a dela.
-- ===========================================================================
