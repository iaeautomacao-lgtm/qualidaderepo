# Backend QualiDDM

## Stack

- Next.js App Router como Backend for Frontend.
- MySQL no cPanel.
- `mysql2` com queries parametrizadas.
- Sessão HTTP-only em cookie, com hash do token salvo no banco.
- Senhas com PBKDF2 usando `crypto` nativo do Node.

## Estrutura

```text
src/app/api/
  auth/login
  auth/logout
  auth/me
  dashboard
  wallets
  operators
  checklists
  reviews
  reviews/[id]
  upload
  analyze
  health

src/server/
  config.js
  db.js
  errors.js
  http.js
  validation.js
  repositories/
  security/
  services/

database/
  migrations/
  seeds/
```

## Modelo de dados

O banco separa entidades operacionais e resultados de IA:

- `wallets`: carteiras/clientes com regras próprias.
- `operators`: operadores vinculados a carteiras.
- `checklist_templates` e `checklist_items`: critérios versionados por carteira.
- `reviews`: avaliação principal da chamada.
- `review_uploads`: metadados dos arquivos recebidos.
- `transcript_messages`: transcrição por fala.
- `review_checklist_results`: resultado por critério.
- `ai_insights`: insights, riscos e recomendações.
- `users` e `user_sessions`: acesso ao sistema.
- `audit_logs`: trilha para operações sensíveis.

## Segurança aplicada

- Secrets ficam em variáveis de ambiente, nunca no código.
- `.env.example` contém apenas placeholders.
- `.env.secure.example` contém o modelo completo para produção no cPanel, incluindo `GEMINI_API_KEY` somente server-side.
- Cookie de sessão é `httpOnly`, `sameSite=lax` e `secure` em produção.
- Token de sessão não é salvo puro, apenas hash SHA-256 com segredo do servidor.
- Upload valida quantidade, tamanho e MIME type.
- Upload também valida extensão, cobrindo os exemplos reais de `ARQUIVOS`: PDF e áudio `.mp3.mpeg`.
- Respostas de erro usam envelope padronizado e não vazam stack trace em produção.
- Queries usam placeholders nomeados.
- Endpoints protegidos chamam `requireSession`.
- CORS fica fechado por padrão e só libera origens configuradas.

## cPanel

1. Criar banco MySQL e usuário pelo cPanel.
2. Aplicar `database/migrations/001_initial_schema.sql`.
3. Ajustar `database/seeds/001_demo_data.sql` antes de usar em produção. O seed demo usa `admin@qualiddm.local` com senha `QualiDDM@2026!`; troque imediatamente em qualquer ambiente real.
4. Configurar variáveis do `.env.example` no Node.js App do cPanel.
5. Rodar `npm install`, `npm run build` e iniciar com `npm run start`.

## Gemini

A chave da Gemini deve ser configurada como `GEMINI_API_KEY` no servidor. Não use
`NEXT_PUBLIC_GEMINI_API_KEY`, porque qualquer variável `NEXT_PUBLIC_` pode ser
exposta ao navegador no build do Next.js.

Variáveis previstas:

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_MAX_TRANSCRIPT_CHARS`

## Próximos adaptadores

O endpoint `/api/analyze` hoje persiste uma análise mockada para manter a interface funcional. A integração real de IA deve entrar como adaptador em `src/server/services`, recebendo o arquivo/metadados, retornando transcrição, checklist, nota, confiança e insights no mesmo contrato de dados.
