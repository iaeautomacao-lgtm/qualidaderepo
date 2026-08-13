-- ===========================================================================
-- QualiDDM — DADOS (parte 2 de 2)
--
-- Execute DEPOIS de `01-estrutura.sql`, no mesmo banco.
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

INSERT INTO formulario_campanhas (formulario_id, campanha_id)
SELECT @form, id FROM campanhas WHERE nome = 'Telefone Ativo' AND cliente_id IS NULL;

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

INSERT INTO avaliacoes (
  codigo, cod_gravacao, cliente_id, campanha_id, formulario_id,
  avaliado_id, avaliador_id, supervisor_id,
  categoria, origem, score, zerada, duracao_segundos,
  data_contato, data_avaliacao, status_feedback,
  total_conformes, total_nao_conformes, total_nao_aplicaveis, total_criterios
) VALUES (
  'QA-26-000541',
  '04201062600',
  (SELECT id FROM clientes WHERE slug='cruzeiro-do-sul'),
  (SELECT id FROM campanhas WHERE nome='Telefone Ativo' AND cliente_id IS NULL),
  @form,
  (SELECT id FROM users WHERE email='camilly.v@grupoddm.com.br'),
  (SELECT id FROM users WHERE email='fernandaferreira@grupoddm.com.br'),
  (SELECT id FROM users WHERE email='fabiobatista@grupoddm.com.br'),
  'padrao', 'humana', 88.00, 0, 344,          -- 344s = 5:44
  '2026-08-03 09:40:00', '2026-08-07 09:46:00', 'pendente',
  24, 1, 0, 25
);

SET @aval := (SELECT id FROM avaliacoes WHERE codigo = 'QA-26-000541');

-- Todos os 25 critérios entram como conformes...
INSERT INTO avaliacao_respostas (avaliacao_id, criterio_id, resposta, status, peso_aplicado)
SELECT @aval, c.id, 'sim', 'conforme', c.peso_pts
  FROM formulario_criterios c
  JOIN formulario_secoes s ON s.id = c.secao_id
 WHERE s.formulario_id = @form;

-- ...menos um. Este é o único Não Conforme da ficha.
UPDATE avaliacao_respostas r
  JOIN formulario_criterios c ON c.id = r.criterio_id
   SET r.resposta = 'nao',
       r.status = 'nao_conforme',
       r.peso_aplicado = 0.00,
       r.observacao_monitor = 'A operadora realizou o fechamento da negociação, porém deixou de orientar o cliente sobre a aplicação de juros e multa em caso de inadimplência, não atendendo integralmente ao critério de fechamento da negociação.'
 WHERE r.avaliacao_id = @aval
   AND c.nome = 'Fechamento da negociação';

INSERT INTO feedbacks (avaliacao_id, autor_id, status, mensagem)
VALUES (
  @aval,
  (SELECT id FROM users WHERE email='fernandaferreira@grupoddm.com.br'),
  'aberto',
  'Reforçar a orientação sobre juros e multa no fechamento da negociação.'
);

-- ---------------------------------------------------------------------------
-- Conferência — o resultado esperado está no comentário de cada linha
-- ---------------------------------------------------------------------------

SELECT 'usuarios'   AS tabela, COUNT(*) AS total FROM users               -- 26
UNION ALL SELECT 'clientes',   COUNT(*) FROM clientes                     -- 12
UNION ALL SELECT 'campanhas',  COUNT(*) FROM campanhas                    -- 26
UNION ALL SELECT 'formularios', COUNT(*) FROM formularios                 --  1
UNION ALL SELECT 'secoes',     COUNT(*) FROM formulario_secoes            --  4
UNION ALL SELECT 'criterios',  COUNT(*) FROM formulario_criterios         -- 25
UNION ALL SELECT 'avaliacoes', COUNT(*) FROM avaliacoes                   --  1
UNION ALL SELECT 'respostas',  COUNT(*) FROM avaliacao_respostas          -- 25
UNION ALL SELECT 'feedbacks',  COUNT(*) FROM feedbacks;                   --  1

-- ===========================================================================
-- ACESSO INICIAL
--
--   E-mail: gisele.oliveira@grupoddm.com.br
--   Senha:  QualiDDM@2026
--
-- Vale para TODOS os usuários criados acima. Troque a sua no primeiro acesso
-- e não distribua essa senha para a equipe — cada pessoa deve receber a dela.
-- ===========================================================================
