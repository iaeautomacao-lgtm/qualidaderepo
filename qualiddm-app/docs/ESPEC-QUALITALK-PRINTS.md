# Especificação de UI — QualiTalk (referência para o QualiDDM)

Catálogo de **66 screenshots** (58 em `PRINTS/` + 8 em `PRINTS/TELAS/`) da ferramenta de
referência **QualiTalk** (`app.qualitalk.com.br`), tenant "QualiTalk - D..." / DDM.

Objetivo: quem ler este documento **não precisa das imagens** para reimplementar as telas.
Todos os textos são literais, transcritos dos prints.

Legenda de origem:

- **[QT]** — print do QualiTalk (referência).
- **[DDM]** — print do QualiDDM (o app em construção). São 4 prints (`160711`, `162227`,
  `163528`, `172402`) que mostram o estado atual, não a referência.

---

## 0. Convenções globais do shell (todas as telas [QT])

### 0.1 Sidebar (coluna esquerda fixa, ~280 px, fundo branco)

De cima para baixo:

1. **Bloco de marca**: quadrado arredondado roxo com ícone de escudo + texto em duas
   linhas — título **"QualiTalk - D..."** (truncado) e subtítulo **"Sistema de Qualidade"**.
   À direita, um botão de "trocar tenant" com ícone de chevron duplo (cima/baixo).
2. **Bloco de usuário**: **"Gisele Oliveira"** / **"Administrador"**; à direita um controle
   de tema (ícone de sol + chevron para baixo), com contorno laranja quando focado.
3. **Menu de navegação** (ordem exata, ícone à esquerda; itens com submenu têm chevron `>`
   à direita):
   - `Dashboard` — com chevron (expansível)
   - `Clientes`
   - `Formulários` — com chevron
   - `Quizzes` — com chevron
   - `Monitor IA`
   - `Transcrições`
   - `Feedback`
   - `Contestações` — com chevron
   - `Sala de Calibração`
   - `Calendário`
   - `Relatórios`
   - `Administração` — com chevron
4. **Rodapé da sidebar**: botão **"Sair"** com ícone de logout, texto e borda vermelhos,
   fundo branco, largura total. Abaixo, empilhado e centralizado: chip **"DEV"**
   (pílula azul-claro, texto azul) e a linha **"v1.5.0"** em fonte monoespaçada.

**Item ativo**: fundo laranja-claro (`#FDE7CF`-ish), texto e ícone laranja escuro,
com barra/indicador à esquerda. Ex.: `Monitor IA` ativo em `TELAS/MONITOR DE IA.png`.

**Submenu aberto** (`TELAS/GESTAO ADM.png`, item `Contestações`): abaixo do pai aparecem
os filhos indentados —
- `+ Avaliações Candidatas` (ícone de `+`)
- `Gestão ADM` (ícone de escudo) — este é o **ativo** (fundo laranja-claro).

### 0.2 Header / topbar

Faixa branca no topo da área de conteúdo:

- **Ícone da tela** em quadrado arredondado (branco com sombra) à esquerda.
- **Título H1** grande e negrito + **subtítulo** cinza logo abaixo.
- À direita, conforme a tela: **campo de busca** (ícone de lupa + placeholder), **botão
  de tema** (sol + chevron), **botão de notificações** (campainha com ponto vermelho de
  não lidas), e botões de ação primária.
- Em telas de detalhe, à esquerda do ícone aparece um botão **"← Voltar"** ou
  **"← Dashboard Principal"**.

### 0.3 Elementos recorrentes

- **Cards de KPI**: card branco, borda cinza-clara, canto arredondado. Ícone em
  "icon tile" colorido (azul / verde / amarelo / roxo) no canto superior esquerdo,
  **número grande** alinhado à direita na mesma linha, e abaixo **rótulo em negrito** +
  **sub-rótulo cinza**.
- **Header de tabela**: **fundo laranja forte** (`#F97316`-ish) com **texto branco em
  negrito** — assinatura visual das tabelas do QualiTalk (Feedback, Gestão ADM).
- **Chips de status**: `Ativo` / `Ativa` = pílula verde-clara com texto verde;
  `Conforme` = pílula verde-clara com borda verde; `Não Conforme` = pílula
  vermelha-clara com borda vermelha; `Novo` = pílula verde-clara; `Sistema` = pílula
  cinza; `Eliminatória` = pílula vermelha-clara com ⚠️.
- **Botão flutuante** no canto inferior direito: ícone de "bug" (reportar problema).
- **Barra de rolagem própria** do painel de conteúdo, à direita.

---

## 1. Dashboard

### 1.1 `Captura de tela 2026-08-17 172542.png` [QT] — Dashboard (topo)

- Header: H1 **"Dashboard"**; busca com placeholder **"Buscar..."**; botão de campainha
  com ponto vermelho.
- **4 KPIs** (cada um com badge de contexto no canto superior direito):
  | Ícone | Badge | Valor | Rótulo |
  |---|---|---|---|
  | check em quadrado azul | `Mês: Agosto` (azul) | **1.514** | Total de Avaliações |
  | estrela verde | `S/NCG: 71,66` (verde) | **59,91** | Score Médio de Qualidade |
  | relógio roxo | — | **15:06** | Tempo Médio (min:seg) |
  | pessoas amarelo | `12 total` (verde) | **12** | Clientes Ativos |
- **Card "Evolução de Avaliações e Qualidade"** — gráfico de linhas duplo:
  - Eixo Y esquerdo (avaliações): `0`, `85`, `170`, `255`, `340`.
  - Eixo Y direito (qualidade): `0`, `15`, `30`, `45`, `60`.
  - Eixo X: `Mês -5`, `Mês -4`, `Mês -3`, `Mês -2`, `Mês -1`, `Atual`.
  - Legenda inferior: **`—o— Avaliações`** (azul) e **`—o— Qualidade`** (verde).
- **Card "Distribuição por Quadrante"** — donut chart. Legenda: **`1Q`** (verde),
  **`2Q`** (azul), **`3Q`** (laranja). Tooltip aberto sobre a fatia laranja:
  título **"3Q"**, linha **"84,22 (1238 avaliações)"**.

### 1.2 `Captura de tela 2026-08-17 172556.png` [QT] — Dashboard (base)

- **Card "Top 10 Ofensores (Critérios com Mais Falhas)"** — **estado vazio**, texto
  centralizado: **"Nenhum ofensor identificado"**.
- **Card "Status Atual"** — lista de 5 linhas, cada uma com icon-tile circular +
  título negrito + sub-linha:
  | Ícone/tom | Título | Sub-linha |
  |---|---|---|
  | balão azul | **Feedbacks Abertos** | 1145 pendentes |
  | check verde | **Feedbacks Aplicados** | 352 (23.5%) |
  | alerta vermelho (fundo da linha rosado) | **Feedbacks Vencidos** | 5 fora do prazo |
  | documento laranja | **Contestações** | 56 total · 0 pendentes |
  | alvo vermelho (fundo da linha rosado) | **Avaliações Zeradas** | 293 (19.9%) |

---

## 2. Clientes / Operações

### 2.1 `Captura de tela 2026-08-17 172602.png` [QT] — Operações

- Header: H1 **"Operações"**; busca **"Buscar clientes..."**; botão de tema; botão
  primário **"+ Novo Cliente"** (fundo laranja/vermelho, texto branco).
- **4 KPIs** (badge de contexto à direita, número grande abaixo):
  | Ícone | Badge | Valor | Rótulo |
  |---|---|---|---|
  | pessoas azul | `Total` (azul) | **12** | Total de Clientes |
  | check verde | `Ativos` (verde) | **12** | Clientes Ativos |
  | balão roxo | `Total` (roxo) | **1567** | Monitorias Realizadas (total) |
  | tendência amarelo | `Qualidade` (roxo) | **58,46** | Nota de Qualidade (score) |
- **Seção "Selecionar Cliente"** — grade de cards (3 por linha). Cada card:
  - Ícone de alvo/target em quadrado gradiente azul→roxo, centralizado.
  - **Nome do cliente** em H3 centralizado: `Ânima`, `Cobrança- Isaac`,
    `Cruzeiro do Sul` (e mais abaixo).
  - Linha `Status:` … chip **`Ativa`** (verde).
  - Linha `Formulários:` … link verde com ícone: **"1 formulário"** / **"2 formulários"**.
  - Linha centralizada em cinza: **"Contrato: Não definido"**.
  - Botão largura total **"Acessar {nome}"** (azul sólido) — ex. "Acessar Ânima",
    "Acessar Cobrança- Isaac".
  - Linha final: botão **"✎ Editar"** (roxo sólido, ocupa a maior parte) + botão de
    **lixeira** (vermelho sólido, quadrado).
- Rodapé do navegador mostra a URL de destino: `https://app.qualitalk.com.br/dashboard/operacoes`.

### 2.2 `Captura de tela 2026-08-14 150753.png` [QT] — recorte da topbar de Clientes

Recorte estreito só com os controles do canto superior direito: campo de busca com lupa e
placeholder **"Buscar clientes..."**, botão de tema (sol + chevron, com contorno laranja de
foco) e botão **"+ Novo Cliente"** laranja.

---

## 3. Formulários

### 3.1 `Captura de tela 2026-08-17 172619.png` [QT] — Formulários (painel)

- Header: ícone de documento; H1 **"Formulários"**; subtítulo **"Gerencie Formulários e
  avaliações"**; busca **"Buscar Formulários..."**; campainha com ponto vermelho; botão de tema.
- **4 KPIs**:
  | Ícone | Valor | Rótulo | Sub-rótulo |
  |---|---|---|---|
  | documento azul | **30** | Total de Formulários | 30 ativos, 0 rascunhos |
  | check verde | **30** | Formulários Ativos | Prontos para avaliação |
  | relógio amarelo | **0** | Em Desenvolvimento | Aguardando configuração |
  | tendência roxo | **657** | Total de Questões | Critérios de avaliação |
- **Card "Ações Rápidas"** — subtítulo **"Acesse rapidamente as principais funcionalidades
  dos Formulários"**. Tiles (ícone quadrado colorido + título + descrição):
  | Ícone/cor | Título | Descrição |
  |---|---|---|
  | `+` azul | **Cadastro de Formulários** | Crie e configure novos Formulários de avaliação |
  | play verde | **Iniciar avaliação** | Inicie uma nova avaliação de monitoria |
  | check roxo | **Visualizar avaliações** | Acesse e gerencie avaliações realizadas |
  | documento laranja | **Visualizar justificativas** | Veja, edite e exclua justificativas lançadas |
  | gráfico laranja-escuro | **Relatórios** (parcialmente visível) | — |

### 3.2 `Captura de tela 2026-08-17 172952.png` [QT] — Visualizar Justificativas (vazio)

- Header: botão **"← Voltar"**; ícone de documento; H1 **"Visualizar Justificativas"**;
  subtítulo **"Justificativas de ausência de monitoria lançadas"**.
- **Card "Filtros"** (ícone de funil no título) com 3 campos:
  - `Ano` — select, valor **"Qualquer ano"**.
  - `Mês` — select, valor **"Qualquer mês"**.
  - `Buscar` — input com lupa, placeholder **"Operador, e-mail, motivo ou comentário"**;
    ao lado botão **"Buscar"**.
- **Card "Justificativas lançadas"** com badge à direita **"0 registros"**.
  **Estado vazio**: ícone de documento, H3 **"Nenhuma justificativa encontrada"**,
  linha **"Ajuste os filtros ou lance uma justificativa em "Iniciar Avaliação"."**

### 3.3 `Captura de tela 2026-08-17 172959.png` [QT] — Monitorias editadas

- Header: ícone de "histórico/undo"; H1 **"Monitorias editadas"**; subtítulo
  **"Trilha de edições de monitorias já submetidas (compliance)"**.
- **Card "Filtros"**: `De` (date `dd/mm/aaaa`), `Até` (date `dd/mm/aaaa`), checkbox
  **"Somente com mudança de nota"**; à direita botões **"Limpar"** (branco) e
  **"Aplicar"** (laranja sólido).
- **Tabela** — header cinza-claro, colunas na ordem:
  `Monitoria` | `Operador avaliado` | `Editado por` | `Quando` | `Nota` | `Campos` |
  `Consequências` | `Motivo`
  - Coluna **Editado por** tem duas linhas: nome + papel em cinza (`admin`, `member`).
  - Coluna **Nota** mostra `100.0% → 80.0%` seguido de badge de delta:
    **`↘ -20.0`** (vermelho) ou **`↗ +22.0`** (laranja). Quando não houve mudança:
    `0.0% → 0.0%` sem badge.
  - Coluna **Campos** traz dois chips-botão empilhados: **`Respostas`** e
    **`Nota / Resultado`**. Quando não há: `—`.
  - Coluna **Consequências**: `—`.
- Linhas visíveis:
  | Monitoria | Operador avaliado | Editado por | Quando | Nota | Motivo |
  |---|---|---|---|---|---|
  | QA-26-000370 | Roseli Honorato dos Santos | Roberta Bruna Pereira Diniz / admin | 22/07/2026, 09:47 | 100.0% → 80.0% (-20.0) | Erro na plataforma |
  | QA-26-000215 | Miguel Viana de almeida Vicente | Fernanda Alves / member | 06/07/2026, 10:35 | 78.0% → 100.0% (+22.0) | Ligação errada |
  | QA-26-000119 | Marcela Vasconcelos Joaquim Alves | Roberta Bruna Pereira Diniz / admin | 19/06/2026, 12:34 | 0.0% → 0.0% | Esquecimento de anexo |
  | QA-26-000093 | Lucas Araújo Custódio | Roberta Bruna Pereira Diniz / admin | 12/06/2026, 13:15 | 100.0% → 100.0% | — |
- Rodapé da tabela: barra de rolagem horizontal e contador **"1–4 de 4"**.

---

## 4. Avaliações (lista + filtros)

### 4.1 `Captura de tela 2026-08-17 172631.png` [QT] — Avaliações

- Header: botão **"← Voltar"**; ícone de check; H1 **"Avaliações"**; subtítulo
  **"Visualize e gerencie avaliações"**; busca **"Buscar avaliações..."**; botão
  **"⤓ Exportar"**; botão de tema; campainha.
- **Card "Filtros de Avaliação"** (ícone de funil), subtítulo **"Refine os resultados
  conforme necessário"**. À direita: **"Filtros ativos"** com o número **0** abaixo, e
  botão **"Limpar Todos"**.
  Campos, na ordem exata (grid de 3 colunas + 4 colunas):
  1. `Operação` — select **"Todas as Operações"**
  2. `Campanha` — select **"Todas as Campanhas"**
  3. `ID da Monitoria` — input, placeholder **"Ex: QA-24-000123 ou 000123"**
  4. `Avaliador` — select **"Todos os Avaliadores"**
  5. `Avaliado` — select **"Todos os Avaliados"**
  6. `Nível de Performance` — select **"Todos os Scores"**
  7. `Período de Avaliação` — dois inputs date **`dd/mm/aaaa`**
  8. `Categoria` — select **"Todas as Categorias"**
  9. `Departamento` — select **"Todos os Departamentos"**
  - Rodapé do card: **"💡 Dica: Combine múltiplos filtros para resultados mais precisos"**
    e, à direita, botão **"📅 Limpar Datas"**.
- **Dois cards de contagem** logo abaixo (números grandes centralizados):
  - **539** / **"Total de Avaliações"**
  - **1 / 11** / **"Página atual · 50 por página"**

### 4.2 `Captura de tela 2026-08-17 172945.png` [QT] — Cards de avaliação da lista

Cada avaliação é um **card** (não linha de tabela):

- Ícone de check em quadrado verde à esquerda.
- **Título** = nome do formulário: `Avaliação de atendimento Vero - SP - Ativo`;
  `FIRJAN >>> Formulário de monitoria SAÚDE DIGITAL`.
- Linha abaixo: chip **`Nota: 88,00`** (azul-claro) · `ID:` + código monoespaçado
  `QA-26-000688` + botão de copiar · `🕐 17/08/2026 às 15:41`.
- Grade de 2 colunas com os metadados (ícone + rótulo em negrito + valor):
  - Coluna esquerda: `Avaliado:` **Kleyton Marlon Abílio Ferreira de Lima**;
    `Supervisor:` **Lucila Flores**; `Data:` **17/08/2026 às 15:41**.
  - Coluna direita: `Monitor:` **Alenilton da Costa**; `Duração:` **8:28**;
    `Cód. Gravação:` **07277332733**; `Campos:` **0**.
- Linha de tags (chips com borda cinza): **`Vero`**, **`Ativo 20 a 44`**.
  À direita: **`🏅 Score: 88,00`**.
- Linha final de contadores (chips): **`27 Conformes`** (verde), **`3 Não Conformes`**
  (vermelho), **`0 Não Aplicáveis`** (amarelo).
- Ações no canto superior direito do card: **"👁 Visualizar"**, **"✎ Editar"**, botão de
  **calendário** (agendar), botão de **lixeira** (vermelho).
- Segundo card visível: `FIRJAN >>> Formulário de monitoria SAÚDE DIGITAL`,
  chip **`Nota: 100,00`**, `ID: QA-26-000687`, `13/08/2026 às 12:35`,
  Avaliado **Renata Barros Ribeiro**, Supervisor **Denise Esquivel**,
  Monitor **Roberta Bruna Pereira Diniz**, Duração **13:51**,
  Cód. Gravação (texto longo, em duas linhas): **"Marcelo Pimenta Motta Telenutrição
  Atitude ... Fernandes Nicacio Bentes - quinta-feira, 20..."**.

### 4.3 Dropdowns dos filtros (estados abertos)

Todos os dropdowns seguem o mesmo padrão: o gatilho fica com **fundo laranja-claro e texto
laranja**, e abre um popover branco com **campo de busca no topo** (lupa + placeholder) e
lista rolável; a opção selecionada tem **✓** à esquerda; o item sob o mouse ganha
**fundo laranja-claro e texto laranja**.

#### `172636.png` + `172641.png` — `Operação` (placeholder **"Buscar operação..."**)
Opções completas, na ordem: **Todas as Operações** (✓), `Ânima`, `Cobrança- Isaac`,
`Cruzeiro do Sul`, `Educacional`, `Empresarial - Cobrança`, `FIERGS`, `FIRJAN`,
`Grupo Avenida`, `Receptivo`, `teste 1`, `Vero`, `Yduqs`.

#### `172646.png` + `172653.png` + `172700.png` + `172705.png` — `Campanha` (placeholder **"Buscar campanha..."**)
Opções completas, na ordem: **Todas as Campanhas** (✓), `Ativo - Prospecção`,
`Ativo 20 a 44`, `Ativo 45 a 75`, `Ativo 76 a 120`, `B2B`, `Campanha teste Raphael`,
`Canais Online (E-mail, Chat e WhatsApp)`, `Chat`, `Chat - Empresarial`,
`E - Saúde Digital`, `Isaac Ativo - Telefone`, `MONITORIAS IA`,
`Monitorias IA - Telefone Ativo`, `Monitorias IA - Telefone Receptivo`,
`Odontologia e Massagem relaxante (Offline)`, `Pré Churn - Telefone`, `Telefone`,
`Telefone Ativo`, `Telefone Grupo Avenida`, `Telefone Receptivo`, `Telefone ativo`,
`Telefone ativo Empresarial`, `Teste receptivo`, `Vero Churn`, `Vero Churn - Telefone`,
`Vero Pré churn`, `Vero2 - Bck`, `teste 1 campanha`.

#### `172709.png` — `Avaliador` (placeholder **"Buscar avaliador..."**)
Lista completa: **Todos os Avaliadores** (✓), `Dayara Jovita`, `Alenilton da Costa`,
`Denise Esquivel`, `Fernanda Alves`, `Raphael Outstand`, `Roberta Bruna Pereira Diniz`.

#### `172714` → `172927` (14 prints) — `Avaliado` (placeholder **"Buscar avaliado..."**)
Lista longa e rolável. Primeira opção **Todos os Avaliados** (✓); os dois primeiros nomes
aparecem fora de ordem alfabética (`Luana Santos de Oliveira`, `Weslley da Silva Bessa`),
depois a lista segue ordenada. Nomes capturados nos scrolls, em sequência:

`Luana Santos de Oliveira`, `Weslley da Silva Bessa`, `Aaliyah Cristiana de Mello`,
`Acassya Mota da Silva`, `Adriana do Nascimento Laranjeira`, `Adriana Monteiro Lima`,
`Agatha Cristina de Souza Oliveira Florindo`, `ALESSANDRA MENDES PEREIRA`,
`Alessandra Reis de Oliveira`, `Aline Maria de Azevedo Ferreira`,
`Amanda Inocêncio Pereira dos Santos`, `Ana Beatriz lemos alves`,
`Ana Beatriz Marçal gama ramos`, `Ana Beatriz Santos Esperança`,
`Ana Carolina Dutra Moraes`, `Ana Clara Gomes de Arruda`, `Ana Claudia da Silva`,
`Ana Paula Boge Camargo`, `Ana Paula Melo Cardoso Soares`, `Ayrton Oliveira da Silva`,
`Caique Fonseca da Conceição`, `Camilly Vitoria Valerio da Silva`,
`Carlos Eduardo de Oliveira Nogueira`, `Chaiane dos Santos Moreno`,
`Christiane Pimentel Diniz34567876567`, `CLARA LUIZA DE ARAÚJO JACOB`,
`Daniel Luiz Pina`, `Daniella de Fatima da Silva Cardoso`,
`Danilo Felix de Moura Lourenço`, `Eduarda de Jesus Soares`, `Eduarda Santiago Brito`,
`Elisabete Antonia de Siqueira`, `Ester de Sousa Rabelo`,
`Evelyn Paloma de Souza Estevam`, `EVELYN PALOMA DE SOUZA ESTEVAM`,
`Felipe Silva Batista`, `Flavia Encrenazi de Oliveira Cunha`, `Gabriel da Silva Miranda`,
`Gabriela Alves Machado`, `Gabriela Barbosa da Silva`, `Gabriela Duarte Velozo`,
`Giovanni Baptista Miranda`, `Grazielle de Cassia Silva`, `Guilherme Pereira Ramos`,
`Helio Farias de Matos`, `Iris Janaina Araujo de Jesus`, `Janaina Pimenta e Pimenta`,
`Jaqueline Siqueira de Almeida`, `Jennyfer Domingos Queiroz`, `Jhordana Rodrigues Alves`,
`João Cosme campos Araújo`, `João Pedro do Nascimento Silva`, `Josiane Dias Queiroz`,
`Juliana Tavares`, `Kaio Sousa Gonçalves`, `Karla Cristina da Silva Fernandes`,
`Kelvyn Moreira Rocha e Silva`, `Késsia de Oliveira Angelo`,
`Kleyton Marlon Abílio Ferreira de Lima`, `Lackson Adriano Ribeiro da Silva`,
`Laís da Silva Ferreira`, `Laize Silveira leite`, `Lanaysa Melissa de Almeida garcia`,
`Lenice Ferreira dos Santos`, `Leonardo Nunes da Silva`, `Leticia Cristina de Freitas`,
`Leticia Foster de Souza`, `Leticia Maciel Araújo`, `Leticia thaniely Teixeira Izidoro`,
`Lorena Saddock de Sá Lopes`, `Luana Gama da Silva`, `Lucas Araújo Custódio`,
`Maiara Cristina de Souza`, `Maickon Gomes dos Santos`, `Maira Lopes Lima`,
`Manuela Vieira da Costa Sol Alves`, `Marcia Lima Peixoto`,
`Marcia Thaina Rodrigues Cardoso`, `Márcio Moreira Lima`,
`Margareth Simone Ramos de Oliveira`, `Maria Lucinaide Veloso Feitosa da Rocha`,
`Mariana Aires Gueracimczik`, `Mariana costa ramos`, `Mariana Nunes da Motta`,
`Mariane de Oliveira Santos`, `Michelle aparecida alves da silva`,
`Michely Rodrigues Silva`, `Monique de Oliveira Britto`, `Nathalia Dantas dos anjos`,
`Nathalia de Oliveira Rodrigues Almeida`, `Nicoly Justino de Barros`,
`Odhara Cristina Severo de Oliveira Britto`,
`Oliria Emmeline Alves do Nascimento Santos`, `Pâmella de Almeida Moreira Ferreira`,
`Patricia Roxane Macedo de Lara`, `Paulo Victor Santos da Silva`,
`Rafaelle brito da costa`, `Raquel Anacleto Gomes`, `Renata Barros Ribeiro`,
`Renata Rodrigues dos Santos`, `Rosana Fernandes Pinheiro`, `Roseli Honorato dos Santos`,
`Sabrina Santana da Costa Ferreira`, `SAMARA SOUZA DA SILVA`, `Sarah Danyelle da Silva`,
`SARAH PEREIRA DA MATA`, `Simone Victoria de Carvalho`, `Solaine da Rocha Valadares`,
`Sonia Oliveira de Souza`, `Susana Maria dos Santos de Souza`,
`Tamires Dandara dos santos`, `Tania Mara Godinho`, `Tatiane Silva Mendez`,
`Thayana Brito Torres da Silva`, `Thiago Fernandes da silva soares`,
`Ulisses de Oliveira Silverio`, `Valéria de Oliveira Alves`,
`Valquiria carvalho de Andrade`, `Victor Augusto Ramos Chaves`,
`Victoria de Souza Jesus`, `Vitoria Sousa Araujo`.

> Prints individuais desse dropdown: `172714`, `172721`, `172727`, `172735`, `172756`,
> `172816`, `172823`, `172834`, `172842`, `172849`, `172856`, `172904`, `172911`,
> `172919`, `172927`.

#### `172932.png` — `Nível de Performance` (placeholder **"Buscar nível..."**)
Opções: **Todos os Scores** (✓), **`Zerados (0-0)`**, **`Fora da meta (1-79)`**,
**`Dentro da meta (80-100)`**.

#### `172936.png` — `Categoria` (placeholder **"Buscar categoria..."**)
Opções: **Todas as Categorias** (✓), **`Padrão`**, **`Diagnóstico`**.

---

## 5. Monitor IA

### 5.1 `TELAS/MONITOR DE IA.png` + `Captura de tela 2026-08-17 173015.png` [QT] — topo

- Header: ícone de robô em quadrado escuro; H1 **"Monitor IA"**; subtítulo
  **"Cadastre e gerencie Monitores IA (Personas)"**; busca **"Buscar Monitores IA..."**;
  campainha com ponto vermelho.
- **4 KPIs**:
  | Ícone | Valor | Rótulo | Sub-rótulo |
  |---|---|---|---|
  | robô azul | **18** | Total de Monitores IA | 18 ativos, 0 inativos |
  | check verde | **18** | Ativos | Prontos para uso |
  | relógio amarelo | **0** | Em Configuração | Ainda não ativados |
  | tendência roxo | **17** | Campanhas Cobertas | Escopo configurado |
- **Seção "Monitores IA Recentes"** — subtítulo **"Selecione um monitor para ações
  rápidas"**; à direita botão **"Ver todos →"**.
  Grade de 3 cards. Cada card, centralizado:
  - **Avatar circular** (foto real da persona, ou ícone de robô em quadrado roxo-claro).
  - **Nome** em H3: `Lojas Avenida` · `Análises VERO IA` · `Vero Churn`.
  - Chip **`Ativo`** (verde-claro).
  - Duas linhas de contexto em cinza: cliente e campanha —
    `Grupo Avenida` / `Telefone Grupo Avenida`; `Vero` / `Vero Churn`;
    `Vero` / `Vero Churn - Telefone`.
  - Três botões de largura total, empilhados:
    1. **"⚙ Configurar"** — **azul sólido**, texto branco.
    2. **"⤒ Subir Gravação"** — branco com borda.
    3. **"📊 Ver Avaliações"** — branco com borda.

### 5.2 `TELAS/MONITOR DE IA (2).png` + `Captura de tela 2026-08-17 173022.png` [QT] — base

- **Card "Ações Rápidas"** (ícone de robô no título), subtítulo **"Acesse rapidamente as
  principais funcionalidades"**. **7 tiles** quadrados (ícone colorido + rótulo):
  | Ícone/cor | Rótulo |
  |---|---|
  | prancheta azul | **Cadastro** |
  | `+` verde | **Novo Monitor** |
  | upload roxo | **Upload** |
  | raio amarelo/laranja | **Automação** |
  | documento laranja | **Fila de Processamento** |
  | prancheta-check teal | **Avaliações** |
  | tendência verde | **Resultados** |

### 5.3 `Captura de tela 2026-08-17 170229.png` [QT] — Avaliações IA (lista)

- Header: botão **"←"**; ícone de prancheta; H1 **"Avaliações IA"**; subtítulo
  **"Visualize os formulários preenchidos pelo Monitor IA"**; botões **"⤓ Exportar"** e
  **"⟳ Atualizar"**.
- **4 KPIs** (número à direita do icon-tile):
  | Ícone | Valor | Rótulo |
  |---|---|---|
  | prancheta teal | **46** | Total de Avaliações |
  | gráfico azul | **0.0** | Nota Média |
  | alvo roxo | **68.9%** | Confiança Média |
  | tendência verde | **0** | Com Conceito |
- **Barra de filtros** (card branco, uma linha): input com lupa
  **"Buscar por nome do arquivo..."**; select **"Análises VERO IA"** (ícone de robô);
  select **"Todos os Formulários"** (ícone de documento); select **"Todos os Clientes"**
  (ícone de pessoas); select **"Todas as Campanhas"** (ícone de alvo); ícone de
  calendário; date **`dd/mm/aaaa`**; texto **"até"**; date **`dd/mm/aaaa`**.
- **Seção "Avaliações (46)"** — subtítulo **"Lista de formulários preenchidos
  automaticamente pela IA"**.
- **Tabela** — header sem fundo colorido (cinza-claro), colunas:
  `Arquivo` | `Persona` | `Formulário` | `Nota` | `Confiança` | `Duração` | `Data` | `Ações`
  - **Arquivo**: ícone de prancheta teal + nome truncado (`291526701_oloswebrtcagenti...`)
    e, abaixo, o código monoespaçado do registro (`MIA-20260814-0010`).
  - **Persona**: ícone de robô + nome (`Análises VERO IA`).
  - **Formulário**: `TESTE - Analises VER...` (truncado).
  - **Nota**: chip arredondado (fundo rosado, texto laranja) **`0.0`**.
  - **Confiança**: percentual **colorido por faixa** — `85%` verde, `75%` amarelo,
    `66%` amarelo, `63%` amarelo.
  - **Duração**: `6:49`, `10:15`, `1:16`, `5:05`, `2:03`, `3:14`.
  - **Data**: ícone de calendário + `14/08/2026`, `23/07/2026`.
  - **Ações**: link **"👁 Ver"** e link **"🗑 Excluir"** (vermelho).
  - Códigos visíveis: `MIA-20260814-0010`, `MIA-20260723-0061`, `MIA-20260723-0060`,
    `MIA-20260723-0059`, `MIA-20260723-0058`, `MIA-20260723-0057`.

### 5.4 Modal **"Detalhes da Avaliação IA"** — 8 prints [QT]

Modal centralizado, fundo branco, cantos arredondados, backdrop escuro. Header simples
(sem gradiente): ícone de prancheta-check + título **"Detalhes da Avaliação IA"** + chip
cinza-claro com o código **`MIA-20260814-0007`**; botão **✕** no canto direito.
O corpo tem **barra de rolagem própria**.

#### `170105.png` — topo do modal
- **4 mini-cards** (card branco com borda, rótulo cinza pequeno + valor grande):
  | Rótulo | Valor |
  |---|---|
  | `Persona` | **Lojas Avenida** |
  | `Nota` | **0.00** |
  | `Confiança` | **78%** (com ícone `?` de ajuda ao lado) |
  | `Duração` | **1:49** |
- **Card "Gravação"** — player de áudio: botão **▶**, tempo atual **`0:00`**, barra de
  progresso cinza, tempo total **`1:49`**, ícone de alto-falante, **slider de volume azul
  com knob roxo**, e rótulo de velocidade **`1x`**.
- **Card "Transcrição"** (ícone de documento) — caixa com borda, texto **monoespaçado**,
  rolagem própria. Falantes rotulados **`SPEAKER_00:`** / **`SPEAKER_01:`**, em azul.
  Conteúdo transcrito literal:
  ```
  SPEAKER_01: Alô?
  SPEAKER_00: Alô, bom dia, é Kleber?
  SPEAKER_00: Alô, Kleber?
  SPEAKER_01: Isso, é Kleber.
  SPEAKER_00: Tudo bem, Kleber?
  SPEAKER_00: Me chamo Gabriela, sou representante financeira do Grupo Avenida.
  SPEAKER_00: Sim.
  SPEAKER_00: O motivo do contato é que consta no nosso sistema uma fatura em aberto de
              julho do ano de 2024.
  ```

#### `170114.png` — Observações da IA + Resumo
- **Card "Observações da IA"** (ícone de robô) — parágrafo único, com trechos separados
  por `|`. Texto literal:
  > "Apresentação e exposição do débito e sondagem realizadas adequadamente. Não foi
  > possível comprovar na transcrição a confirmação formal de nome completo nem
  > comunicação sobre gravação. | Agente confirmou valor e data de pagamento, mas não
  > realizou negociação gradativa nem argumentação sobre benefícios ou consequências;
  > informações sobre benefícios/risco ausentes. | Operadora conduziu a negociação e
  > realizou encerramento cordial, colocando-se à disposição. Não houve orientação ao
  > 0800/site e não houve confirmação/atualização de WhatsApp; não foram identificadas
  > informações incorretas na transcrição. | Atendimento cordial e com confirmação de
  > acordo e envio de boleto; porém houve falha na confirmação completa do e-mail
  > (informação incompleta). Não foi possível avaliar a tabulação pelo conteúdo da
  > transcrição. | Ambos os critérios avaliados conformes com base na transcrição:
  > atendimento iniciado prontamente e encerramento com despedida, sem indícios de
  > desconexão injustificada ou omissão."
- **Card "Respostas da Avaliação"** — H2 grande + sub-linha **"Formulário: Grupo Avenida"**.
- **Card "Resumo de Conformidade"** — 4 números grandes coloridos em linha:
  | Valor | Cor | Rótulo |
  |---|---|---|
  | **19** | verde | Conformes |
  | **3** | vermelho | Não Conformes |
  | **0** | laranja | Não Aplicáveis |
  | **22** | preto | Total |

#### `170120.png` / `170126.png` — Respostas e Avaliações + seção ABERTURA
- H2 **"Respostas e Avaliações"**.
- **Banner de seção**: faixa larga com **gradiente azul-claro → lilás**, cantos
  arredondados, título em negrito escuro — **"ABERTURA"**.
- **Card de critério** (branco, borda cinza, cantos arredondados):
  - **Nome do critério** em H3: **"Saudação, Apresentação e Identificação da Empresa"**;
    no canto direito o **badge de resultado**: **`Conforme`** (pílula verde-clara,
    borda verde, texto verde).
  - Linha cinza pequena: `Descrição: Alô, xxx (cliente)? Me chamo (operador). Falo da
    assessoria financeira Grupo DDM, representante das lojas Avenida.`
  - Linha: **`Resposta:`** + valor (`Conforme`).
  - **Bloco "Evidência da IA (trecho da transcrição)"** — caixa **lilás/roxo-clara** com
    borda roxa, ícone de aspas roxo no título; à direita chip **`Confiança: 90%`**
    (fundo lilás, texto roxo). Corpo em *itálico* entre aspas:
    *"Me chamo Gabriela, sou representante financeira do Grupo Avenida."*
  - **Bloco "Notas da IA (raciocínio)"** — caixa **laranja-clara** com borda laranja,
    ícone de cérebro laranja no título. Corpo: "Operadora se apresentou e identificou a
    empresa conforme esperado."
  - Rodapé do card: **`Peso: 9 pts`** — rótulo em cinza-negrito, valor em **laranja**.

#### `170132.png` — mais critérios de Abertura + início de Negociação
- Critério **"04 – Confirmação de dados"** — badge **`Conforme`**.
  `Descrição: Posso falar com (nome e sobrenome)? Observação: Não considerar se, na
  abertura, o operador chamou o cliente pelo nome e o mesmo confirmou.`
  **`Resposta: Diagnóstico`**. Só bloco de **Notas da IA**: "Não há frase explícita na
  transcrição perguntando 'Posso falar com (nome e sobrenome)?' — não é possível avaliar
  com a evidência disponível." · **`Peso: 4 pts`**.
- Critério **"Gravação"** — badge **`Conforme`**. Descrição: "Informar que a ligação está
  sendo gravada." **`Resposta: Diagnóstico`**. Notas da IA: "Não há informação na
  transcrição indicando que a ligação foi informada como gravada; não é possível comprovar
  a comunicação de gravação." · **`Peso: 7 pts`**.
- **Banner de seção "Negociação"** (mesmo gradiente azul→lilás).
- Critério **"Apresentação do débito"** — badge **`Conforme`**. Descrição: "Apresentou o
  motivo do contato informando que é para falar sobre o débito referente ao cartão xxx.
  O débito encontra-se em atraso desde o dia (data), totalizando o saldo em aberto de
  R$ xxx, corrigido com multas e juros." **`Resposta: Conforme`**.

#### `170139.png` — Sondagem + Negociação gradativa
- Critério **"Apresentação do débito"** (continuação): Notas da IA: "Operadora apresentou
  claramente o motivo do contato e o débito em aberto." · **`Peso: 17 pts`**.
- Critério **"Sondagem"** — badge **`Conforme`**. Descrição: "Sondou particularidades que
  possam contribuir para o aceite do acordo, utilização de perguntas de acordo com o
  diálogo." **`Resposta: Conforme`**. Evidência da IA (**Confiança: 90%**):
  *"O senhor conseguiu fazer algum acordo para a aplicação dessa fatura? Esse pagamento
  você conseguiria participar talvez no dia 10 ou dia 15?"* Notas da IA: "Operadora fez
  perguntas que sondam a possibilidade de acordo e disponibilidade de pagamento."
  · **`Peso: 5 pts`**.
- Critério **"Negociação gradativa"** — badge **`Não Conforme`** (pílula vermelha-clara,
  borda vermelha, texto vermelho). Descrição (com markdown vazado do prompt):
  `### 15 – Negociação Gradativa **Descrição:** Apresentar inicialmente a proposta para
  pagamento à vista. Em caso de recusa, compreender a condição do cliente e,
  gradativamente, apresentar alternativas de parcelamento que possibilitem a
  regularização do débito, buscando sempre uma condição que o cliente tenha possibilidade
  de cumprir e visando o fechamento do acordo.`
  **`Resposta: Não conforme`**. Evidência da IA (**Confiança: 80%**): *"Cleber, o valor
  para a extensão da sua fatura é R$195. Esse pagamento você conseguiria participar..."*

#### `170146.png` — Argumentação + Procedimento
- (continuação) Notas da IA: "Agent ofereceu um único valor e perguntou data de pagamento;
  não apresentou negociação gradativa com alternativas de parcelamento." · **`Peso: 15 pts`**.
- Critério **"Argumentação"** — badge **`Não Conforme`**. Descrição: "Com base no discurso
  do "cliente", fez colocações pertinentes, argumentando em prol de conduzir o contato
  rumo ao aceite do mesmo? Neste ponto será avaliada a capacidade do agente em mostrar as
  características x benefícios de nosso negócio. Exemplo: O valor do acordo à vista está
  com desconto de 20%, de "R$ xx,xx" o valor vai para "R$ yy,yy"."
  **`Resposta: Não conforme`**. Evidência da IA (**Confiança: 60%**):
  *"Cleber, o valor para a extensão da sua fatura é R$195."* Notas da IA: "Não houve
  argumentação de características/benefícios da proposta (descontos, comparação de valores
  ou justificativas para adesão)." · **`Peso: 10 pts`**.
- **Banner de seção "Procedimento"**.
- Critério **"Benefícios da Negociação"** — badge **`Conforme`**. Descrição:
  `### 06 – Benefícios da Negociação **Descrição:** Apresentar ao cliente os principais
  benefícios da regularização do débito, destacando a possibilidade de retirada da
  restrição do CPF/CNPJ dos órgãos de proteção ao crédito, evitar ações judiciais,
  protestos e ligações recorrentes, além de possibilitar a recuperação do acesso a
  crédito, financiamentos e cartões.` **`Resposta: Diagnóstico`**.

#### `170201.png` — seção NCG (com descrição no banner) + Eliminatória
- Critério anterior fecha com **`Peso: 3 pts`**.
- **Banner de seção "NCG - Não conformidade Grave"** — mesmo gradiente, mas com **título
  E descrição**: "Caracteriza-se como uma falha crítica cometida durante o atendimento,
  capaz de comprometer a qualidade, a segurança, a negociação ou a experiência do cliente."
- Critério **"Informações erradas"** — badge **`Conforme`**. Descrição: "Não passou as
  informações corretamente, conforme descrito nas ferramentas de suporte (Roteiro de
  atendimento, etc)?" **`Resposta: Conforme`**. Evidência da IA (**Confiança: 70%**):
  *"O motivo do contato é que consta no nosso sistema uma fatura em aberto de julho do ano
  de 2024."* Notas da IA: "Não há na transcrição indicação de informação incorreta; as
  informações fornecidas estão coerentes no contexto."
  **Rodapé do card: chip `⚠️ Eliminatória`** — pílula rosada com ícone de alerta laranja e
  texto vermelho/laranja (substitui o "Peso" nos critérios eliminatórios).
- Critério **"Informações incompletas"** — badge **`Não Conforme`**. Descrição: "Informou
  todos os itens descritos no "check list / roteiro" contido no Acompanhamento?"
  **`Resposta: Não conforme`**. Evidência da IA (**Confiança: 70%**): *"Por favor, poderia
  só me confirmar o seu e-mail? Poderia só me confirmar o seu e-mail? Por favor,..."*

> **Valores possíveis de `Resposta:`** observados: `Conforme`, `Não conforme`,
> `Diagnóstico`, `nao` (na Ficha de Monitoria humana).
> **Regra visual**: quando não há trecho de transcrição que sustente o critério, o bloco
> **Evidência da IA é omitido** e só aparece **Notas da IA**.

---

## 6. Upload de Arquivos (Monitor IA)

### 6.1 `Captura de tela 2026-08-17 154952.png` [QT]

- Header: ícone de upload em quadrado roxo-claro; H1 **"Upload de Arquivos"**; subtítulo
  **"Envie gravações ou conversas de chat para análise automatizada"**; botões
  **"Ver Histórico"** e **"← Voltar"**.
- **Card "Configuração do Lote"** (ícone de robô) — subtítulo **"Selecione o Monitor IA e
  o formulário para análise das gravações"**. 3 campos em linha:
  - `Monitor IA` — select, valor **"Lojas Avenida - Telefone Grupo Avenida"**.
  - `Formulário` — select, placeholder **"Selecione..."**.
  - `Nome do Lote (opcional)` — input, placeholder **"Ex: SAC Janeiro 2026"**.
- **Card "Arquivos"** (ícone de fone) — subtítulo **"Arraste arquivos ou clique para
  selecionar (MP3, WAV, TXT, PDF, CSV, Excel...)"**. Dropzone tracejada com ícone de
  pasta aberta, H3 **"Arraste arquivos aqui ou clique para selecionar"** e linha
  **"Audio (MP3, WAV...), Chat (TXT, PDF) ou Estruturado (CSV, Excel). Máximo
  recomendado: 500 arquivos por lote"**.
- Botões: **"Cancelar"** (branco) e **"⤒ Iniciar Upload (0 arquivos)"** (laranja
  **desabilitado**, opacidade reduzida).

### 6.2 `Captura de tela 2026-08-17 155032.png` [QT] — bloco "Como funciona"

Card com ícone `(!)` e título **"Como funciona:"**, lista numerada literal:

1. Os arquivos serão enviados para o servidor
2. Gravações de áudio serão transcritas automaticamente
3. Arquivos de chat (TXT) são usados diretamente, sem transcrição
4. PDFs são processados automaticamente — texto extraído ou OCR para imagens
5. Arquivos estruturados (CSV/Excel) são parseados usando o Template de Conversa selecionado
6. A IA preencherá o formulário baseado no conteúdo
7. As avaliações ficarão em "Revisão" para aprovação humana

E, abaixo: **"Você pode fechar esta página após iniciar - o progresso aparecerá no painel
flutuante."**

### 6.3 `155003.png` + `155010.png` [QT] — dropdown `Monitor IA` aberto

Popover branco, item selecionado com **✓** à direita, item sob o mouse em laranja.
Lista completa (formato `Persona - Campanha`):

`Lojas Avenida - Telefone Grupo Avenida` (✓), `Análises VERO IA - Vero Churn`,
`Vero Churn - Vero Churn - Telefone`, `Vero Pré Churn - Pré Churn - Telefone`,
`Vero Ativo - Vero Ativo`, `IA - FIERGS ATIVO - Ativo - Prospecção`,
`Cobrança Receptivo - Telefone Receptivo`, `IA CRUZEIRO DO SUL - Telefone Ativo`,
`Yduqs IA - Telefone Ativo`, `Monitor Ânima IA - Telefone ativo`,
`Cobrança Isaac IA - Isaac Ativo - Telefone`,
`Monitor Empresarial - Cobrança - Telefone ativo Empresarial`,
`IA FIRJAN - TELEFONE ATIVO - Monitorias IA - Telefone Ativo`,
`IA FIRJAN - Telefone Receptivo - Monitorias IA - Telefone Receptivo`,
`IA FIRJAN - MONITORIAS IA`, `Monitor Cobrança | Educacional | - Telefone Ativo`,
`Monitor Cliente teste 2 - Teste receptivo`,
`Monitor teste Rapha - Campanha teste Raphael`.
(Chevron de rolagem no fim da lista.)

### 6.4 `155022.png` [QT] — dropdown `Formulário` aberto

Com `Monitor IA` = **"Análises VERO IA - Vero Churn"**, o select `Formulário` abre com
**uma única opção**: **"TESTE - Analises VERO IA ✓"** (destacada em laranja).
Isso confirma que **a lista de formulários é filtrada pelo Monitor IA escolhido**.

---

## 7. Transcrições

### 7.1 `TELAS/TRANSCRIÇÕES.png` [QT] — estado vazio

- H1 **"Transcrições"**; subtítulo **"Suba gravações de áudio, acompanhe a transcrição e
  exporte o resultado em JSON."**
- **Card "Enviar gravações"** (ícone de upload): input de arquivo nativo
  (**"Escolher arquivos"** + **"Nenhum arquivo escolhido"**), checkbox **marcado**
  **"Transcrever automaticamente"**, botão **"Enviar"** (laranja, **desabilitado**).
- **Card "Gravações (0)"** (ícone de fone). Barra de controles: input
  **"Buscar por nome do arquivo..."**; select **"Todos os status"**; botão
  **"⟳ Atualizar"**; à direita botão **"⤓ Exportar JSON (recorte atual)"**
  (desabilitado).
- **Tabela** — header sem cor de fundo, colunas:
  `Arquivo` | `Enviada em` | `Duração` | `Origem` | `Transcrição` | `Ações`
- **Estado vazio** (linha centralizada, texto esverdeado/cinza):
  **"Nenhuma gravação encontrada. Envie áudios acima para começar."**

---

## 8. Feedback

### 8.1 `TELAS/FEEDBACK.png` + `Captura de tela 2026-08-17 173110.png` [QT] — Lista de Feedbacks

- Header: H1 **"Lista de Feedbacks"**; subtítulo **"Gerencie e filtre os feedbacks do
  sistema"**; à direita botão **"⟳ Atualizar"**.
- **Barra "Filtros de Busca"** — card branco com ícone de funil + título
  **"Filtros de Busca"**; à direita link **"Limpar"** e chevron para baixo (acordeão
  fechado).
- **5 cards de situação** (clicáveis, funcionam como filtro). Cada card: ícone + rótulo na
  primeira linha, **número grande colorido** abaixo. O card **selecionado** tem **borda
  roxa**.
  | Ícone | Rótulo | Valor (TELAS) | Valor (173110) | Cor do número |
  |---|---|---|---|---|
  | prancheta | **Pendente** | 142 | 170 | laranja |
  | mão/assinatura | **Assinatura** | 134 | 139 | azul |
  | check verde | **Finalizadas** | 218 | 230 | verde |
  | balão | **Revisão** | 0 | 0 | roxo |
  | tendência | **Todos** | 494 | 539 | roxo (**card selecionado**) |
  - O card **Finalizadas** tem uma **sub-linha** cinza:
    **"Concluídas: 201 · Justificadas: 17"** (TELAS) / **"Concluídas: 213 · Justificadas: 17"** (173110).
  - Cada card tem um pequeno **ícone de status no canto superior direito**
    (info / relógio / check / documento / tendência).
- **Nota abaixo dos cards** (cinza, uma linha):
  **"A tabela exibe as 200 monitorias mais recentes do filtro atual — o total é 494
  (refletido nos cards). Refine os filtros (período, cliente, avaliador) para alcançar as
  demais."**
- **Tabela** com **header laranja e texto branco**, colunas na ordem exata:
  `ID` | `Data avaliação` | `Status feedback` | `Superior` | `Avaliador` | `Data contato` |
  `Cliente` | `Campanha` | `Cód. gravação`
  - **ID**: código monoespaçado `QA-26-000629` + **botão de copiar** ao lado.
  - **Status feedback**: chip **azul sólido** com ícone de prancheta e texto branco
    **"Feedback Pendente"**.
  - Amostra de linhas (TELAS/FEEDBACK.png):
    | ID | Data avaliação | Superior | Avaliador | Data contato | Cliente | Campanha | Cód. gravação |
    |---|---|---|---|---|---|---|---|
    | QA-26-000629 | 14/08/2026, 10:26 | Luciana Gonçalves | Dayara Jovita | 06/08/2026 | Educacional | Telefone | recusa |
    | QA-26-000628 | 14/08/2026, 10:33 | Fabricio da Silva Magalhaes | Roberta Bruna Pereira Diniz | 12/08/2026 | FIRJAN | Canais Online (E-mail, Chat e WhatsApp) | 00149001 |
    | QA-26-000627 | 14/08/2026, 10:18 | Luciana Gonçalves | Dayara Jovita | 06/08/2026 | Cruzeiro do Sul | Telefone Ativo | Recusa |
    | QA-26-000626 | 14/08/2026, 10:18 | Fabricio da Silva Magalhaes | Roberta Bruna Pereira Diniz | 11/08/2026 | FIRJAN | Canais Online (E-mail, Chat e WhatsApp) | 00148299 |
    | QA-26-000623 | 13/08/2026, 16:23 | Denise Esquivel | Roberta Bruna Pereira Diniz | 12/08/2026 | FIRJAN | E - Saúde Digital | Telemedicina com Morgana M… |
    | QA-26-000621 | 13/08/2026, 15:50 | Fabricio da Silva Magalhaes | Roberta Bruna Pereira Diniz | 11/08/2026 | FIRJAN | Odontologia e Massagem relaxante (Offline) | 00148100 |
    | QA-26-000620 | 13/08/2026, 14:14 | Fabiana Azevedo | Fernanda Alves | 03/08/2026 | Cruzeiro do Sul | Telefone Ativo | 22892136830 |
    | QA-26-000619 | 13/08/2026, 14:05 | Fabiana Azevedo | Fernanda Alves | 03/08/2026 | Ânima | Telefone ativo | 07438301729 |
    | QA-26-000611 | 14/08/2026, 10:05 | Luciana Gonçalves | Dayara Jovita | 11/08/2026 | Cruzeiro do Sul | Telefone Ativo | Promessa |
  - Amostra de linhas (173110): `QA-26-000688` … `QA-26-000675`, com superiores
    `Lucila Flores`, `Denise Esquivel`, `Gustavo Alves`, `Fábio Batista Oliveira`;
    avaliadores `Alenilton da Costa`, `Roberta Bruna Pereira Diniz`, `Fernanda Alves`;
    clientes `Vero`, `FIRJAN`, `Educacional`, `FIERGS`; campanhas `Ativo 20 a 44`,
    `E - Saúde Digital`, `Telefone`, `Telefone Ativo`, `Ativo - Prospecção`.
    Cód. gravação com telefones formatados: `(21) 98…`, `(51) 99…`.

### 8.2 Modal **"FICHA DE MONITORIA"** — 4 prints [QT]

Aberto ao clicar numa linha da Lista de Feedbacks. Modal largo (~90% da largura), cantos
arredondados, backdrop escurecido. **Rodapé fixo** e **corpo com rolagem própria**; o
**header em gradiente e o player de áudio permanecem fixos** enquanto o corpo rola.

#### Header — **gradiente diagonal azul (esquerda) → roxo/violeta (direita)**, texto branco

Linha 1:
- Ícone de documento em quadrado **branco** arredondado.
- **Título**: **"FICHA DE MONITORIA – Ativo 20 a 44"** (caixa alta, negrito, grande) —
  o sufixo é o nome da **campanha**.
- Chip **branco** com texto escuro: **"Feedback Pendente"**.
- Três botões translúcidos (fundo branco ~20% de opacidade, texto branco, com ícone):
  **"🕘 Histórico"** · **"✎ Edições"** · **"💬 Feedback"**.
- Botão **✕** no canto direito.

Linha 2 (botões translúcidos menores):
- **"⤓ Exportar PDF"** · **"⌃ Recolher dados"**.

Linha 3:
- Texto **"Avaliação - Visualizar e Dar Feedback"** · separador `•` · `ID:` +
  código monoespaçado **`QA-26-000688`** + **botão de copiar**.

**Faixa de métricas 1** (5 colunas, rótulo pequeno em cima, valor em negrito embaixo,
centralizado):
| `Cliente` | `Campanha` | `Cód. Gravação` | `Score` | `Duração` |
|---|---|---|---|---|
| **Vero** | **Ativo 20 a 44** | **07277332733** | **88.00** (com ícone de documento ao lado) | **8:28** |

**Divisória horizontal translúcida.**

**Faixa de métricas 2** (grade 4×2 — rótulos em CAIXA ALTA pequena, valores em negrito):
| `USUÁRIO AVALIADO` | `MONITOR` | `FORMULÁRIO` | `CATEGORIA` |
|---|---|---|---|
| **Kleyton Marlon Abilio Ferreira de Lima** | **Alenilton da Costa** | **Avaliação de atendimento Vero - SP - A…** (truncado) | **Padrão** |

| `DATA DA AVALIAÇÃO` | `DATA DO CONTATO` | `PRAZO FEEDBACK` | `PRAZO CONTESTAÇÃO` |
|---|---|---|---|
| **17/08/2026, 15:50** | **17/08/2026, 15:41** | **N/A** | **N/A** |

#### Player de áudio (faixa fixa, logo abaixo do header)

Card branco com borda: botão **▶**, tempo **`0:00`**, barra de progresso cinza, tempo total
**`4:37`**, ícone de alto-falante, **slider de volume azul com knob roxo**, rótulo **`1x`**.

#### Corpo — `173120.png`: bloco **"Feedback Global sobre a Avaliação"**

Card com **fundo azul-claro** e borda azul, ícone de balão no título:
- Campo `Tipo de Feedback *` — select com placeholder **"Selecione o tipo"**.
- Campo `Comentários Detalhados * (mín. 20 caracteres)` — textarea com placeholder
  **"Descreva seu feedback sobre a avaliação como um todo..."**, redimensionável.

#### Corpo — `173129.png`: cartões de pessoas (grade 2 colunas)

- Card **"Avaliado"**: `Nome:` **Kleyton Marlon Abilio Ferreira de Lima** ·
  `Email:` **kleyton.m@grupoddm.com.br**
- Card **"Avaliador"**: `Monitor:` **Alenilton da Costa** ·
  `Email:` **alenilton.costa@grupoddm.com.br**
- (Abaixo, começando) Card **"Supervisor"** e Card **"Cabeçalho da Ficha"**.

#### Corpo — `173148.png`: Supervisor / Cabeçalho / Resumo

- Card **"Supervisor"**: `Supervisor:` **Lucila Flores** ·
  `Email:` **lucila.flores@grupoddm.com.br**
- Card **"Cabeçalho da Ficha"**: `CPF:` **N/A**
- Card **"Resumo de Conformidade"** — 4 números grandes em linha:
  | **27** verde `Conformes` | **3** vermelho `Não Conformes` | **0** laranja `Não Aplicáveis` | **30** preto `Total` |

#### Corpo — `173157.png`: seções e critérios

- **Banner de seção**: faixa com **gradiente azul-claro → lilás**, título em negrito
  **"Abertura"** (aqui em caixa normal, não alta) + **descrição** abaixo em texto menor:
  "Avalia se o operador inicia o atendimento de forma cordial e profissional,
  identifica-se corretamente, informa o motivo do contato, realiza a confirmação de dados
  quando aplicável e estabelece uma comunicação clara e acolhedora desde o início da
  ligação."
- **Card de critério**:
  - H3 **"Prontidão"**; badge à direita **`Não Conforme`** (pílula vermelha-clara).
  - Enunciado em cinza: **"O operador atendeu a ligação em até 3s?"**
  - **`Resposta: nao`**
  - **Bloco "Observação do Monitor"** — caixa **azul-clara** com borda azul, título em
    negrito e corpo: **"operador demora 9 segundos para falar com o cliente"**.
  - Abaixo (parcialmente visível) um bloco **laranja-claro** de **"Anexos (1)"** com ícone
    de clipe.

#### Rodapé fixo do modal (alinhado à direita)

- Botão **"⚠ Contestar Avaliação"** — **laranja sólido**, texto branco, com ícone de alerta.
- Botão **"Fechar"** — **cinza-escuro/preto sólido**, texto branco.

---

## 9. Contestações

### 9.1 `TELAS/GESTAO ADM.png` [QT] — Contestações → Gestão ADM

- **3 cards de situação** no topo (número grande abaixo do rótulo). O card **selecionado**
  tem **borda laranja**:
  | Rótulo | Valor |
  |---|---|
  | **Todas** | **16** (**selecionado**, borda laranja) |
  | **Pendentes** | **0** |
  | **Julgadas** | **21** |
- **Card "Avaliações com Contestações"** — à direita do título, chip cinza com o total: **16**.
- **Barra de filtros** (3 controles em linha):
  - input **"Buscar por formulário, avaliado ou monitor..."**
  - input **"Buscar por ID (Ex: QA-24-000123 ou 000123)"**
  - select **"Todos os Status"**
- **Tabela** com **header laranja e texto branco**, colunas:
  `ID Monitoria` | `Formulário` | `Campanha` | `Avaliado` | `Monitor` | `Itens Contestados`
  (a última coluna aparece cortada — há rolagem horizontal, provavelmente com colunas de
  ação à direita).
  - **ID Monitoria**: código monoespaçado + **botão de copiar**.
  - **Campanha** e **Monitor** em **texto cinza-claro**; `Formulário` e `Avaliado` em
    texto escuro.
  - **Itens Contestados**: **badge circular/pílula vermelha** com o número (`1`, `2`, `3`).
  - Linhas visíveis:
    | ID Monitoria | Formulário | Campanha | Avaliado | Monitor | Itens |
    |---|---|---|---|---|---|
    | QA-26-000073 | FIRJAN >>> Formulário de monitoria ONLINE (CHAT - WhatsApp - Redes Sociais) | Canais Online (E-mail, Chat e WhatsApp) | Lorena Saddock de Sá Lopes | Roberta Bruna Pereira Diniz | 2 |
    | QA-26-000132 | FIRJAN >>> Formulário de monitoria TELEFONE RECEPTIVO | Telefone Receptivo | Marcela Vasconcelos Joaquim Alves | Roberta Bruna Pereira Diniz | 3 |
    | QA-26-000071 | FIRJAN >>> Formulário de monitoria ONLINE (CHAT - WhatsApp - Redes Sociais) | Canais Online (E-mail, Chat e WhatsApp) | Pâmella de Almeida Moreira Ferreira | Roberta Bruna Pereira Diniz | 1 |
    | QA-26-000091 | FIRJAN >>> Formulário de monitoria TELEFONE RECEPTIVO | Telefone Receptivo | Laís da Silva Ferreira | Roberta Bruna Pereira Diniz | 1 |
    | QA-26-000370 | FIRJAN >>> Formulário WhatsApp ODONTO CRS | Odontologia e Massagem relaxante (Offline) | Roseli Honorato dos Santos | Roberta Bruna Pereira Diniz | 1 |
    | QA-26-000384 | Formulário ISAAC - IA | Isaac Ativo - Telefone | ALESSANDRA MENDES PEREIRA | Fernanda Alves | 2 |
    | QA-26-000001 | Formulário teste 2 | Teste receptivo | Operador teste | Raphael Outstand | 1 |
    | QA-26-000119 | FIRJAN >>> Formulário de monitoria TELEFONE RECEPTIVO | Telefone Receptivo | Marcela Vasconcelos Joaquim Alves | Roberta Bruna Pereira Diniz | 1 |
    | QA-26-000015 | FIRJAN >>> Formulário de monitoria TELEFONE RECEPTIVO | Telefone Receptivo | Adriana Monteiro Lima | Roberta Bruna Pereira Diniz | 1 |
    | QA-26-000123 | Avaliação IA Cobrança Empresarial - Comportamental | Telefone ativo Empresarial | Leticia thaniely Teixeira Izidoro | Dayara Jovita | 1 |
    | QA-26-000327 | Cobrança - ISAAC | Isaac Ativo - Telefone | Rafaelle brito da costa | Fernanda Alves | 1 |
    | QA-26-000267 | Cobrança - ISAAC | Isaac Ativo - Telefone | Valquiria carvalho de Andrade | Fernanda Alves | 1 |
    | QA-26-000517 | Formulário Yduqs | Telefone Ativo | Ana Beatriz lemos alves | Fernanda Alves | 2 |
- Sidebar: submenu de `Contestações` aberto com **`+ Avaliações Candidatas`** e
  **`Gestão ADM`** (ativo).

---

## 10. Relatórios

### 10.1 `TELAS/RELATORIOS.png` [QT]

Layout de **três colunas**: sidebar do app · **lista de tipos de relatório** · **painel do
relatório selecionado**.

#### Coluna "Tipos de Relatórios"
- Título **"Tipos de Relatórios"** + subtítulo **"Selecione um relatório"**.
- Lista rolável de cards. Cada card: **nome** + chip cinza **`Sistema`** + (opcional)
  **estrela** — **estrela laranja preenchida** = favorito; **estrela cinza vazada** = não
  favorito. Abaixo, descrição em 2 linhas.
- O card **selecionado** tem **fundo laranja-claro, borda laranja e texto laranja**.
- Itens completos, na ordem:
  | Nome | Chip | Favorito | Descrição |
  |---|---|---|---|
  | **Base de Monitoria** | Sistema | ★ laranja | Relatório completo de avaliações com todos os campos |
  | **Base de Monitoria IA** | Sistema | ☆ | Monitorias realizadas pelo Monitor IA (avaliações automáticas via inteligênc… |
  | **Usuários** | Sistema | ★ laranja | Listagem completa de usuários |
  | **Fichas de Avaliação** | Sistema | ☆ | Detalhamento de avaliações por critério |
  | **Contestações** | Sistema | ☆ | Relatório de contestações abertas e resolvidas |
  | **Monitoria Analítico** | Sistema | ★ laranja | Consolidado de monitorias por período |
  | **Analítico de Calibra…** | Sistema | ☆ | Dados de sessões de calibração |
  | **Pesquisa de Satisfa…** | Sistema | ☆ | Respostas dos operadores sobre feedbacks |
  | **Justificativas de Av…** | Sistema | ☆ | Critérios com justificativas do monitor |
  | **Fichas Excluídas/Av…** | Sistema | ☆ | Auditoria de exclusões com autor, data, motivo e dados da avaliação… |
  | **Ausência de Monit…** | Sistema | ★ laranja | Justificativas de por que operadores não foram avaliados no período |
  | **Monitoria Editada (…** | Sistema | ☆ | Trilha de auditoria de edições realizadas em avaliações |

#### Painel do relatório
- **Breadcrumb**: `Avaliações` › **`Relatórios`**.
- **H1 "Base de Monitoria"** + **bolinha verde** (indicador de disponível).
- Sub-linha com ícone de calendário: **"Aguardando filtros para consultar"**.
- À direita: link **"⟳ Limpar Filtros"**.
- **Stepper horizontal de 3 passos**:
  1. ✅ (círculo verde com check) **"Relatório selecionado"** · sub-linha
     `· Base de Monitoria`
  2. **(2)** (círculo azul) **"Definir filtros"** · sub-linha `· Cliente, período, equipe…`
  3. **(3)** (círculo cinza) **"Consultar dados"**
  À direita do stepper, chip azul-claro: **"⚡ Dados são carregados sob demanda"**.
- **Card "Filtros"** (ícone de funil):
  - Chip azul-claro ao lado do título: **"• Aplique um filtro ou use "Carregar tudo""**.
  - À direita: **"0 filtros aplicados"** + chevron (colapsar).
  - Linha de aviso: **"↓ Para evitar carregar toda a base, escolha pelo menos um filtro
    abaixo e clique em `Consultar`."**
  - Campos (grade 3 colunas):
    - `Cliente / Operação` — select **"Todos os Clientes"**
    - `Campanha` — select **"Todas as Campanhas"**
    - `Avaliado` — select **"Todos os Avaliados"**
    - `Categoria` — select **"Todas as Categorias"**
    - `Avaliador / Monitor` — select **"Todos os Avaliadores"**
    - `ID da Monitoria` — input placeholder **"Ex: QA-24-000123 ou 000123"**
    - `Período de Avaliação` — dois inputs date **`dd/mm/aaaa`** com ícone de calendário
  - Linha **"Atalhos:"** com 3 botões: **"Últimos 7 dias"**, **"Últimos 30 dias"**,
    **"Mês atual"**.
  - Rodapé do card: chip laranja-claro **"💡 Combine filtros para consultas mais
    precisas"**; à direita link **"Limpar tudo"**, botão **"⤓ Carregar tudo (sem
    filtros)"** (branco com borda) e botão **"▶ Consultar"** (**roxo sólido**).
- **Linha de resultados**: à esquerda **"Resultados · Aguardando consulta"**; à direita
  botão **"⟳ Atualizar"** (desabilitado), rótulo **"Exportar:"**, botão
  **"Excel"** (verde com ícone de planilha) e botão **"⤓ CSV"**.
- **Estado vazio do resultado** (card grande, centralizado):
  - Ilustração de barras com um funil azul no centro.
  - Chip azul-claro: **"⚡ CARREGAMENTO SOB DEMANDA"**
  - H2 **"Defina os filtros para consultar"**
  - Parágrafo: **"Esta base contém milhares de registros. Para garantir velocidade e
    relevância, aplique pelo menos um filtro e clique em `Consultar`. Para exportar a base
    inteira sem filtros, use `Carregar tudo`."**
  - Botões: **"▶ Consultar"** (roxo), **"▽ Ir para filtros"** (branco),
    **"⤓ Carregar tudo (sem filtros)"** (branco).
  - Abaixo, **3 mini-cards** com ícone: **"Mais rápido"** (raio, "Evita carregar a base
    inteira e…"), **"Mais preciso"** (lupa, "Você vê apenas o recorte que…"),
    **"Exportações enxutas"** (grade, "Excel/CSV gerados só com o…").
- Rodapé do navegador mostra URL:
  `https://app.qualitalk.com.br/dashboard/relatorios/exportacao`.

---

## 11. Administração

### 11.1 `TELAS/PAINEL ADMIN OPERAÇÃO.png` [QT] — aba Operação

- Header: botão **"← Dashboard Principal"**; ícone de escudo; H1 **"Administração L1"**;
  subtítulo **"Gestão de usuários, roles, permissões e operação"**; botão de balão de
  comentário com ponto vermelho no canto direito.
- Card externo com título **"Administração"** e **duas abas** (pílulas em fundo cinza):
  **`Operação`** (ativa, fundo branco) · **`Usuários`**.
- **Card "Funcionalidades de Operação"** (ícone de engrenagem) — grade de **3 colunas**.
  Cada tile: ícone quadrado colorido, **título**, **descrição** em cinza, chevron `>` à
  direita, e chip verde-claro **`Novo`** no canto superior direito quando aplicável.
  | Ícone/cor | Título | Descrição | Novo |
  |---|---|---|---|
  | raio laranja | **Automações** | Gerenciar regras, templates, destinos e execuções automáticas | — |
  | camadas roxo | **Conjuntos de Faixas de Performance** | Configurar faixas de desempenho e prazos de feedback | — |
  | balão azul | **Configurações de Feedbacks** | Configurar prazos em dias e cores para status de feedbacks | — |
  | relógio vermelho | **SLA de Contestações** | Configurar prazos de resposta (SLA) para contestações por campanha | **Novo** |
  | gráfico verde | **Metas Mensais de Monitoria** | Definir e acompanhar metas mensais de monitoria | — |
  | balão roxo | **Categorias de Formulários** | Gerenciar categorias dinâmicas para classificação de formulários | **Novo** |
  | balão laranja | **Justificativas** | Gerenciar motivos de justificativa para ausência de monitoria e feedback | **Novo** |
  | relógio amarelo | **Turnos** | Cadastrar e gerenciar turnos de trabalho | **Novo** |
  | workflow teal | **Ver meu Workflow** | Visualizar o workflow ativo do tenant em modo de visualização | — |
  | bug vermelho | **Bug Reports** | Visualizar bugs reportados pelos usuários do seu tenant | **Novo** |

### 11.2 `TELAS/PAINEL ADMIN USUARIOS.png` [QT] — aba Usuários

- Mesmo header. Abas: `Operação` · **`Usuários`** (ativa).
- **Card "Status do RBAC"** (ícone de "activity") — 4 blocos centralizados, cada um com um
  **círculo verde grande com check**, número e rótulo:
  | Valor | Rótulo |
  |---|---|
  | **214** | Usuários Ativos |
  | **11** | Cargos Cadastrados |
  | **71** | Permissões no Catálogo |
  | **34** | Campanhas Ativas |
- **Card "Funcionalidades de Administração"** (ícone de engrenagem) — grade de 3 colunas:
  | Ícone/cor | Título | Descrição | Novo |
  |---|---|---|---|
  | pessoas azul | **Usuários de DDM** | Convidar usuários, gerenciar status e redefinir senhas | — |
  | gráfico azul | **Relatórios Admin** | Relatórios executivos e auditoria de acesso | — |
  | activity verde | **Sessões e Presença** | Monitorar status de usuários e gerenciar sessões ativas | **Novo** |
  | pergaminho cinza | **Trilha de Auditoria** | Registro de acessos e ações sensíveis (compliance) | **Novo** |
- **Card "Atividade Recente"** (ícone de relógio) — lista de linhas: avatar circular
  laranja com ícone de chave + texto **"fabricio.magalhaes@grupoddm.com.br evaluation
  workflow feedback aplicar evaluation"** e, abaixo, o tempo relativo **"agora"**.

---

## 12. Telas presentes no menu **sem print**

Não há screenshot de: **`Quizzes`** (com submenu), **`Sala de Calibração`**,
**`Calendário`**, e do submenu de **`Dashboard`** e **`Formulários`** (só o pai foi
capturado). Também não há print de **"Cadastro de Formulários"**, **"Iniciar avaliação"**,
**"Ver Histórico"** do upload, nem das telas de **Configurar** do Monitor IA.

---

## 13. Prints do QualiDDM (estado atual — [DDM])

Estes 4 prints não são referência: são o app em construção, e registram **erros reais**.

### 13.1 `Captura de tela 2026-08-17 160711.png` — Upload com erro de `clientId`
- Sidebar QualiDDM: logo **QualiDDM** (laranja/vermelho, com o slogan "Qualidade que
  transforma resultados"), avatar circular laranja **"GO"** + **Gisele Oliveira /
  Administrador**. Menu: `Dashboard`, **`Upload`** (ativo), `Clientes`, `Avaliações`,
  `Formulários` (chevron), `Monitor IA`, `Transcrições`, `Feedback`,
  `Contestações` (chevron), `Relatórios`, `Administração`. Rodapé: **"Sair"** +
  chip **`PROD`** + **v1.5.0**.
- Breadcrumb: `Overview` › **`Upload`**. Busca:
  **"Buscar chamada, operador ou carteira..."**.
- Campos: `Carteira / Monitor IA` = **Ânima**; `Campanha / operação` =
  **Ativo - Prospecção**; `Ficha de avaliacao opcional` = **"Sem ficha - apenas subir
  para fila"**, com hint **"Com ficha, a IA gera avaliacao. Sem ficha, o arquivo fica
  salvo na fila da carteira."**
- Dropzone: **"Arraste arquivos aqui"** / "Áudios MP3, WAV ou M4A e documentos PDF. Envie
  para análise e acompanhe o processamento nesta fila." Botões
  **"+ Selecionar arquivos"** (vermelho sólido) e **"✦ Subir para a fila"** (branco).
- **Alerta de erro** (faixa rosada): **"Envio não concluído"** /
  **"Campo clientId deve ser um identificador numérico."**
- Arquivo na lista: `chat-isaac-acordorealizado.pdf` · `338 KB` · botão ✕.
- Painel lateral **"Fila de processamento"** (badge **"análise IA"**):
  `chat-isaac-acordorealizado.pdf` · **0%** · barra vazia · **"Aguardando envio"**.

### 13.2 `Captura de tela 2026-08-17 162227.png` — Upload com erro de carteira
Idêntico ao anterior, com `Campanha / operação` = **"Monitorias IA - Telefone Ativo"** e
o erro **"Envio não concluído"** / **"Carteira selecionada nao foi encontrada no banco."**

### 13.3 `Captura de tela 2026-08-17 163528.png` — fila concluída
Recorte: botões **"← Voltar"** e **"📄 Abrir resultado"** (desabilitado). Card
**"Fila de processamento"** (badge "análise IA"): `chat-isaac-acordorealizado.pdf` ·
**100%** · barra **verde cheia** · **"Transcrição concluída"**.

### 13.4 `Captura de tela 2026-08-17 172402.png` — Detalhes da Análise IA (vazio)
- Breadcrumb: `Qualidade` › `Resultado IA` › `1`. Sidebar com **`Transcrições`** ativo.
- Eyebrow **"RESULTADO DA IA"** + H1 **"Detalhes da Análise IA"** + sub-linha
  `chat-isaac-acordorealizado.pdf · Ativo - Prospecção`.
- Botões: **"← Voltar ao upload"** e **"Ver fila"**.
- **4 KPIs** com rótulos em caixa alta: `CARTEIRA` = **Ânima**; `NOTA` = **0.00**;
  `CONFIANÇA` = **0%**; `DURAÇÃO` = **N/A**.
- Card **"Resumo da IA"**: **"Análise concluída sem resumo estruturado."** +
  **"A análise antiga foi salva apenas como texto. Reenvie o arquivo para gerar critérios,
  nota e evidências."**
- Card **"Resumo de Conformidade"**: **0 / 0 / 0 / 0** (Conformes / Não Conformes /
  Não Aplicáveis / Total).
- Card **"Transcrição / Conteúdo"**: caixa monoespaçada com **"Sem transcrição salva."**

---

## Lacunas no QualiDDM

Comparação com `qualiddm-app/src/app` (rotas existentes: `/`, `/upload`, `/clientes`,
`/avaliacoes`, `/avaliacoes/[id]`, `/formularios` + `iniciar`/`novo`/`justificativas`/
`monitorias-editadas`/`avaliacoes`, `/monitor-ia`, `/transcricoes`, `/transcricoes/[id]`,
`/feedback`, `/contestacoes/gestao-adm`, `/contestacoes/avaliacoes-candidatas`,
`/relatorios`, `/administracao`, `/administracao/[secao]`, `/login`).

### A. Telas do QualiTalk que **não existem** no QualiDDM

> **FORA DE ESCOPO POR DECISÃO DO PRODUTO (18/08/2026):** **Quizzes**, **Sala de
> Calibração** e **Calendário** **não entram no QualiDDM**. A dona do produto
> (Gisele Oliveira) descartou as três telas explicitamente. Elas continuam listadas
> abaixo apenas como registro do que a ferramenta de referência tem — **não são
> pendência, não são lacuna a fechar, e não devem voltar como sugestão de
> implementação.** O mesmo vale para os itens de menu correspondentes.

| Tela QualiTalk | Situação no QualiDDM |
|---|---|
| **Quizzes** (item de menu com submenu) | **descartada** — fora de escopo por decisão do produto |
| **Sala de Calibração** | **descartada** — fora de escopo por decisão do produto |
| **Calendário** | **descartada** — fora de escopo por decisão do produto |
| **Avaliações IA** (`Monitor IA → Ver Avaliações`, 8 colunas + 4 KPIs próprios) | **ausente** — não há lista de avaliações da IA separada; `/avaliacoes` é a lista humana |
| **Modal "Detalhes da Avaliação IA"** | **ausente como modal**; existe algo próximo em `/transcricoes/[id]` (página, não modal) |
| **Fila de Processamento** (tile de Ações Rápidas) | **ausente** como tela própria; existe só o painel lateral em `/upload` |
| **Cadastro/Configuração de Monitor IA** (botão "Configurar", tiles "Cadastro"/"Novo Monitor") | **ausente** — o botão "Configurar" de `/monitor-ia` aponta para `/administracao` |
| **Automações**, **Faixas de Performance**, **Configurações de Feedbacks**, **SLA de Contestações**, **Metas Mensais**, **Categorias de Formulários**, **Turnos**, **Ver meu Workflow**, **Bug Reports** | só **stubs** — `administracao/[secao]` renderiza `ModuloEmConstrucao` |
| **Usuários de DDM**, **Sessões e Presença**, **Trilha de Auditoria** | só **stubs** (mesmo mecanismo) |
| **Avaliações Candidatas** (Contestações) | só **stub** que redireciona para Gestão ADM |
| **Novo Cliente / Editar Cliente** | **existe** (`/clientes` tem os dois modais) |

### B. Campos e blocos ausentes na **Ficha de Monitoria**

O QualiDDM tem `/avaliacoes/[id]` como **página**, não como modal sobre a lista. Faltam:

- **Modal sobre a Lista de Feedbacks**: no QualiTalk a ficha abre como modal ao clicar na
  linha; no QualiDDM a tabela de `/feedback` **não tem ação de abrir a ficha** (nenhum
  link/botão por linha).
- **Header em gradiente azul→roxo** com título `FICHA DE MONITORIA – {campanha}` — hoje o
  título é o nome do formulário, em card branco comum.
- Botão **"Recolher dados"** (colapsar a faixa de métricas) — ausente.
- Campos da faixa 2 ausentes: **`PRAZO FEEDBACK`** e **`PRAZO CONTESTAÇÃO`**.
- Bloco **"Feedback Global sobre a Avaliação"** com `Tipo de Feedback *` (select) e
  `Comentários Detalhados * (mín. 20 caracteres)` — **ausente** (a ficha do QualiDDM é
  somente leitura; o formulário existe só em `/transcricoes/[id]`).
- Card **"Cabeçalho da Ficha"** com **`CPF`** — ausente.
- **Banner de seção com gradiente + descrição da seção**: no QualiDDM as seções são
  **abas** (`role="tablist"`) com contadores, não faixas com descrição.
- **`Peso: N pts`** por critério — ausente.
- Chip **`⚠️ Eliminatória`** por critério — ausente.
- Bloco **`Anexos (N)`** por critério — ausente.
- Botão **"Contestar Avaliação"** no rodapé — ausente (o rodapé só tem "Voltar para
  Avaliações").
- **"Exportar PDF"** usa `window.print()` — no QualiTalk é um export dedicado.
- **Resumo de Conformidade** no QualiDDM mostra 3 números; falta o **`Total`**.

### C. Campos ausentes no **modal/tela de Avaliação IA**

- **`Persona`** como KPI e **`Confiança`** com tooltip de ajuda — a página
  `/transcricoes/[id]` traz `CARTEIRA` em vez de `Persona`.
- Bloco **"Evidência da IA (trecho da transcrição)"** com chip **`Confiança: N%`**
  **por critério** — não confirmado na implementação atual.
- Bloco **"Notas da IA (raciocínio)"** por critério — idem.
- Bloco **"Observações da IA"** (parágrafo consolidado com separadores `|`) — idem.
- Transcrição com rótulos **`SPEAKER_00:` / `SPEAKER_01:`** em bloco monoespaçado —
  a tela existe (`Transcricao / Conteudo`) mas o print [DDM] mostra **"Sem transcrição
  salva."**, ou seja, o pipeline não está gravando a transcrição.
- Resposta **`Diagnóstico`** como valor possível de critério — o QualiDDM só trata
  `Conforme` / não-Conforme (`tomDoScore`, `criterio.status === "Conforme"`).

### D. Lacunas por tela existente

**Dashboard (`/`)**
- H1 é **"Qualidade da Operação"**; no QualiTalk é **"Dashboard"**.
- KPIs sem os **badges de contexto** (`Mês: Agosto`, `S/NCG: 71,66`, `12 total`).
- Gráficos são **barras em CSS**; no QualiTalk são **linha dupla** (Avaliações + Qualidade,
  eixo X `Mês -5`…`Atual`) e **donut** com legenda `1Q/2Q/3Q` e tooltip.
- **Status Atual** tem 4 linhas; falta **"Feedbacks Vencidos"** (`5 fora do prazo`) e
  faltam as **sub-linhas com percentual** (`352 (23.5%)`, `293 (19.9%)`,
  `56 total · 0 pendentes`).
- Seletor de período é `7 dias / 31 dias`; no QualiTalk o recorte é **mensal**.

**Clientes (`/clientes`)**
- **Sem lacunas relevantes**: os 4 KPIs (`Total de Clientes`, `Clientes Ativos`,
  `Monitorias Realizadas (Total)`, `Nota de Qualidade (Score)`), a linha `Contrato:` e o
  link "N formulário(s)" já existem (`clientes/page.js:94-115, 371-381`).

**Avaliações (`/avaliacoes`)**
- Os filtros `Nível de Performance` e `Departamento`, o contador "Filtros ativos", o botão
  "Limpar Datas" e o card "Página atual · 50 por página" **já existem**
  (`avaliacoes/page.js:237, 283, 306, 319, 331`).
- Nos cards de avaliação **faltam**: os chips de conformidade
  **`27 Conformes` / `3 Não Conformes` / `0 Não Aplicáveis`**, e a linha
  **`🏅 Score: NN,NN`** no canto direito (hoje só existe o chip `Nota: NN,NN`).
- Faltam as **tags de contexto** (chips `Vero`, `Ativo 20 a 44`).

**Formulários (`/formularios`)**
- Ações Rápidas coincidem (5 tiles). Falta o **submenu** com `Avaliações` no menu lateral
  (existe a rota `/formularios/avaliacoes` com 5 linhas — praticamente vazia).

**Monitor IA (`/monitor-ia`)**
- Cards de monitor mostram **métricas** (`Avaliações`, `Score médio`, `Última avaliação`)
  em lugar de **avatar da persona + cliente + campanha** do QualiTalk.
- **Ações Rápidas** tem 4 tiles; no QualiTalk são **7**: falta **Cadastro**,
  **Novo Monitor**, **Automação**, **Fila de Processamento**, **Resultados**.
- Botão **"Ver todos →"** da seção "Monitores IA Recentes" — no QualiDDM é
  **"Ver relatórios"**.

**Transcrições (`/transcricoes`)**
- **Sem lacunas**: colunas idênticas (`Arquivo`, `Enviada em`, `Duração`, `Origem`,
  `Transcrição`, `Ações`), checkbox "Transcrever automaticamente", select "Todos os status"
  e botão "Exportar JSON (recorte atual)" já existem
  (`transcricoes/page.js:249, 314, 348, 431-438`).

**Feedback (`/feedback`)**
- Cards e colunas **coincidem** com o QualiTalk (5 situações, 9 colunas, sub-linha de
  Finalizadas, nota de recorte).
- **Falta a ação de abrir a FICHA DE MONITORIA** a partir da linha — é a lacuna mais
  importante desta tela.
- Filtro **`Superior`** reaproveita a lista de avaliadores (comentado no código como
  pendência: falta endpoint de supervisores).

**Contestações → Gestão ADM (`/contestacoes/gestao-adm`)**
- **Sem lacunas**: cards `Todas / Pendentes / Julgadas`, as 6 colunas
  (`ID Monitoria / Formulário / Campanha / Avaliado / Monitor / Itens Contestados`), os dois
  campos de busca (texto livre e ID) e o select "Todos os Status"
  (`Pendente / Em análise / Julgada / Cancelada`) já existem
  (`gestao-adm/page.js:26-58, 200-236, 297-305`).

**Relatórios (`/relatorios`)**
- O QualiDDM agrupa em **"Análises com IA"** (4 tipos) + **"Relatórios do sistema"**
  (5 tipos). O QualiTalk tem **12 relatórios de sistema**; faltam:
  **Usuários**, **Fichas de Avaliação**, **Monitoria Analítico**,
  **Analítico de Calibração**, **Pesquisa de Satisfação**,
  **Justificativas de Avaliação**, **Fichas Excluídas/Avaliações**,
  **Ausência de Monitoria**, **Monitoria Editada**.
- Falta o **stepper de 3 passos** (`Relatório selecionado` → `Definir filtros` →
  `Consultar dados`) e a bolinha verde de disponibilidade ao lado do H1.
- O filtro **`Categoria`** e os **atalhos de período** (`Últimos 7 dias` /
  `Últimos 30 dias` / `Mês atual`) **já existem** (`relatorios/page.js:45-47, 685-692`).
- Exportação: o QualiDDM tem **um** botão (`CSV (abre no Excel)`); o QualiTalk tem
  **Excel** (server-side) **e** **CSV**.

**Administração (`/administracao`)**
- As **duas abas**, os **14 cartões**, o card **"Status do RBAC"** (4 métricas) e o card
  **"Atividade Recente"** **já existem** (`administracao/page.js:19-23, 229, 281`;
  `funcionalidades.js`) e batem 1:1 com os prints.
- A lacuna real: **10 dos 14 cartões apontam para stubs** (`ModuloEmConstrucao` via
  `administracao/[secao]`). Só `Justificativas` e `Relatórios Admin` têm destino real.

### E. Lacunas de shell / identidade

- **Sidebar do QualiDDM tem `Upload` e `Avaliações` como itens próprios** (o QualiTalk não
  tem `Upload` no menu; `Avaliações` fica sob `Formulários`). Divergência **deliberada**,
  documentada em `Sidebar.js`.
- `Quizzes`, `Sala de Calibração` e `Calendário` **não entram no menu** — telas descartadas
  por decisão do produto (18/08/2026). Ausência **deliberada**, não lacuna.
- Falta o **submenu de `Dashboard`**.
- **`Administração`** está declarada com `filhos: []` — nunca abre submenu; o QualiTalk tem
  chevron com filhos.
- Falta o **seletor de tenant** (chevron duplo ao lado da marca) e o **botão de
  notificações** com contador.
- **Header de tabela laranja com texto branco** é a assinatura visual do QualiTalk — já
  reproduzida no QualiDDM pela classe `data-table branded`
  (`globals.css:1107-1124`, `background: var(--accent-strong)` + `color: var(--text-on-dark)`),
  aplicada em `/feedback`, `/contestacoes/gestao-adm` e `/relatorios`. **`/transcricoes`
  usa `data-table` sem `branded`** (`transcricoes/page.js:424`) — no QualiTalk essa tabela
  também não tem header laranja, então a divergência é apenas interna e coerente.
- O QualiTalk exibe chip **`DEV`**; o QualiDDM exibe **`PROD`** (correto, ambiente
  diferente).
