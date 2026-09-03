# -*- coding: utf-8 -*-
"""Gera o SQL de importacao das avaliacoes IA exportadas do QualiTalk.

    python database/ferramentas/gerar-importacao-ia.py \
        ../avaliacoes-ia-2026-08-20.xlsx \
        database/cpanel/10-avaliacoes-ia-oficiais.sql

Substitui o gerador que produziu a primeira versao do 10-avaliacoes-ia-*.sql.
Tres defeitos daquele arquivo nascem corrigidos aqui:

1. ENCODING. O anterior gravou bytes UTF-8 como latin1 -- "AvaliaÃ§Ã£o cobranÃ§a"
   no lugar de "Avaliação cobrança". Era a origem do acento quebrado no
   cabecalho da ficha e no bloco "Leitura do Acordito". A planilha sempre
   esteve limpa; o gerador e que corrompia. Aqui a escrita e utf-8 declarada.

2. NOMES NAO NORMALIZADOS. O anterior emitia `INSERT INTO campanhas` com
   'Telefone  Ativo' (espaco duplo) e ON DUPLICATE KEY UPDATE. Como a chave
   unica e (cliente_id, nome) e o espaco conta, aquilo RECRIAVA as campanhas
   duplicadas que o 13-normaliza-nomes fundiu. Aqui cliente, campanha e
   formulario passam por trim + colapso de espaco antes de virar SQL, entao o
   INSERT cai na linha que ja existe em vez de criar irma.

3. OPERADOR. O anterior prendia todas as 1041 avaliacoes num usuario de
   faz-de-conta ('Monitoria IA'), porque a planilha nao trazia o avaliado.
   Aqui, se a planilha tiver coluna de operador, ela e usada; o fantasma vira
   so o ultimo recurso, linha a linha.

A resolucao do operador acontece no SQL e nao aqui de proposito: e o banco que
sabe qual id o usuario tem, e ele pode mudar entre ambientes. O COALESCE tenta
e-mail, depois nome, depois o fantasma -- nessa ordem porque e-mail e unico e
nome nao (ha 3 "Marcia" e 5 "Leticia" entre os operadores).
"""
import argparse
import json
import re
import sys
import unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit('Falta openpyxl. Instale com: pip install openpyxl')

# Nomes que a coluna de operador pode ter na exportacao. Varia conforme quem
# gerou; procurar por varios evita ter de editar este arquivo a cada export.
COLUNAS_OPERADOR = ('AVALIADO', 'OPERADOR', 'USUARIO AVALIADO', 'USUÁRIO AVALIADO',
                    'AGENTE', 'ATENDENTE')
COLUNAS_EMAIL = ('E-MAIL DO AVALIADO', 'EMAIL DO AVALIADO', 'E-MAIL', 'EMAIL')
COLUNAS_MATRICULA = ('MATRÍCULA', 'MATRICULA', 'MATRÍCULA DO AVALIADO')

FANTASMA_AVALIADO = 'monitoria.ia@qualiddm.local'
FANTASMA_AVALIADOR = 'gemini@qualiddm.local'
HASH_PBKDF2 = 'pbkdf2$210000$cXVhbGlkZG0taW1wb3J0LT$C5Mb7379Y2vlhBf_vVTOlzl2TVI6IMUfjm9CPrxJPGk'


def limpo(valor):
    """Trim + colapso de espaco. E o que impede o INSERT de recriar duplicata."""
    return re.sub(r'\s+', ' ', str(valor or '')).strip()


def slug(nome):
    """Mesmo slug do app (normalize NFD + remocao de diacritico)."""
    t = unicodedata.normalize('NFD', str(nome or ''))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
    return t[:110]


def sql_texto(valor):
    """Literal SQL. Escapa a barra invertida ANTES da aspa, senao a barra que a
    propria escapada introduz seria escapada de novo."""
    if valor is None:
        return 'NULL'
    t = str(valor).replace('\\', '\\\\').replace("'", "''")
    return "'" + t + "'"


def sql_num(valor, casas=None):
    if valor is None or valor == '':
        return 'NULL'
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return 'NULL'
    return f'{n:.{casas}f}' if casas is not None else str(int(round(n)))


def data_sql(valor):
    """'19/08/2026 11:29' -> '2026-08-19 11:29:00'. Aceita datetime tambem."""
    if valor is None or valor == '':
        return None
    if hasattr(valor, 'strftime'):
        return valor.strftime('%Y-%m-%d %H:%M:%S')
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})[ T](\d{2}):(\d{2})', str(valor).strip())
    if m:
        d, mo, a, h, mi = m.groups()
        return f'{a}-{mo}-{d} {h}:{mi}:00'
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})', str(valor).strip())
    return f'{m.group(1)}-{m.group(2)}-{m.group(3)} {m.group(4)}:{m.group(5)}:00' if m else None


def quadrante(score):
    """Faixas lidas do arquivo gerado anteriormente, para nao mudar o
    significado do dado no meio do caminho: 1Q e so o zero; 5Q comeca em 90."""
    if score is None:
        return None
    if score <= 0:
        return '1Q'
    if score < 70:
        return '2Q'
    if score < 80:
        return '3Q'
    if score < 90:
        return '4Q'
    return '5Q'


# Palavras de contexto que vem coladas ao nome no arquivo ("kaio-receptivo",
# "monitoria-sabrina"). So sao removidas nas BORDAS e so com 4+ letras: tirar
# "ia" do meio mutilaria "Tatiane", "Sonia", "Patricia" -- foi o que aconteceu
# na primeira tentativa de casar, e os nomes voltaram como "tatnesilva".
RUIDO_ARQUIVO = ('monitoria', 'monitorias', 'receptivo', 'ativo', 'educacional',
                 'isaac', 'vero', 'churn', 'chat', 'cruzeiro', 'cruzeuiro', 'anima',
                 'yduqs', 'firjan', 'fiergs', 'empresarial', 'cobranca', 'ligacao',
                 'audio', 'gravacao', 'copia', 'teste', 'fila', 'datora', 'prospeccao')


def normal(t):
    """So letras e digitos, sem acento, minusculo."""
    t = unicodedata.normalize('NFD', str(t or ''))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', t.lower())


def carregar_operadores(caminho):
    """Le a planilha de usuarios e monta o indice de busca por nome.

    Guarda todos os prefixos do nome (1 parte, 2 partes, ...) e tambem
    primeiro+ultimo, porque o arquivo tanto vem "luanagama" quanto "odhara".
    Guarda os clientes de cada operador para desempatar homonimo depois.
    """
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    cab = list(next(it))
    i_nome = achar_coluna(cab, ('USUÁRIO', 'USUARIO', 'NOME'))
    i_tipo = achar_coluna(cab, ('TIPO DE USUÁRIO', 'TIPO DE USUARIO', 'TIPO'))
    i_mail = achar_coluna(cab, ('E-MAIL', 'EMAIL'))
    i_cli = achar_coluna(cab, ('CLIENTE', 'OPERAÇÃO'))
    if i_nome is None or i_mail is None:
        sys.exit('Planilha de usuarios sem coluna de nome ou e-mail: %s' % cab)

    indice, dados = {}, {}
    for linha in it:
        if not linha or not linha[i_nome]:
            continue
        if i_tipo is not None and limpo(linha[i_tipo]).lower() != 'operador':
            continue
        nome = limpo(linha[i_nome])
        dados[nome] = {
            'email': limpo(linha[i_mail]),
            'clientes': ({normal(c) for c in str(linha[i_cli] or '').split(',') if normal(c)}
                         if i_cli is not None else set()),
        }
        partes = [x for x in nome.split()
                  if normal(x) and normal(x) not in ('de', 'da', 'do', 'dos', 'das', 'e')]
        chaves = {normal(''.join(partes[:k])) for k in range(1, len(partes) + 1)}
        if len(partes) >= 2:
            chaves.add(normal(partes[0] + partes[-1]))
        for c in chaves:
            indice.setdefault(c, set()).add(nome)

    longas = sorted((c for c in indice if len(c) >= 8), key=len, reverse=True)
    return {'indice': indice, 'dados': dados, 'longas': longas}


def inferir_operador(arquivo, cliente, ops):
    """Tenta descobrir o operador pelo nome do arquivo.

    E PALPITE, nao registro: nome de arquivo e convencao de quem gravou, nao
    campo de sistema. Por isso so devolve o que for inequivoco -- candidato
    unico, ou unico depois de filtrar por quem atende aquele cliente. Homonimo
    que sobrar volta vazio: atribuir a monitoria de uma pessoa a outra e pior
    do que deixar sem dono.
    """
    if not ops:
        return None, None

    base = re.sub(r'\.(mp3|wav|mpeg|m4a|ogg)$', '', str(arquivo or ''), flags=re.I)
    bruta = re.split(r'\d', normal(re.split(r'\s*\(', base)[0]))[0]

    curta, mudou = bruta, True
    while mudou:
        mudou = False
        for r in RUIDO_ARQUIVO:
            if curta.endswith(r) and len(curta) > len(r) + 3:
                curta, mudou = curta[:-len(r)], True
            elif curta.startswith(r) and len(curta) > len(r) + 3:
                curta, mudou = curta[len(r):], True

    achados = set()
    for cand in (bruta, curta):
        if len(cand) >= 4 and cand in ops['indice']:
            achados = ops['indice'][cand]
            break
    if not achados and len(curta) >= 6:
        for c in ops['longas']:
            if curta.startswith(c) or c in curta:
                achados = ops['indice'][c]
                break
    if not achados:
        return None, None

    if len(achados) > 1:
        cli = normal(cliente)
        achados = {o for o in achados if cli and cli in ops['dados'][o]['clientes']}
    if len(achados) != 1:
        return None, None

    nome = next(iter(achados))
    return nome, ops['dados'][nome]['email']


def achar_coluna(cabecalho, candidatos):
    """Devolve o INDICE da coluna, nao o nome: as linhas vem como tupla."""
    mapa = {limpo(c).upper(): i for i, c in enumerate(cabecalho) if c}
    for cand in candidatos:
        if cand.upper() in mapa:
            return mapa[cand.upper()]
    return None


def bloco(linha, cols, ops=None):
    codigo = limpo(linha[cols['codigo']])
    if not codigo:
        return None

    arquivo = str(linha[cols['arquivo']] or '')

    # Duas linhas da exportacao vem sem cliente e sem campanha. Emitir o nome
    # vazio criaria um cliente de nome '' e slug '' -- exatamente o tipo de
    # lixo que o 13-normaliza-nomes teve de limpar depois. `avaliacoes.
    # cliente_id` e NOT NULL, entao nao da para deixar em branco: vai para um
    # marcador declarado, que a pessoa reconhece na lista e pode corrigir.
    # `campanha_id` aceita NULL, e ai fica NULL mesmo -- inventar campanha
    # seria pior que a ausencia.
    cliente = limpo(linha[cols['cliente']]) or 'Não informado'
    campanha = limpo(linha[cols['campanha']])
    formulario = limpo(linha[cols['formulario']]) or 'Ficha importada do QualiTalk'
    persona = str(linha[cols['persona']] or '').strip()
    resumo = str(linha[cols['observacoes']] or '').strip()

    nota = linha[cols['nota']]
    score = None if nota in (None, '') else float(nota)
    conf = linha[cols['confianca']]
    confianca = None if conf in (None, '') else float(conf) / 100.0
    minutos = linha[cols['duracao']]
    segundos = None if minutos in (None, '') else int(round(float(minutos) * 60))

    criada = data_sql(linha[cols['criada']])
    finalizada = data_sql(linha[cols['finalizada']]) or criada

    zerada = 1 if score == 0 else 0
    if score is None:
        conformes, nao_conformes, total = 0, 0, 0
    elif score >= 80:
        conformes, nao_conformes, total = 1, 0, 1
    else:
        conformes, nao_conformes, total = 0, 1, 1

    analise = {
        'origem': 'QualiTalk',
        'codigo': codigo,
        'arquivo': arquivo,
        'cliente': cliente,
        'campanha': campanha,
        'persona': persona,
        'formulario': formulario,
        'nota': score,
        'conceito': limpo(linha[cols['conceito']]) if cols.get('conceito') is not None else '',
        'confianca': confianca,
        'status': limpo(linha[cols['status']]) if cols.get('status') is not None else '',
        'etapa': limpo(linha[cols['etapa']]) if cols.get('etapa') is not None else '',
        'duracao_segundos': segundos,
        'observacoes': resumo,
        'criada_em': criada,
        'finalizada_em': finalizada,
        'insights': [resumo] if resumo else [],
        'riscos': (['Monitoria abaixo da faixa de qualidade ou zerada no QualiTalk.']
                   if score is not None and score < 80 else []),
        'proximos_passos': ['Revisar evidencias completas no arquivo de origem quando necessario.'],
    }
    if cols.get('operador') is not None:
        analise['avaliado'] = limpo(linha[cols['operador']])

    json_txt = json.dumps(analise, ensure_ascii=False)

    # Resolucao do operador: e-mail (unico) > nome (pode repetir) > fantasma.
    email = limpo(linha[cols['email']]) if cols.get('email') is not None else ''
    nome_op = limpo(linha[cols['operador']]) if cols.get('operador') is not None else ''
    inferido = False
    if not email and not nome_op and ops:
        achado, mail = inferir_operador(arquivo, cliente, ops)
        nome_op, email = achado or '', mail or ''
        inferido = bool(nome_op or email)
        if inferido:
            # Fica gravado no JSON da analise: quem abrir a ficha depois
            # precisa saber que este vinculo foi deduzido, nao informado.
            analise['avaliado'] = nome_op
            analise['avaliado_origem'] = 'inferido do nome do arquivo'
            json_txt = json.dumps(analise, ensure_ascii=False)
    if email:
        resolve = (f"SET @avaliado_id := COALESCE("
                   f"(SELECT id FROM users WHERE email = {sql_texto(email)} LIMIT 1),"
                   f"@avaliado_import_id);")
    elif nome_op:
        resolve = (f"SET @avaliado_id := COALESCE("
                   f"(SELECT id FROM users WHERE name = {sql_texto(nome_op)}"
                   f" AND role = 'operador' ORDER BY active DESC, id LIMIT 1),"
                   f"@avaliado_import_id);")
    else:
        resolve = 'SET @avaliado_id := @avaliado_import_id;'

    p = []
    a = p.append
    a(f'-- {codigo} - {cliente} / {campanha}')
    a(f'SET @codigo := {sql_texto(codigo)};')
    a(f'SET @arquivo := {sql_texto(arquivo)};')
    a(f'SET @cliente_nome := {sql_texto(cliente)};')
    a(f'SET @cliente_slug := {sql_texto(slug(cliente))};')
    a(f'SET @campanha_nome := {sql_texto(campanha)};')
    a(f'SET @formulario_nome := {sql_texto(formulario)};')
    a(f'SET @persona := {sql_texto(persona)};')
    a(f'SET @resumo := {sql_texto(resumo)};')
    a(f'SET @criada := {sql_texto(criada)};')
    a(f'SET @analise := {sql_texto(json_txt)};')
    a(resolve)
    a('INSERT INTO clientes (slug,nome,ativo) VALUES (@cliente_slug,@cliente_nome,1)'
      ' ON DUPLICATE KEY UPDATE ativo=1;')
    a('SET @cliente_id := (SELECT id FROM clientes'
      ' WHERE slug = @cliente_slug OR nome = @cliente_nome ORDER BY id LIMIT 1);')
    if campanha:
        a("INSERT INTO campanhas (cliente_id,nome,canal,ativa)"
          " VALUES (@cliente_id,@campanha_nome,'telefone',1)"
          ' ON DUPLICATE KEY UPDATE ativa=1;')
        a('SET @campanha_id := (SELECT id FROM campanhas'
          ' WHERE cliente_id = @cliente_id AND nome = @campanha_nome LIMIT 1);')
    else:
        a('SET @campanha_id := NULL;')
    a("INSERT INTO formularios (cliente_id,nome,categoria,status,versao)"
      " VALUES (@cliente_id,@formulario_nome,'diagnostico','ativo',1)"
      " ON DUPLICATE KEY UPDATE status='ativo', categoria='diagnostico';")
    a('SET @formulario_id := (SELECT id FROM formularios'
      ' WHERE cliente_id = @cliente_id AND nome = @formulario_nome AND versao = 1 LIMIT 1);')
    if campanha:
        a('INSERT IGNORE INTO formulario_campanhas (formulario_id,campanha_id)'
          ' VALUES (@formulario_id,@campanha_id);')
    a("INSERT INTO formulario_secoes (formulario_id,nome,descricao,posicao)"
      " VALUES (@formulario_id,'Resultado QualiTalk',"
      "'Resumo consolidado importado da base historica do QualiTalk.',1)"
      " ON DUPLICATE KEY UPDATE nome=VALUES(nome), descricao=VALUES(descricao);")
    a('SET @secao_id := (SELECT id FROM formulario_secoes'
      ' WHERE formulario_id = @formulario_id AND posicao = 1 LIMIT 1);')
    a("INSERT INTO formulario_criterios (secao_id,nome,enunciado,peso_pts,eliminatoria,posicao)"
      " VALUES (@secao_id,'Resultado consolidado da analise IA',"
      "'Criterio consolidado gerado a partir da nota, conceito, confianca e observacoes"
      " exportadas do QualiTalk.',100,0,1)"
      " ON DUPLICATE KEY UPDATE nome=VALUES(nome), enunciado=VALUES(enunciado);")
    a('INSERT INTO gravacoes (nome_arquivo,storage_path,mime_type,tamanho_bytes,duracao_segundos,'
      'hash_sha256,origem,cliente_id,campanha_id,avaliado_id,enviado_por_id,status_transcricao,'
      'transcrever_automatico,created_at) VALUES (@arquivo,NULL,NULL,NULL,'
      f"{sql_num(segundos)},"
      "SHA2(CONCAT('qualitalk-import:',@codigo),256),'integracao',@cliente_id,@campanha_id,"
      "@avaliado_id,@avaliador_import_id,'concluida',0,@criada)"
      ' ON DUPLICATE KEY UPDATE nome_arquivo=VALUES(nome_arquivo),'
      ' duracao_segundos=VALUES(duracao_segundos), cliente_id=VALUES(cliente_id),'
      ' campanha_id=VALUES(campanha_id), avaliado_id=VALUES(avaliado_id),'
      " status_transcricao='concluida';")
    a("SET @gravacao_id := (SELECT id FROM gravacoes"
      " WHERE hash_sha256 = SHA2(CONCAT('qualitalk-import:',@codigo),256) LIMIT 1);")
    a('INSERT INTO transcricoes (gravacao_id,provedor,modelo,idioma,texto,segmentos_json,'
      "confianca,status,created_at) VALUES (@gravacao_id,'qualitalk','importacao-qualitalk',"
      f"'pt-BR',@resumo,@analise,{sql_num(confianca, 4)},'concluida',@criada);")
    a('INSERT INTO avaliacoes (codigo,cod_gravacao,cliente_id,campanha_id,formulario_id,'
      'avaliado_id,avaliador_id,supervisor_id,categoria,origem,ia_persona,ia_modelo,ia_confianca,'
      'ia_resumo,ia_observacoes,ia_analise_json,score,zerada,quadrante,duracao_segundos,'
      'gravacao_id,data_contato,data_avaliacao,status_feedback,total_conformes,'
      'total_nao_conformes,total_nao_aplicaveis,total_criterios,avulsa,excluida_em) VALUES ('
      "@codigo,LEFT(@arquivo,60),@cliente_id,@campanha_id,@formulario_id,@avaliado_id,"
      "@avaliador_import_id,NULL,'diagnostico','ia',@persona,'qualitalk-importacao',"
      f"{sql_num(confianca, 4)},@resumo,@resumo,@analise,{sql_num(score, 2)},{zerada},"
      f"{sql_texto(quadrante(score))},{sql_num(segundos)},@gravacao_id,@criada,@criada,"
      f"'pendente',{conformes},{nao_conformes},0,{total},0,NULL)"
      ' ON DUPLICATE KEY UPDATE cod_gravacao=VALUES(cod_gravacao), cliente_id=VALUES(cliente_id),'
      ' campanha_id=VALUES(campanha_id), formulario_id=VALUES(formulario_id),'
      ' avaliado_id=VALUES(avaliado_id), avaliador_id=VALUES(avaliador_id),'
      " categoria='diagnostico', origem='ia', ia_persona=VALUES(ia_persona),"
      ' ia_modelo=VALUES(ia_modelo), ia_confianca=VALUES(ia_confianca),'
      ' ia_resumo=VALUES(ia_resumo), ia_observacoes=VALUES(ia_observacoes),'
      ' ia_analise_json=VALUES(ia_analise_json), score=VALUES(score), zerada=VALUES(zerada),'
      ' quadrante=VALUES(quadrante), duracao_segundos=VALUES(duracao_segundos),'
      ' gravacao_id=VALUES(gravacao_id), data_contato=VALUES(data_contato),'
      ' data_avaliacao=VALUES(data_avaliacao), total_conformes=VALUES(total_conformes),'
      ' total_nao_conformes=VALUES(total_nao_conformes),'
      ' total_nao_aplicaveis=VALUES(total_nao_aplicaveis),'
      ' total_criterios=VALUES(total_criterios), excluida_em=NULL;')
    a('SET @avaliacao_id := (SELECT id FROM avaliacoes WHERE codigo = @codigo LIMIT 1);')
    a('UPDATE gravacoes SET avaliacao_id = @avaliacao_id WHERE id = @gravacao_id;')
    a('')
    return '\n'.join(p), bool(email or nome_op), inferido


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('planilha')
    ap.add_argument('saida')
    ap.add_argument('--banco', default='grpia_qualiddm')
    ap.add_argument('--usuarios', help='planilha de usuarios; usada para inferir o'
                                       ' operador pelo nome do arquivo quando a'
                                       ' exportacao nao trouxer a coluna Avaliado')
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.planilha, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    cab = list(next(it))

    def obrig(*cands):
        c = achar_coluna(cab, cands)
        if c is None:
            sys.exit(f'Coluna nao encontrada na planilha: {cands[0]}\nColunas: {cab}')
        return c

    cols = {
        'codigo': obrig('ID DA ANÁLISE', 'ID DA ANALISE', 'ID DA MONITORIA'),
        'arquivo': obrig('ARQUIVO'),
        'cliente': obrig('CLIENTE', 'OPERAÇÃO'),
        'campanha': obrig('CAMPANHA'),
        'persona': obrig('PERSONA'),
        'formulario': obrig('FORMULÁRIO', 'FORMULARIO'),
        'nota': obrig('NOTA', 'SCORE'),
        'confianca': obrig('CONFIANÇA DA IA (%)', 'CONFIANCA DA IA (%)', 'CONFIANÇA'),
        'duracao': obrig('DURAÇÃO (MIN)', 'DURACAO (MIN)'),
        'observacoes': obrig('OBSERVAÇÕES DA IA', 'OBSERVACOES DA IA'),
        'criada': obrig('CRIADA EM'),
        'finalizada': obrig('FINALIZADA EM'),
        'conceito': achar_coluna(cab, ('CONCEITO',)),
        'status': achar_coluna(cab, ('STATUS',)),
        'etapa': achar_coluna(cab, ('ETAPA DA ESTEIRA',)),
        'operador': achar_coluna(cab, COLUNAS_OPERADOR),
        'email': achar_coluna(cab, COLUNAS_EMAIL),
    }

    ops = None
    if cols['operador'] is not None or cols['email'] is not None:
        i = cols['operador'] if cols['operador'] is not None else cols['email']
        print(f'operador: coluna {cab[i]!r} encontrada na exportacao')
    elif args.usuarios:
        ops = carregar_operadores(args.usuarios)
        print('operador: sem coluna na exportacao; inferindo pelo nome do arquivo'
              f' contra {len(ops["dados"])} operadores')
    else:
        print('AVISO: nenhuma coluna de operador na planilha.')
        print('       Todas as avaliacoes ficarao no usuario "Monitoria IA".')

    blocos, com_operador, inferidos = [], 0, 0
    for linha in it:
        r = bloco(linha, cols, ops)
        if r:
            blocos.append(r[0])
            com_operador += 1 if r[1] else 0
            inferidos += 1 if r[2] else 0

    cab_sql = f"""-- 10 - Importacao das avaliacoes IA exportadas do QualiTalk
-- Fonte: {args.planilha}
-- Avaliacoes: {len(blocos)} | com operador identificado: {com_operador}
-- Gerado por database/ferramentas/gerar-importacao-ia.py
--
-- A planilha traz resumo consolidado: nao ha criterio por pergunta nem audio.
-- Cada avaliacao vira um criterio unico "Resultado consolidado da analise IA".
--
-- Idempotente: tudo e ON DUPLICATE KEY UPDATE pelo codigo MIA-..., entao rodar
-- duas vezes atualiza em vez de duplicar.

USE `{args.banco}`;

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

-- Usuarios tecnicos da importacao. "Monitoria IA" e o ultimo recurso para
-- avaliacao sem operador identificado; "Gemini" assina como avaliador.
INSERT INTO users (name,email,password_hash,role,active,trocar_senha)
VALUES ('Monitoria IA', '{FANTASMA_AVALIADO}', '{HASH_PBKDF2}', 'operador', 1, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), active=1;
INSERT INTO users (name,email,password_hash,role,active,trocar_senha)
VALUES ('Gemini', '{FANTASMA_AVALIADOR}', '{HASH_PBKDF2}', 'monitor', 1, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), active=1;

SET @avaliado_import_id := (SELECT id FROM users WHERE email='{FANTASMA_AVALIADO}' LIMIT 1);
SET @avaliador_import_id := (SELECT id FROM users WHERE email='{FANTASMA_AVALIADOR}' LIMIT 1);

"""
    rodape = """
-- Conferencia. `sem_operador` deve ser 0 quando a planilha traz o avaliado.
SELECT COUNT(*) AS importadas,
       SUM(a.avaliado_id = @avaliado_import_id) AS sem_operador,
       COUNT(DISTINCT a.avaliado_id)            AS operadores_distintos
  FROM avaliacoes a
 WHERE a.ia_modelo = 'qualitalk-importacao';
"""
    with open(args.saida, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(cab_sql)
        fh.write('\n'.join(blocos))
        fh.write(rodape)

    print(f'{len(blocos)} avaliacoes -> {args.saida}')
    if com_operador:
        print(f'{com_operador} com operador ({com_operador / len(blocos):.0%})')
    if inferidos:
        print(f'  destes, {inferidos} INFERIDOS do nome do arquivo -- palpite, nao registro')
        print(f'  {len(blocos) - com_operador} ficam em "Monitoria IA"')


if __name__ == '__main__':
    main()
