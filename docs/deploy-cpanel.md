# Deploy do QualiDDM no cPanel via Git

Guia para hospedagem cPanel **sem acesso a terminal**. Todo comando roda ou na
sua máquina, ou por botão no painel.

Ordem importa. Não pule etapas — a 5 depende da 4, e a 6 depende da 5.

---

## Antes de começar

Confirme no cPanel, em **Setup Node.js App**, qual a versão de Node disponível.

**O QualiDDM exige Node 20 ou superior.** Next.js 16 não roda em Node 18. Se a
lista só oferecer versões antigas, pare aqui e peça a atualização ao suporte da
hospedagem — nada do resto vai funcionar.

---

## Etapa 1 — Subir o código para o GitHub (na sua máquina)

O repositório **precisa ser privado**. Ele contém os critérios de avaliação, os
nomes dos clientes e as regras de negócio da operação.

1. Crie um repositório **privado** no GitHub chamado `qualiddm`. Não marque
   "Add a README" — o projeto já tem os arquivos.

2. No terminal da sua máquina, dentro de `qualiddm-app`:

```bash
git add .
git commit -m "QualiDDM: telas, backend e avaliação por IA"
git branch -M main
git remote add origin https://github.com/SEUUSUARIO/qualiddm.git
git push -u origin main
```

3. **Confira antes de seguir:** abra o repositório no GitHub e verifique que
   **não existe** nenhum arquivo `.env` ou `.env.local` na listagem. Se
   aparecer, pare e remova — sua senha do banco e a chave do Gemini estariam
   públicas para quem tiver acesso ao repositório.

O que sobe: código, SQL, documentação e os dois `.env.*.example` (que só têm
rótulos, nenhum segredo). O que não sobe: `.env.local`, `node_modules`, `.next`
e os logs de desenvolvimento.

---

## Etapa 2 — Clonar no cPanel

1. cPanel → **Git™ Version Control** → **Create**
2. Ative **Clone a Repository**
3. **Clone URL:** a URL do repositório
   - Repositório privado exige autenticação. O caminho mais simples é gerar um
     *Personal Access Token* no GitHub (Settings → Developer settings → Tokens,
     escopo `repo`) e usar a URL no formato
     `https://SEUUSUARIO:SEUTOKEN@github.com/SEUUSUARIO/qualiddm.git`
4. **Repository Path:** `qualiddm`
   (isso cria `/home/SEUUSUARIO/qualiddm`)
5. **Create**

Anote o caminho completo que aparecer. Você vai precisar dele na etapa 3.

---

## Etapa 3 — Criar a aplicação Node

1. cPanel → **Setup Node.js App** → **Create Application**

| Campo | Valor |
|---|---|
| Node.js version | 20 ou superior |
| Application mode | **Production** |
| Application root | `qualiddm` |
| Application URL | seu domínio ou subdomínio |
| Application startup file | `server.js` |

2. **Create**

O `server.js` é a ponte entre o Passenger (que o cPanel usa) e o Next.js. Sem
ele o painel não consegue iniciar a aplicação.

---

## Etapa 4 — Variáveis de ambiente

Ainda na tela da aplicação, em **Environment variables**, adicione uma a uma.
**Não crie arquivo `.env` no servidor** — o painel é o lugar certo, assim o
segredo não fica em disco nem entra em backup de arquivos.

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `APP_NAME` | `QualiDDM` |
| `APP_URL` | `https://seudominio.com.br` |
| `MYSQL_HOST` | `localhost` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_DATABASE` | `grpia_qualiddm` |
| `MYSQL_USER` | `grpia_qualiuser` |
| `MYSQL_PASSWORD` | a senha do banco |
| `MYSQL_CONNECTION_LIMIT` | `8` |
| `SESSION_SECRET` | **um segredo NOVO**, diferente do local |
| `SESSION_COOKIE_NAME` | `qualiddm_session` |
| `SESSION_DAYS` | `7` |
| `QUALITALK_DEV_AUTH_BYPASS` | `false` |
| `CORS_ALLOWED_ORIGINS` | `https://seudominio.com.br` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | a chave válida de 39 caracteres |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `UPLOAD_MAX_FILE_BYTES` | `52428800` |

Três linhas são críticas, e por motivos diferentes:

- **`MYSQL_HOST=localhost`** — aqui `localhost` está certo. A aplicação roda no
  mesmo servidor do banco. Isso é o oposto da sua máquina, onde `localhost`
  aponta para lugar nenhum.
- **`NODE_ENV=production`** e **`QUALITALK_DEV_AUTH_BYPASS=false`** — juntas,
  fecham o acesso. Com qualquer uma errada, o sistema entrega um administrador
  falso a qualquer visitante, **sem pedir senha**.
- **`SESSION_SECRET`** — gere um novo, não reaproveite o da sua máquina. Segredo
  de desenvolvimento circula em conversa e em arquivo local; o de produção não
  pode ter passado por lá.

---

## Etapa 5 — Instalar dependências

Na mesma tela da aplicação, clique em **Run NPM Install**.

Demora alguns minutos. Se falhar por falta de memória, é limitação do plano de
hospedagem — abra chamado pedindo aumento do limite de memória do Node.

---

## Etapa 6 — Compilar

Ainda na tela da aplicação, em **Run JS script**, escolha **`build`** e execute.

Este é o passo que costuma falhar em hospedagem compartilhada: o build do
Next.js consome bastante memória. Se der erro de memória, peça ao suporte para
elevar o limite, ou faça o build na sua máquina (`npm run build`) e envie a
pasta `.next` por FTP.

**A aplicação não sobe sem esta etapa.** O `server.js` só serve o que o build
produziu — ele não compila nada.

---

## Etapa 7 — Criar as tabelas

1. cPanel → **phpMyAdmin** → selecione `grpia_qualiddm`
2. Aba **SQL** → cole `database/cpanel/01-estrutura.sql` → **Executar**
3. Aba **SQL** → cole `database/cpanel/02-dados.sql` → **Executar**

O segundo arquivo termina com uma consulta de conferência. Os números esperados:
26 usuários, 12 clientes, 26 campanhas, 25 critérios, 25 respostas.

---

## Etapa 8 — Iniciar e conferir

1. Volte em **Setup Node.js App** e clique em **Restart**
2. Abra `https://seudominio.com.br/api/health` — deve responder JSON com
   `"ok": true`. Se responder erro, o problema é banco ou variável de ambiente,
   não a aplicação em si.
3. Abra `https://seudominio.com.br` — deve **redirecionar para `/login`**.

Esse redirecionamento é o teste de segurança mais importante do deploy. Se a
tela inicial abrir direto, sem pedir login, então `NODE_ENV` ou
`QUALITALK_DEV_AUTH_BYPASS` está errada e **o sistema está aberto ao público**.
Corrija antes de qualquer outra coisa.

4. Entre com `gisele.oliveira@grupoddm.com.br` / `QualiDDM@2026` e **troque a
   senha**.

---

## Atualizações seguintes

Depois que estiver no ar, cada nova versão segue o mesmo ciclo:

1. Na sua máquina: `git add . && git commit -m "descrição" && git push`
2. cPanel → Git Version Control → **Update from Remote** (ou **Pull or Deploy**)
3. Setup Node.js App → **Run NPM Install** (só se as dependências mudaram)
4. Setup Node.js App → **Run JS script → build**
5. **Restart**

Pular o passo 4 é o erro mais comum: o código novo chega, mas o servidor
continua servindo o build antigo — e parece que "a alteração não subiu".

---

## Se der errado

| Sintoma | Causa provável |
|---|---|
| "Application failed to start" | Build não rodou (etapa 6), ou versão de Node menor que 20 |
| Página abre sem pedir login | `NODE_ENV` ou `QUALITALK_DEV_AUTH_BYPASS` errada — **risco de segurança** |
| `/api/health` devolve erro | Credenciais do MySQL erradas, ou tabelas não criadas |
| Telas com dados de exemplo | Normal por enquanto: as telas ainda leem `src/data/seed.js`, não a API |
| Análise de IA falha | `GEMINI_API_KEY` ausente, inválida ou truncada |

Os logs ficam em **Setup Node.js App → Log file**, e mostram o erro real quando
o painel só diz "failed to start".
