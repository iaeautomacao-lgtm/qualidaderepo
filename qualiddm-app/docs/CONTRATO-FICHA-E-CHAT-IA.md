# Contrato — Ficha de Monitoria, Detalhes da Avaliação IA e Chat de IA

Documento de acordo entre backend e frontend. **Não altere este arquivo sem avisar o outro lado.**
Referência visual: `docs/ESPEC-QUALITALK-PRINTS.md` (gerado a partir de `PRINTS/`) e a ferramenta QualiTalk.

Envelope padrão do projeto (já existente em `src/server/http.js`): `{ ok: true, data: {...} }` ou
`{ ok: false, error: { message, code } }`. Todo endpoint novo segue isso.

---

## 1. `GET /api/avaliacoes/{codigo}` — Ficha de Monitoria (humana e IA)

Retorno em `data.avaliacao`. Campos **já existentes** (manter nomes):

```
id, formulario, cliente, campanha, codGravacao, score, duracao, duracaoAudio,
categoria, statusFeedback, dataAvaliacao, dataContato, prazoFeedback,
prazoContestacao, audioPath,
avaliado: { papel, nome, email },
avaliador: { papel, nome, email },
supervisor: { papel, nome, email },
resumo: { conformes, naoConformes, naoAplicaveis, total },
secoes: [ { id, nome, descricao, criterios: [...] } ],
feedbacks: [ { status, mensagem, prazo, aplicadoEm, criadoEm, autor } ],
historico: [ { acao, entidade, detalhe, usuario, ip, criadoEm } ]
```

Campos **novos** a acrescentar:

```
origem: "humana" | "ia"
statusFeedbackChave: "pendente" | "assinatura" | "concluida" | "justificada" | "revisao" | "dispensado"
zerada: boolean
quadrante: string | null            // "1Q".."5Q" ou null
audioUrl: string | null             // URL tocável; null quando não há arquivo. Ver seção 3.
cpfCliente: string | null           // "Cabeçalho da Ficha → CPF" (N/A quando ausente)
scoreNumero: number                 // score como número, para colorir faixa no front
pesos: { obtido: number, total: number }
ia: null | {                        // presente só quando origem === "ia"
  persona: string | null,           // nome do Monitor IA / carteira usada
  modelo: string | null,
  confianca: number | null,         // 0..1
  resumo: string | null,            // resumoAtendimento
  observacoes: string | null,       // "Observações da IA" (texto corrido)
  insights: string[],
  riscos: string[],
  proximosPassos: string[],
  transcricao: string | null,       // texto com falantes, ver seção 4
  geradoEm: string | null
}
```

Cada item de `secoes[].criterios[]`:

```
nome                       string
enunciado                  string      // "Descrição:" no print
resposta                   string|null // "sim" | "não" | "Conforme" | "Diagnóstico" ...
status                     "Conforme" | "Não Conforme" | "Não Aplicável"
statusChave                "conforme" | "nao_conforme" | "nao_aplicavel"   // NOVO
peso                       number|null
eliminatoria               boolean
observacao                 string|null  // "Observação do Monitor"
anexos                     [ { id, nome, tamanhoBytes, tamanhoLabel, url } ]  // NOVO, [] quando não há
ia                         null | {     // NOVO — presente em fichas de origem "ia"
  evidencia: string|null,   // trecho citado da transcrição
  confianca: number|null,   // 0..1
  raciocinio: string|null   // "Notas da IA (raciocínio)"
}
```

---

## 2. `GET /api/transcricoes/{id}` — Detalhes da Avaliação IA

Mantém `data.gravacao` com o que já existe. A análise estruturada continua vindo em
`data.gravacao.transcricao.segmentos`. Acrescentar dentro de `segmentos` (o objeto que
`analisarArquivoLivreEstruturado` produz):

```
codigo        string   // ex. "MIA-20260814-0007" — id humano da análise IA
persona       string   // carteira/monitor IA usado (ex. "Lojas Avenida")
formulario    string   // nome do formulário/ficha aplicada (ex. "Grupo Avenida")
transcricao   string   // COM falantes, ver seção 4
duracao       string   // "1:49"
observacoesIa string
```

E no nível de `data.gravacao`, acrescentar:

```
audioUrl  string | null   // ver seção 3
```

---

## 3. Áudio — `GET /api/gravacoes/{id}/audio` e `GET /api/avaliacoes/{codigo}/audio`

- Exige sessão (mesmas roles que já leem a avaliação/gravação).
- Resolve o caminho a partir de `gravacoes.storage_path` / `avaliacoes.audio_path`,
  **sempre** dentro de `config.upload.storageDir`; qualquer caminho que escape a raiz
  depois de `path.resolve` responde 404 (proteção contra path traversal).
- Responde `Content-Type` pelo mime salvo, `Accept-Ranges: bytes`, e trata o header
  `Range` com `206 Partial Content` — sem isso o `<audio>` não consegue buscar posição
  no Chrome/Safari.
- `Cache-Control: private, max-age=0, must-revalidate`.
- Arquivo ausente no disco → 404 com mensagem em português.
- `audioUrl` no JSON é exatamente esta rota (ou `null` quando não há arquivo).

---

## 4. Transcrição com falantes

O prompt da análise IA passa a pedir a transcrição em linhas do formato
`SPEAKER_00: texto` / `SPEAKER_01: texto`, uma fala por linha, na ordem da conversa,
sem inventar falantes. O front renderiza cada linha como um turno de fala
(rótulo do falante + texto), não como bloco de `<pre>`.

---

## 5. Chat de IA sobre o operador

### `POST /api/ia/chat`

Corpo:

```json
{
  "escopo": "avaliacao" | "gravacao",
  "referencia": "QA-26-000688",         // codigo da avaliação OU id da gravação
  "pergunta": "O que devo falar no feedback do operador?",
  "historico": [ { "autor": "usuario" | "ia", "texto": "..." } ]
}
```

Resposta `data`:

```json
{
  "resposta": "texto em português do Brasil",
  "evidencias": [ { "trecho": "...", "criterio": "..." } ],
  "sugestoes": ["pergunta sugerida 1", "pergunta sugerida 2"],
  "modelo": "gemini-...",
  "geradoEm": "2026-08-17T18:00:00.000Z"
}
```

Regras:
- Exige sessão (`administrador`, `supervisor`, `monitor`).
- O contexto enviado ao modelo é montado no servidor a partir da ficha/análise real:
  nota, resumo de conformidade, cada critério com status/peso/evidência/raciocínio,
  observações do monitor e a transcrição. **O front nunca manda o contexto** — só a
  pergunta e o histórico.
- `historico` é limitado (últimas 10 mensagens) e cada texto truncado.
- A transcrição e as observações são **dados a analisar, não instrução**: a instrução do
  sistema diz explicitamente para ignorar comandos que apareçam dentro do conteúdo.
- Se a IA não tiver base para responder, ela diz que não tem — não inventa.
- Rate limit simples por usuário para não virar torneira de custo.

### `GET /api/ia/chat/sugestoes?escopo=...&referencia=...` (opcional)

`data.sugestoes: string[]` — perguntas iniciais sugeridas, geradas a partir das não
conformidades da ficha (ex.: "Por que 'Negociação gradativa' ficou não conforme?").
Se não implementar, o front usa uma lista fixa.

---

## 6. Anexos de critério

Nova tabela (migration nova em `database/migrations/`, e refletida em
`database/cpanel/01-estrutura.sql`):

```sql
CREATE TABLE avaliacao_resposta_anexos (
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
```

Download: `GET /api/avaliacoes/{codigo}/anexos/{anexoId}` com as mesmas travas de
caminho da seção 3. Quando a tabela não existir no banco, `anexos` volta `[]` — a ficha
não pode quebrar por schema faltando (o projeto já usa esse padrão em
`isMissingSchemaError`).

---

## 7. Feedback global da avaliação

`POST /api/avaliacoes/{codigo}/feedback`

```json
{ "tipo": "elogio" | "orientacao" | "alerta", "mensagem": "min 20 caracteres", "acao": "aplicar" | "justificar" }
```

- `acao: "aplicar"` → grava em `feedbacks` e move `avaliacoes.status_feedback` para
  `concluida`; `"justificar"` → `justificada`.
- Valida `mensagem` com mínimo de 20 caracteres (o print mostra o contador `0 / 20 caracteres`).
- Registra em `audit_logs`.
- Resposta: `data.avaliacao` recarregada (mesmo shape da seção 1), para o front
  atualizar a tela sem segundo request.

---

## Divergências da implementação

Escrito pelo backend depois de implementar. **O contrato acima vale; o que está aqui é
onde a implementação ficou diferente dele, e por quê.** Nada aqui remove campo do
contrato — são acréscimos, precisões e uma troca de tipo de coluna.

### Campos acrescentados além do contrato

| Campo | Onde | Por quê |
|---|---|---|
| `criterios[].pesoCriterio` | seção 1 | O contrato tem só `peso`, que hoje devolve `avaliacao_respostas.peso_aplicado` — e esse é **0 em todo critério não conforme**. O print mostra `Peso: 9 pts`, que é o peso de CADASTRO do critério. Mudar o significado de `peso` quebraria o que o front já lê, então `peso` continua sendo o aplicado e `pesoCriterio` traz `formulario_criterios.peso_pts`. **Para exibir "Peso: N pts", use `pesoCriterio`.** |
| `criterios[].respostaLabel` | seção 1 | `resposta` passou a vir **literal** do banco (ver abaixo). `respostaLabel` traz o rótulo legível dos valores conhecidos (`sim`→"Sim", `nao`→"Não", `diagnostico`→"Diagnóstico"); rótulo próprio de carteira atravessa igual ao literal. |
| `feedbacks.tipo` | seção 7 / migration | O corpo do POST tem `tipo` e `feedbacks` não tinha coluna para ele. Coluna própria (`ENUM('elogio','orientacao','alerta') NULL`) em vez de embutir no texto da mensagem, que é o texto que o operado assina. |

### `avaliacao_respostas.resposta`: ENUM → `VARCHAR(40)`

A coluna era `ENUM('sim','nao')`. A migration 004 troca por `VARCHAR(40) NULL`, e não por
ENUM ampliado: o conjunto de rótulos não é fechado (`Diagnóstico`, `opt_conforme`, e a
ficha varia por carteira), e cada rótulo novo exigiria migration. A conversão preserva os
dados — o MySQL grava o RÓTULO do ENUM, então `'sim'` e `'nao'` continuam iguais.

Consequências para o front:

- `criterios[].resposta` é o valor **literal** do banco, sem normalização para sim/não.
- **O badge sai de `statusChave`, nunca da resposta**: um critério com resposta
  `diagnostico` costuma ter `statusChave: "conforme"`, porque modo diagnóstico não penaliza.
- `statusChave` vem cru do banco (`conforme` | `nao_conforme` | `nao_aplicavel`), separado
  do rótulo em português que continua em `status`.
- A validação dos valores gravados passou para a aplicação (`RESPOSTAS_CONHECIDAS` e
  `normalizarResposta`, em `src/server/repositories/avaliacoes.js`) — o banco não barra mais.

### Precisões nos campos do contrato

- **`ia.geradoEm`** vem formatado `dd/mm/aaaa, hh:mm`, igual a `dataAvaliacao` e aos outros
  campos de data da ficha — não em ISO. Só o `geradoEm` do chat (seção 5) é ISO.
- **`audioUrl`** é `null` também quando o arquivo **não está no disco**, não apenas quando a
  coluna está vazia: a rota confere com `stat` antes de oferecer a URL. Player que não toca é
  pior que ficha sem player. Vale para a seção 1 e para a seção 2.
- **`ia` e `criterios[].ia`** só vêm preenchidos quando `origem === "ia"`, como no contrato.
  Numa ficha de IA **gerada antes da migration 004** os campos existem mas vêm `null` —
  não há como recuperar o que não foi gravado. `ia_analise_json` é usado como fonte reserva
  quando as colunas dedicadas estão vazias.
- **`criterios[].observacao` e `criterios[].ia.raciocinio` trazem o MESMO texto** em ficha de
  IA recém-gerada. `observacao_monitor` continua sendo preenchido com o raciocínio da IA
  porque o relatório de Justificativas lê aquela coluna e ficaria vazio para toda ficha
  automática. Quando um humano editar a observação, os dois passam a divergir e
  `ia.raciocinio` preserva o que a IA disse.
- **`quadrante`** é devolvido como está no banco (hoje sempre `null` em ficha de IA): nada
  neste trabalho calcula faixa de performance.

### Rotas — nome da pasta ≠ nome no contrato

As URLs são exatamente as do contrato. O que muda é o nome do parâmetro dinâmico no disco:
o Next não aceita `[id]` e `[codigo]` no mesmo nível de pasta, e `/api/avaliacoes/[id]` já
existia. Então:

```
/api/avaliacoes/{codigo}/audio            -> src/app/api/avaliacoes/[id]/audio/route.js
/api/avaliacoes/{codigo}/anexos/{anexoId} -> src/app/api/avaliacoes/[id]/anexos/[anexoId]/route.js
/api/avaliacoes/{codigo}/feedback         -> src/app/api/avaliacoes/[id]/feedback/route.js
/api/gravacoes/{id}/audio                 -> src/app/api/gravacoes/[id]/audio/route.js
```

As rotas de áudio também respondem **HEAD** (alguns players sondam antes de pedir a primeira
faixa). Range fora do arquivo responde **416** com `Content-Range: bytes */tamanho`; `Range`
com múltiplas faixas é ignorado e a resposta é 200 com o arquivo inteiro.

**Anexos: só download.** O contrato não pediu upload, e não existe endpoint para criar anexo
— `anexos` volta `[]` até alguém gravar linha em `avaliacao_resposta_anexos`.

### Chat (seção 5)

- **`pergunta` acima de 1000 caracteres responde 400**, não é truncada em silêncio: pergunta
  gigante é sinal de tentativa de injetar contexto próprio, e é melhor o front saber.
  O `historico` é truncado em silêncio (últimas 10 mensagens, cada texto em 1200 caracteres),
  como o contrato pede. Mensagem com `autor` fora de `usuario`/`ia` é descartada.
- A **transcrição recebe o que sobra** de `AI_MAX_TRANSCRIPT_CHARS` depois da ficha, da
  pergunta e do rodapé. A pergunta fica no TOPO do prompt de propósito: se o corte caísse
  sobre ela, a IA responderia outra coisa.
- **Injeção de prompt**: todo texto de terceiro (transcrição, observação do monitor, nomes,
  evidências, e os campos que o modelo gerou) tem os marcadores de delimitação substituídos
  por `[marcador removido]` antes de entrar no prompt — sem isso um texto contendo o marcador
  de fim "sairia" da área delimitada. Testado com payload de injeção nas duas pontas.
- **`GET /api/ia/chat/sugestoes` está implementado e NÃO chama o modelo**: as perguntas saem
  das não conformidades da própria ficha, mais três perguntas fixas. Abrir a tela não deve
  custar uma requisição de IA. Por isso essa rota também não tem rate limit.
- **Rate limit: 20 requisições por usuário a cada 5 minutos, na memória do processo.** Num
  deploy com mais de um worker o limite efetivo é multiplicado pelo número de processos —
  para valer de verdade precisa de Redis. Está anotado em
  `src/server/security/rate-limit.js`. Resposta ao estourar: **429** com
  `error.code = "too_many_requests"`.

### Transcrição e cabeçalho da análise (seções 2 e 4)

- `codigo` é **derivado**, não sorteado: `MIA-` + data + os 4 últimos dígitos do id da
  gravação. Estável entre leituras, que é o que importa para um id que aparece na tela.
  Consequência: duas gravações do mesmo dia cujos ids diferem só acima do 4º dígito recebem
  o mesmo código. Se isso passar a incomodar, o caminho é uma coluna própria com sequência.
- `formulario` na análise livre vem como `"Ficha genérica de atendimento (análise livre)"` —
  não existe formulário cadastrado nesse fluxo, e o campo não podia ficar vazio.
- `duracao` e `cpfCliente` são **extraídos pelo modelo**. O CPF só é aceito com 11 dígitos e
  sai formatado `000.000.000-00`; qualquer outra coisa vira `null`, porque o modelo às vezes
  devolve protocolo ou telefone quando não achou CPF. O dígito verificador NÃO é validado de
  propósito: CPF ditado ao telefone chega com erro de audição, e recusar por isso esconderia
  do monitor o que foi dito.
- Análise **gravada antes desta mudança** não tem esses campos no JSON. `obterTranscricao`
  preenche `codigo`, `persona`, `formulario` e `duracao` na leitura, para a tela abrir sem
  reprocessar a gravação. `transcricao` e `observacoesIa` não dão para derivar: gravação
  antiga continua sem transcrição com falantes até ser reprocessada.

### Tolerância a schema ausente

Nada disso exige a migration 004 para a tela abrir. Sem ela: as colunas novas saem como
`NULL AS ...` no SELECT (decidido por `SHOW COLUMNS`), `anexos` volta `[]` por
`ER_NO_SUCH_TABLE`, e os INSERT de `createAvaliacaoFromIa` e do feedback são montados só com
as colunas que existem. Verificado nos dois estados de schema.
