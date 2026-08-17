"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";
import styles from "../page.module.css";

function novaSecao() {
  return {
    nome: "Geral",
    descricao: "",
    criterios: [{ nome: "", enunciado: "", peso: "10", eliminatoria: false }],
  };
}

export default function NovoFormularioPage() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ nome: "", clienteId: "", categoria: "padrao", status: "ativo" });
  const [secoes, setSecoes] = useState([novaSecao()]);
  const [status, setStatus] = useState("idle");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch("/api/clientes", { cache: "no-store" })
      .then((resposta) => resposta.json())
      .then((payload) => {
        if (ativo && payload?.ok) setClientes(payload.data.clientes);
      })
      .catch(() => {
        if (ativo) setMensagem("Não foi possível carregar clientes.");
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar(evento) {
    evento.preventDefault();
    setStatus("saving");
    setMensagem("");

    try {
      const secoesValidas = secoes
        .map((secao) => ({
          ...secao,
          criterios: secao.criterios.filter(
            (criterio) => criterio.nome.trim() && criterio.enunciado.trim(),
          ),
        }))
        .filter((secao) => secao.nome.trim() && secao.criterios.length > 0);

      if (secoesValidas.length === 0) {
        throw new Error("Cadastre ao menos uma secao com um criterio.");
      }

      const resposta = await fetch("/api/formularios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, secoes: secoesValidas }),
      });
      const payload = await resposta.json().catch(() => null);
      if (!resposta.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível salvar o formulário.");
      }
      setStatus("done");
      setMensagem("Formulário cadastrado.");
      setForm({ nome: "", clienteId: "", categoria: "padrao", status: "ativo" });
      setSecoes([novaSecao()]);
    } catch (error) {
      setStatus("error");
      setMensagem(error.message);
    }
  }

  function alterarSecao(indice, campo, valor) {
    setSecoes((atuais) =>
      atuais.map((secao, atualIndice) => (atualIndice === indice ? { ...secao, [campo]: valor } : secao)),
    );
  }

  function adicionarSecao() {
    setSecoes((atuais) => [...atuais, novaSecao()]);
  }

  function removerSecao(indice) {
    setSecoes((atuais) => (atuais.length === 1 ? atuais : atuais.filter((_, atualIndice) => atualIndice !== indice)));
  }

  function alterarCriterio(secaoIndice, criterioIndice, campo, valor) {
    setSecoes((atuais) =>
      atuais.map((secao, atualSecaoIndice) => {
        if (atualSecaoIndice !== secaoIndice) return secao;
        return {
          ...secao,
          criterios: secao.criterios.map((criterio, atualCriterioIndice) =>
            atualCriterioIndice === criterioIndice ? { ...criterio, [campo]: valor } : criterio,
          ),
        };
      }),
    );
  }

  function adicionarCriterio(secaoIndice) {
    setSecoes((atuais) =>
      atuais.map((secao, atualSecaoIndice) =>
        atualSecaoIndice === secaoIndice
          ? {
              ...secao,
              criterios: [...secao.criterios, { nome: "", enunciado: "", peso: "10", eliminatoria: false }],
            }
          : secao,
      ),
    );
  }

  function removerCriterio(secaoIndice, criterioIndice) {
    setSecoes((atuais) =>
      atuais.map((secao, atualSecaoIndice) => {
        if (atualSecaoIndice !== secaoIndice || secao.criterios.length === 1) return secao;
        return {
          ...secao,
          criterios: secao.criterios.filter((_, atualCriterioIndice) => atualCriterioIndice !== criterioIndice),
        };
      }),
    );
  }

  return (
    <AppShell active="Formulários" breadcrumb="Formulários > Cadastro">
      <section className="page-header">
        <div className={styles.tituloComIcone}>
          <Link className="btn ghost icon-only" href="/formularios">
            <Icon name="chevronLeft" size={16} label="Voltar" />
          </Link>
          <div>
            <h1>Cadastro de Formulários</h1>
            <p>Crie a ficha base para uma operação.</p>
          </div>
        </div>
      </section>

      <form className={`card pad ${styles.formPanel}`} onSubmit={salvar}>
        <div className="field">
          <label htmlFor="nome">Nome do formulário</label>
          <input
            className="input"
            id="nome"
            value={form.nome}
            onChange={(evento) => setForm((atual) => ({ ...atual, nome: evento.target.value }))}
            placeholder="Ex: Formulário Educacional | Cruzeiro"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="cliente">Cliente</label>
          <select
            className="select"
            id="cliente"
            value={form.clienteId}
            onChange={(evento) => setForm((atual) => ({ ...atual, clienteId: evento.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="categoria">Categoria</label>
          <select
            className="select"
            id="categoria"
            value={form.categoria}
            onChange={(evento) => setForm((atual) => ({ ...atual, categoria: evento.target.value }))}
          >
            <option value="padrao">Padrão</option>
            <option value="diagnostico">Diagnóstico</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            className="select"
            id="status"
            value={form.status}
            onChange={(evento) => setForm((atual) => ({ ...atual, status: evento.target.value }))}
          >
            <option value="rascunho">Rascunho</option>
            <option value="desenvolvimento">Desenvolvimento</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <section className={styles.builder} aria-labelledby="criterios-formulario">
          <div className="section-head">
            <div>
              <h2 id="criterios-formulario">Seções e critérios</h2>
              <p>Cadastre os itens que a IA deve avaliar neste formulário.</p>
            </div>
            <button className="btn" type="button" onClick={adicionarSecao}>
              <Icon name="plus" size={16} />
              Adicionar seção
            </button>
          </div>

          {secoes.map((secao, secaoIndice) => (
            <div className={styles.secaoEditor} key={`secao-${secaoIndice}`}>
              <div className={styles.secaoTopo}>
                <div className="field">
                  <label htmlFor={`secao-${secaoIndice}`}>Nome da seção</label>
                  <input
                    className="input"
                    id={`secao-${secaoIndice}`}
                    value={secao.nome}
                    onChange={(evento) => alterarSecao(secaoIndice, "nome", evento.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn danger icon-only"
                  type="button"
                  onClick={() => removerSecao(secaoIndice)}
                  disabled={secoes.length === 1}
                >
                  <Icon name="trash" size={16} label="Remover seção" />
                </button>
              </div>

              <div className="field">
                <label htmlFor={`secao-desc-${secaoIndice}`}>Descrição da seção</label>
                <textarea
                  className="input"
                  id={`secao-desc-${secaoIndice}`}
                  value={secao.descricao}
                  onChange={(evento) => alterarSecao(secaoIndice, "descricao", evento.target.value)}
                  rows={2}
                />
              </div>

              <div className={styles.criteriosList}>
                {secao.criterios.map((criterio, criterioIndice) => (
                  <div className={styles.criterioEditor} key={`criterio-${secaoIndice}-${criterioIndice}`}>
                    <div className={styles.criterioGrid}>
                      <div className="field">
                        <label htmlFor={`criterio-nome-${secaoIndice}-${criterioIndice}`}>Critério</label>
                        <input
                          className="input"
                          id={`criterio-nome-${secaoIndice}-${criterioIndice}`}
                          value={criterio.nome}
                          onChange={(evento) =>
                            alterarCriterio(secaoIndice, criterioIndice, "nome", evento.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`criterio-peso-${secaoIndice}-${criterioIndice}`}>Peso</label>
                        <input
                          className="input"
                          disabled={criterio.eliminatoria}
                          id={`criterio-peso-${secaoIndice}-${criterioIndice}`}
                          min="0"
                          step="0.01"
                          type="number"
                          value={criterio.peso}
                          onChange={(evento) =>
                            alterarCriterio(secaoIndice, criterioIndice, "peso", evento.target.value)
                          }
                        />
                      </div>

                      <label className={styles.checkboxLinha}>
                        <input
                          checked={criterio.eliminatoria}
                          type="checkbox"
                          onChange={(evento) =>
                            alterarCriterio(secaoIndice, criterioIndice, "eliminatoria", evento.target.checked)
                          }
                        />
                        Eliminatório
                      </label>

                      <button
                        className="btn danger icon-only"
                        type="button"
                        onClick={() => removerCriterio(secaoIndice, criterioIndice)}
                        disabled={secao.criterios.length === 1}
                      >
                        <Icon name="trash" size={16} label="Remover critério" />
                      </button>
                    </div>

                    <div className="field">
                      <label htmlFor={`criterio-enunciado-${secaoIndice}-${criterioIndice}`}>O que avaliar</label>
                      <textarea
                        className="input"
                        id={`criterio-enunciado-${secaoIndice}-${criterioIndice}`}
                        value={criterio.enunciado}
                        onChange={(evento) =>
                          alterarCriterio(secaoIndice, criterioIndice, "enunciado", evento.target.value)
                        }
                        required
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn" type="button" onClick={() => adicionarCriterio(secaoIndice)}>
                <Icon name="plus" size={16} />
                Adicionar critério
              </button>
            </div>
          ))}
        </section>

        <div className="btn-row">
          <button className="btn primary" disabled={status === "saving"} type="submit">
            <Icon name={status === "saving" ? "spinner" : "check"} size={16} />
            {status === "saving" ? "Salvando..." : "Salvar formulário"}
          </button>
          <Link className="btn" href="/formularios">
            Cancelar
          </Link>
        </div>

        {mensagem ? (
          <p className={`alert ${status === "error" ? "danger" : "success"}`}>
            <Icon name={status === "error" ? "error" : "checkCircle"} size={18} />
            <span>{mensagem}</span>
          </p>
        ) : null}
      </form>
    </AppShell>
  );
}
