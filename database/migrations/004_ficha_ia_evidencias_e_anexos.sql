-- ---------------------------------------------------------------------------
-- 004 — Evidências da IA na ficha, anexos por critério e tipo de feedback
--
-- Origem: docs/CONTRATO-FICHA-E-CHAT-IA.md.
--
-- O PROBLEMA QUE ESTA MIGRATION RESOLVE: a avaliação por IA já produz, para
-- cada critério, o TRECHO CITADO do atendimento, uma confiança e o raciocínio —
-- e produz, para a ficha inteira, resumo do atendimento, transcrição, insights,
-- riscos e próximos passos. Nada disso tinha coluna: `createAvaliacaoFromIa`
-- gravava só status, peso e a justificativa (dentro de `observacao_monitor`) e
-- jogava o resto fora. Sem essas colunas a tela "Detalhes da Avaliação IA" não
-- tem de onde tirar Evidência da IA, Confiança e Notas da IA, e o chat de IA
-- sobre o operador não tem contexto para responder ancorado na ficha.
--
-- Os campos de texto longo ficam em TEXT/LONGTEXT, não em JSON: o MySQL do
-- cPanel já recusou coluna JSON durante a carga do seed (ver comentários em
-- database/cpanel/02-dados.sql). `ia_analise_json` guarda JSON serializado como
-- texto, igual a `transcricoes.segmentos_json`, que segue o mesmo motivo.
--
-- COMO RODAR (cPanel > phpMyAdmin):
--   1. selecione o banco `grpia_qualiddm` na coluna da esquerda
--   2. aba SQL > cole este arquivo inteiro > Executar
--   NÃO use a aba Import: ela quebra o arquivo em blocos.
--
-- PONTO DE PARTIDA: banco no nível da 003 (ou instalado pelo
-- database/cpanel/01-estrutura.sql, que já nasce com tudo isto dentro).
--
-- Esta migration NÃO é idempotente nos ALTER TABLE, pela mesma razão da 003: o
-- MySQL 8 não aceita `ADD COLUMN IF NOT EXISTS`. Rodar duas vezes acusa
-- "Duplicate column name" — o erro é esperado e inofensivo, mas rode uma vez só.
--
-- NADA AQUI APAGA DADO: só ADD COLUMN e CREATE TABLE.
--
-- A aplicação tolera este schema AUSENTE: os repositórios consultam
-- `SHOW COLUMNS` antes de pedir as colunas novas e a leitura dos anexos trata
-- ER_NO_SUCH_TABLE devolvendo lista vazia. Um banco sem esta migration continua
-- abrindo a ficha — só sem evidência, confiança e anexos.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Evidência, confiança e raciocínio POR CRITÉRIO
--
-- `ia_evidencia` é o trecho citado do atendimento — é o que transforma
-- "não conforme" em algo contestável por uma pessoa. `ia_raciocinio` é a
-- explicação do modelo, e continua sendo espelhado em `observacao_monitor`
-- para não esvaziar o relatório de Justificativas, que lê aquela coluna.
--
-- DECIMAL(5,4) em `ia_confianca`: 0.0000 a 1.0000, mesma escala e mesmo tipo de
-- `transcricoes.confianca`.
-- ===========================================================================

ALTER TABLE avaliacao_respostas
  ADD COLUMN ia_evidencia TEXT NULL AFTER observacao_monitor,
  ADD COLUMN ia_confianca DECIMAL(5,4) NULL AFTER ia_evidencia,
  ADD COLUMN ia_raciocinio TEXT NULL AFTER ia_confianca;

-- `resposta` era ENUM('sim','nao') e isso é estreito demais: nos dados reais do
-- QualiTalk aparece "Diagnóstico" (critério respondido em modo diagnóstico, que
-- NÃO penaliza — o status continua 'conforme') e rótulos de opção como
-- "opt_conforme". A ficha varia por carteira, então o conjunto de rótulos não é
-- fechado e não cabe num ENUM sem uma migration por rótulo novo.
--
-- VARCHAR em vez de ENUM ampliado: a conversão de ENUM para VARCHAR preserva os
-- valores existentes (o MySQL grava o RÓTULO, não o índice), então 'sim' e 'nao'
-- continuam 'sim' e 'nao'. Em troca, a lista de valores aceitos passa a ser
-- responsabilidade da aplicação — está em `RESPOSTAS_CONHECIDAS`, em
-- src/server/repositories/avaliacoes.js.
--
-- O STATUS continua sendo o ENUM de três valores: é ele que decide conforme /
-- não conforme / não aplicável. `resposta` é o rótulo exibido, nunca a regra.
ALTER TABLE avaliacao_respostas
  MODIFY COLUMN resposta VARCHAR(40) NULL;

-- ===========================================================================
-- 2. Cabeçalho da ficha gerada por IA
--
-- `ia_persona` é a carteira / Monitor IA usado na análise; `ia_modelo` é o
-- modelo que respondeu (guardado porque a mesma ficha reavaliada com outro
-- modelo dá outra nota, e a auditoria precisa saber qual respondeu).
--
-- `ia_analise_json` guarda o que não tem coluna própria e é lido em bloco pela
-- tela: insights, riscos, próximos passos, transcrição com falantes e o
-- instante da geração. Dar coluna a cada um significaria uma migration nova a
-- cada campo que a análise passa a produzir.
--
-- `cpf_cliente` vem do "Cabeçalho da Ficha → CPF" do print. Fica no cabeçalho
-- da avaliação e não em `users` porque é o CPF do CLIENTE atendido, não do
-- operador avaliado — o sistema não cadastra o cliente final.
-- ===========================================================================

ALTER TABLE avaliacoes
  ADD COLUMN ia_persona VARCHAR(160) NULL AFTER origem,
  ADD COLUMN ia_modelo VARCHAR(120) NULL AFTER ia_persona,
  ADD COLUMN ia_confianca DECIMAL(5,4) NULL AFTER ia_modelo,
  ADD COLUMN ia_resumo TEXT NULL AFTER ia_confianca,
  ADD COLUMN ia_observacoes TEXT NULL AFTER ia_resumo,
  ADD COLUMN ia_analise_json LONGTEXT NULL AFTER ia_observacoes,
  ADD COLUMN cpf_cliente VARCHAR(20) NULL AFTER cod_gravacao;

-- ===========================================================================
-- 3. Anexos por critério (seção 6 do contrato)
--
-- Um critério contestado costuma vir acompanhado de print, e-mail ou áudio de
-- apoio. O arquivo em si vai para `storage_path`, dentro da raiz de
-- UPLOAD_STORAGE_DIR — a tabela guarda só o ponteiro, e o download passa pela
-- rota que confere se o caminho resolvido continua dentro daquela raiz.
--
-- ON DELETE CASCADE na resposta: apagar a resposta sem apagar o anexo deixaria
-- arquivo órfão apontado por linha inexistente.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS avaliacao_resposta_anexos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resposta_id BIGINT UNSIGNED NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NULL,
  tamanho_bytes BIGINT UNSIGNED NULL,
  enviado_por_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_anexos_resposta (resposta_id),
  CONSTRAINT fk_anexos_resposta FOREIGN KEY (resposta_id)
    REFERENCES avaliacao_respostas(id) ON DELETE CASCADE,
  CONSTRAINT fk_anexos_usuario FOREIGN KEY (enviado_por_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===========================================================================
-- 4. Tipo do feedback global (seção 7 do contrato)
--
-- O corpo de POST /api/avaliacoes/{codigo}/feedback traz
-- `tipo: elogio | orientacao | alerta`, e `feedbacks` não tinha onde guardar.
-- Sem a coluna o tipo se perderia ou teria de ser embutido no texto da
-- mensagem, contaminando o conteúdo que o operado assina.
-- ===========================================================================

ALTER TABLE feedbacks
  ADD COLUMN tipo ENUM('elogio','orientacao','alerta') NULL AFTER status;

-- ---------------------------------------------------------------------------
-- Conferência: as três consultas abaixo devem devolver, respectivamente,
-- 3 linhas, 7 linhas e 1 linha.
-- ---------------------------------------------------------------------------

-- SHOW COLUMNS FROM avaliacao_respostas LIKE 'ia\_%';
-- SHOW COLUMNS FROM avaliacoes WHERE Field IN
--   ('ia_persona','ia_modelo','ia_confianca','ia_resumo','ia_observacoes',
--    'ia_analise_json','cpf_cliente');
-- SHOW TABLES LIKE 'avaliacao_resposta_anexos';
