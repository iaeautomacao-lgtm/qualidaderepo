-- ===========================================================================
-- 10 - Senha padrão do sistema
--
-- POR QUE ESTE ARQUIVO EXISTE
--
-- O script 07 importou 219 pessoas da planilha usuarios_20260820.xlsx com um
-- `password_hash` cuja senha em texto claro NÃO ficou documentada em lugar
-- nenhum. Resultado prático: ninguém sabia com que senha essas pessoas
-- entrariam, e o suporte não tinha o que responder no telefone.
--
-- Este script conserta isso. Ele grava o hash de uma senha conhecida e
-- documentada:
--
--     Senha padrão: QualiDDM@2026
--
-- Ela é a mesma do `AUTH_SENHA_PADRAO` da aplicação (src/server/config.js). Se
-- você trocar a variável de ambiente, gere um hash novo e troque aqui também —
-- os dois precisam dizer a mesma coisa, senão o suporte informa uma senha que
-- não entra.
--
-- POR QUE UMA SENHA IGUAL PARA TODOS NÃO É UM FURO AQUI
--
-- Porque ela não abre nada. `trocar_senha = 1` fica gravado e o servidor
-- (`requireSession`) recusa TODA rota de dados enquanto estiver assim: a pessoa
-- autentica, cai na tela de troca e o sistema só abre depois. Sem essa trava,
-- esta senha seria uma chave-mestra de qualquer conta que ainda não acessou —
-- então não remova a trava para "facilitar".
--
-- O FILTRO É O QUE PROTEGE QUEM JÁ TROCOU
--
-- O UPDATE só toca em quem está com `trocar_senha = 1`, ou seja, quem nunca
-- trocou. Quem já definiu a senha dela mantém a senha dela. Rodar este arquivo
-- duas vezes não muda nada além de reescrever o mesmo hash.
--
-- Rode na aba SQL do phpMyAdmin, arquivo inteiro. Nunca na aba Importar.
-- ===========================================================================

SET NAMES utf8mb4;

-- Confira antes: quantas contas ainda estão na senha padrão.
SELECT COUNT(*) AS contas_com_senha_pendente
  FROM users
 WHERE trocar_senha = 1;

UPDATE users
   SET password_hash = 'pbkdf2$210000$NR2ApTwLV9zGutO8bGSIKw$JTpyO2GGBHL3_u2cb4LKt1jFNB2abgb68tDxsOYPeS0',
       senha_alterada_em = NULL
 WHERE trocar_senha = 1;

-- Confira depois: deve dar o mesmo número da consulta de cima, e todas essas
-- contas agora entram com QualiDDM@2026 e são obrigadas a trocar.
SELECT COUNT(*) AS contas_na_senha_padrao
  FROM users
 WHERE trocar_senha = 1
   AND password_hash = 'pbkdf2$210000$NR2ApTwLV9zGutO8bGSIKw$JTpyO2GGBHL3_u2cb4LKt1jFNB2abgb68tDxsOYPeS0';
