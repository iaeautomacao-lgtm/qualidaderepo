"use client";

import { useState } from "react";
import Link from "next/link";
import { enviarApi } from "@/lib/api";
import { Icon } from "./icons";
import styles from "./TrocarSenha.module.css";

const MINIMO = 8;

/**
 * Troca da própria senha.
 *
 * O mesmo formulário serve os dois casos, e a diferença entre eles é só o
 * enquadramento:
 *
 * - `obrigatoria`: a pessoa entrou com a senha padrão e o sistema está fechado
 *   até ela trocar. Aqui não existe "cancelar" — sair é o botão de sair.
 * - voluntária: a pessoa foi em Minha conta trocar a senha por decisão dela.
 *
 * Não é a tela que garante a troca. Quem garante é `requireSession`, que recusa
 * toda rota de dados enquanto `trocar_senha` estiver em 1 — um formulário que
 * dá para contornar pela URL não protege nada.
 */
export default function TrocarSenha({ obrigatoria = false, onTrocada }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mostrando, setMostrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);

  const divergem = repetida.length > 0 && nova !== repetida;
  const curta = nova.length > 0 && nova.length < MINIMO;
  const incompleto =
    senhaAtual.length === 0 || nova.length < MINIMO || nova !== repetida;

  async function enviar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);

    try {
      await enviarApi("/api/auth/senha", { senhaAtual, novaSenha: nova });
      // Limpa antes de qualquer navegação: senha digitada não fica em estado de
      // componente esperando o próximo render.
      setSenhaAtual("");
      setNova("");
      setRepetida("");
      setPronto(true);
      onTrocada?.();
    } catch (causa) {
      setErro(causa.message);
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <section className={`card pad ${styles.caixa}`}>
        <p className="alert success">
          <Icon name="checkCircle" size={16} />
          <span className="alert-body">
            <strong>Senha alterada</strong>
            <span>
              As outras sessões abertas com a senha anterior foram encerradas. Use a senha nova no
              próximo acesso.
            </span>
          </span>
        </p>
        {obrigatoria ? (
          <div className="btn-row">
            <Link className="btn primary" href="/">
              <Icon name="chevronRight" size={16} />
              Entrar no sistema
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <form className={`card pad ${styles.caixa}`} onSubmit={enviar}>
      <div className="section-head">
        <div>
          <h2>{obrigatoria ? "Troque a senha para continuar" : "Trocar minha senha"}</h2>
          <p>
            {obrigatoria
              ? "Você entrou com a senha padrão do sistema. Escolha uma senha só sua — o restante do QualiDDM abre depois disso."
              : "A senha nova passa a valer agora, e as outras sessões abertas são encerradas."}
          </p>
        </div>
      </div>

      {obrigatoria ? (
        <p className="alert warning">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>A senha padrão é a mesma para todos</strong>
            <span>
              Enquanto ela estiver valendo, qualquer pessoa que a conheça pode entrar nesta conta.
              Por isso o sistema fica bloqueado até a troca.
            </span>
          </span>
        </p>
      ) : null}

      {erro ? (
        <p className="alert danger" role="alert">
          <Icon name="alert" size={16} />
          <span className="alert-body">
            <strong>Não foi possível trocar</strong>
            <span>{erro}</span>
          </span>
        </p>
      ) : null}

      <div className={styles.campos}>
        <div className="field">
          <label htmlFor="senha-atual">Senha atual</label>
          <input
            className="input"
            id="senha-atual"
            type={mostrando ? "text" : "password"}
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(evento) => setSenhaAtual(evento.target.value)}
          />
          {obrigatoria ? (
            <span className="field-hint">
              É a senha padrão que você recebeu para o primeiro acesso.
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="senha-nova">Senha nova</label>
          <input
            className="input"
            id="senha-nova"
            type={mostrando ? "text" : "password"}
            autoComplete="new-password"
            value={nova}
            aria-invalid={curta ? "true" : undefined}
            aria-describedby="dica-nova"
            onChange={(evento) => setNova(evento.target.value)}
          />
          <span className="field-hint" id="dica-nova">
            {curta
              ? `Faltam ${MINIMO - nova.length} caractere(s) para o mínimo de ${MINIMO}.`
              : `Mínimo de ${MINIMO} caracteres. Não pode ser a senha padrão.`}
          </span>
        </div>

        <div className="field">
          <label htmlFor="senha-repetida">Repita a senha nova</label>
          <input
            className="input"
            id="senha-repetida"
            type={mostrando ? "text" : "password"}
            autoComplete="new-password"
            value={repetida}
            aria-invalid={divergem ? "true" : undefined}
            aria-describedby="dica-repetida"
            onChange={(evento) => setRepetida(evento.target.value)}
          />
          <span className="field-hint" id="dica-repetida">
            {divergem ? "As duas senhas não são iguais." : "Confirmação, para evitar erro de digitação."}
          </span>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn primary" type="submit" disabled={incompleto || enviando}>
          <Icon
            className={enviando ? "spinning" : undefined}
            name={enviando ? "spinner" : "key"}
            size={16}
          />
          {enviando ? "Trocando..." : "Trocar senha"}
        </button>

        {/* Um botão, não três campos com o olhinho: quem digita senha em pé no
            meio da operação precisa conferir o que digitou, e o controle único
            evita revelar um campo e esquecer o outro visível. */}
        <button
          className="btn ghost"
          type="button"
          aria-pressed={mostrando}
          onClick={() => setMostrando((atual) => !atual)}
        >
          <Icon name={mostrando ? "eyeOff" : "eye"} size={16} />
          {mostrando ? "Ocultar senhas" : "Mostrar senhas"}
        </button>
      </div>
    </form>
  );
}
