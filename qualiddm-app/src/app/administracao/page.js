"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import useRecurso from "@/hooks/useRecurso";
import { formatarNumero, SEM_VALOR } from "@/lib/formato";
import { destinoDe, OPERACAO, USUARIOS } from "./funcionalidades";
import styles from "./page.module.css";

const ABAS = [
  { id: "operacao", rotulo: "Operação" },
  { id: "usuarios", rotulo: "Usuários" },
];

/* As quatro contagens do bloco "Status do RBAC". O ícone é o mesmo tique verde
   nos quatro: ali ele diz "este cadastro está em pé", não diferencia métricas. */
const METRICAS_RBAC = [
  { chave: "usuariosAtivos", rotulo: "Usuários Ativos" },
  { chave: "cargos", rotulo: "Cargos Cadastrados" },
  { chave: "permissoes", rotulo: "Permissões no Catálogo" },
  { chave: "campanhasAtivas", rotulo: "Campanhas Ativas" },
];

/** Cartões de funcionalidade — o mesmo desenho nas duas abas. */
function GradeFuncionalidades({ itens, rotuladoPor, contagens }) {
  return (
    <ul className="tile-grid" aria-labelledby={rotuladoPor}>
      {itens.map((item) => {
        const quantos = item.contador ? contagens?.[item.contador] : null;

        return (
          <li key={item.id}>
            <Link className="tile" href={destinoDe(item)}>
              <span className="icon-tile" data-tom={item.tom}>
                <Icon name={item.icone} size={20} />
              </span>

              <span className="tile-body">
                <strong>{item.rotulo}</strong>
                <span>{item.detalhe}</span>
                {/* Contagem real do banco quando existe: um cartão de menu que
                    diz "12 cadastrados" informa mais do que só o nome. Zero é
                    uma medição legítima e aparece — é o que revela cadastro
                    vazio. */}
                {quantos != null ? (
                  <span className={styles.tileContagem}>
                    {formatarNumero(quantos)} {quantos === 1 ? "registro" : "registros"}
                  </span>
                ) : null}
              </span>

              <Icon className="tile-chevron" name="chevronRight" size={18} />

              {/* Dentro do link, e não ao lado: assim o leitor de tela lê "Novo"
                  junto com o nome da funcionalidade, que é o que a marca
                  qualifica. */}
              {item.novo ? <span className="chip success tile-flag">Novo</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdministracaoPage() {
  const [aba, setAba] = useState("operacao");
  const tablistRef = useRef(null);

  /* Uma requisição serve as duas abas: `rbac` e `atividadeRecente` alimentam a
     aba Usuários, e `operacao` traz as contagens dos cartões da aba Operação.
     Buscar por aba faria duas chamadas para o mesmo payload.

     A rota exige perfil administrador ou supervisor — a mensagem de 403 do
     backend aparece no lugar do bloco, e não como tela em branco. */
  const { dados, carregando, erro, recarregar } = useRecurso(
    "/api/administracao/metricas?limiteAtividade=8",
  );

  const rbac = dados?.rbac ?? null;
  const operacao = dados?.operacao ?? null;
  const atividade = dados?.atividadeRecente ?? [];
  const primeiraCarga = carregando && !dados;

  /**
   * Navegação por setas dentro do tablist (WAI-ARIA Tabs).
   *
   * Com tabindex móvel, Tab entra e sai do grupo de abas com um toque só; são as
   * setas que trocam de aba. Sem isso o teclado precisaria de um Tab por aba
   * para atravessar a barra.
   */
  function navegarAbas(evento) {
    const indice = ABAS.findIndex((item) => item.id === aba);
    let destino = null;

    if (evento.key === "ArrowRight") destino = (indice + 1) % ABAS.length;
    else if (evento.key === "ArrowLeft") destino = (indice - 1 + ABAS.length) % ABAS.length;
    else if (evento.key === "Home") destino = 0;
    else if (evento.key === "End") destino = ABAS.length - 1;
    else return;

    evento.preventDefault();
    const proxima = ABAS[destino];
    setAba(proxima.id);
    // O foco acompanha a seleção: quem navegou pelo teclado precisa continuar de
    // onde está, não voltar para a aba anterior.
    tablistRef.current?.querySelector(`#aba-${proxima.id}`)?.focus();
  }

  return (
    <AppShell active="Administração" breadcrumb="Sistema > Administração">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/">
            <Icon name="chevronLeft" size={16} label="Voltar ao Dashboard" />
          </Link>
          <span className="icon-badge" aria-hidden="true">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <h1>Administração L1</h1>
            <p>Gestão de usuários, cargos, permissões e operação</p>
          </div>
        </div>

        <div className="actions">
          <button className="btn" type="button" onClick={recarregar} disabled={carregando}>
            <Icon
              className={carregando ? "spinning" : undefined}
              name={carregando ? "spinner" : "refresh"}
              size={16}
            />
            {carregando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className="card pad" aria-labelledby="titulo-administracao">
        <div className={styles.abasHead}>
          <h2 className={styles.abasTitulo} id="titulo-administracao">
            Administração
          </h2>

          <div
            className="tabs"
            ref={tablistRef}
            role="tablist"
            aria-label="Áreas da administração"
            onKeyDown={navegarAbas}
          >
            {ABAS.map((item) => {
              const selecionada = aba === item.id;

              return (
                <button
                  className="tab"
                  id={`aba-${item.id}`}
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selecionada}
                  aria-controls={`painel-${item.id}`}
                  tabIndex={selecionada ? 0 : -1}
                  onClick={() => setAba(item.id)}
                >
                  {item.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        {erro ? (
          <p className="alert danger">
            <Icon name="error" size={18} />
            <span className="alert-body">
              <strong>Não foi possível carregar os dados da administração</strong>
              <span>{erro}</span>
            </span>
          </p>
        ) : null}

        {/* --- aba Operação ------------------------------------------------ */}
        <div
          className={styles.painel}
          id="painel-operacao"
          role="tabpanel"
          aria-labelledby="aba-operacao"
          tabIndex={0}
          hidden={aba !== "operacao"}
        >
          <div className="section-head">
            <div>
              <h3 id="funcionalidades-operacao">
                <span className="icon-badge sm" aria-hidden="true">
                  <Icon name="settings" size={14} />
                </span>
                Funcionalidades de Operação
              </h3>
              <p>Parâmetros que governam como a monitoria roda no dia a dia</p>
            </div>
          </div>

          <GradeFuncionalidades
            contagens={operacao}
            itens={OPERACAO}
            rotuladoPor="funcionalidades-operacao"
          />
        </div>

        {/* --- aba Usuários ------------------------------------------------ */}
        <div
          className={styles.painel}
          id="painel-usuarios"
          role="tabpanel"
          aria-labelledby="aba-usuarios"
          tabIndex={0}
          hidden={aba !== "usuarios"}
        >
          <section className={`card ${styles.rbac}`} aria-labelledby="status-rbac">
            <div className="section-head">
              <div>
                <h3 id="status-rbac">
                  <span className="icon-badge sm" aria-hidden="true">
                    <Icon name="activity" size={14} />
                  </span>
                  Status do RBAC
                </h3>
                <p>Cadastros que sustentam o controle de acesso</p>
              </div>
            </div>

            <ul className={styles.metricas}>
              {METRICAS_RBAC.map((metrica) => (
                <li className={styles.metrica} key={metrica.chave}>
                  <span className="icon-tile" data-tom="green" aria-hidden="true">
                    <Icon name="checkCircle" size={22} />
                  </span>

                  {primeiraCarga ? (
                    <span className={`skeleton ${styles.metricaEsqueleto}`} aria-hidden="true" />
                  ) : (
                    <strong className={styles.metricaValor}>
                      {rbac?.[metrica.chave] == null
                        ? SEM_VALOR
                        : formatarNumero(rbac[metrica.chave])}
                    </strong>
                  )}

                  <span className={styles.metricaRotulo}>{metrica.rotulo}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="funcionalidades-usuarios">
            <div className="section-head">
              <div>
                <h3 id="funcionalidades-usuarios">
                  <span className="icon-badge sm" aria-hidden="true">
                    <Icon name="settings" size={14} />
                  </span>
                  Funcionalidades de Administração
                </h3>
                <p>Acessos, cargos e auditoria</p>
              </div>
            </div>

            <GradeFuncionalidades itens={USUARIOS} rotuladoPor="funcionalidades-usuarios" />
          </section>

          <section className={`card ${styles.atividade}`} aria-labelledby="atividade-recente">
            <div className="section-head">
              <div>
                <h3 id="atividade-recente">
                  <span className="icon-badge sm" aria-hidden="true">
                    <Icon name="clock" size={14} />
                  </span>
                  Atividade Recente
                </h3>
                <p>Últimas ações sensíveis registradas na trilha de auditoria</p>
              </div>

              <Link className="btn ghost" href="/administracao/trilha-auditoria">
                Ver trilha completa
                <Icon name="chevronRight" size={15} />
              </Link>
            </div>

            {primeiraCarga ? (
              <ul className="list" aria-hidden="true">
                {Array.from({ length: 4 }, (_, indice) => (
                  <li className={styles.atividadeItem} key={indice}>
                    <span className={`skeleton ${styles.esqueletoAvatar}`} />
                    <span className={`skeleton ${styles.esqueletoTexto}`} />
                  </li>
                ))}
              </ul>
            ) : atividade.length === 0 ? (
              <div className="empty-state">
                <span className="icon-badge">
                  <Icon name="clock" size={20} />
                </span>
                <h4>Nenhuma atividade registrada</h4>
                <p>
                  Acessos e alterações sensíveis aparecem aqui assim que acontecerem, com autor e
                  horário.
                </p>
              </div>
            ) : (
              <ul className="list">
                {atividade.map((item) => (
                  <li className={styles.atividadeItem} key={item.id}>
                    {/* O tom do selo segue a severidade do registro: uma falha de
                        acesso não pode ter a mesma aparência de um login normal. */}
                    <span
                      className="icon-tile sm"
                      data-tom={
                        item.severidade === "critica" || item.resultado === "falha"
                          ? "red"
                          : item.severidade === "alerta"
                            ? "yellow"
                            : "orange"
                      }
                      aria-hidden="true"
                    >
                      <Icon name="key" size={16} />
                    </span>

                    <span className={styles.atividadeCorpo}>
                      <span className={styles.atividadeLinha}>
                        <strong>{item.usuario}</strong>
                        <span>
                          {[item.modulo, item.entidade, item.acao].filter(Boolean).join(" · ")}
                        </span>
                        {item.resultado === "falha" ? (
                          <span className="chip danger">
                            <Icon name="error" size={12} />
                            Falha
                          </span>
                        ) : null}
                      </span>
                      <span className="row-meta">{item.quando}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
