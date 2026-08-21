"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

const highlights = [
  { icon: "upload", label: "Upload de áudio", detail: "Mono ou estéreo, até 25 MB por chamada" },
  { icon: "sparkles", label: "Transcrição automática", detail: "Diarização por interlocutor" },
  { icon: "checklist", label: "Checklist por carteira", detail: "Cada carteira com sua regra de negócio" },
  { icon: "gauge", label: "KPIs semanais e mensais", detail: "Nota, confiança e tendência" },
];

/**
 * Só aceita caminho interno. `//evil.com` e `https://evil.com` são URLs
 * absolutas disfarçadas — mandar o usuário para lá depois do login é open
 * redirect clássico.
 */
function safeNext(raw) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // A API já devolve mensagem genérica em 401 — não distingue e-mail
        // inexistente de senha errada, para não virar oráculo de enumeração.
        setError(payload?.error?.message ?? "Não foi possível entrar. Tente novamente.");
        return;
      }

      // Senha ainda é a padrão: vai direto para a troca em vez de cair numa
      // tela cheia de erro. O `next` fica de fora de propósito — depois da
      // troca a pessoa entra pela home, e não numa rota que ela pediu antes de
      // ter acesso liberado.
      if (payload?.data?.user?.trocarSenha) {
        router.replace("/conta/senha");
        router.refresh();
        return;
      }

      // Lido de window em vez de useSearchParams: aquele hook obrigaria a
      // envolver a página inteira em <Suspense> por causa da renderização
      // estática.
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNext(next));
      router.refresh();
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-aside" aria-label="Sobre o QualiDDM">
        {/* Dimensões reais do arquivo (640x317); o CSS controla o tamanho na
            tela mantendo a proporção. A arte já traz o nome e a assinatura da
            marca, então aqui embaixo fica só o que ela não diz. */}
        <div className="auth-brand">
          <Image src="/logo-qualiddm-v2.png" alt="QualiDDM" width={640} height={317} priority />
          <span>Monitoria de qualidade com IA</span>
        </div>

        <p className="auth-pitch">
          Todo áudio que entra vira transcrição, nota e plano de ação — carteira por carteira.
        </p>

        <ul className="auth-highlights">
          {highlights.map((item) => (
            <li key={item.label}>
              <span className="icon-badge sm" aria-hidden="true">
                <Icon name={item.icon} size={16} />
              </span>
              <span className="row-main">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <main className="auth-main" id="conteudo">
        <div className="auth-card card pad">
          <div className="auth-card-head">
            <Image
              className="auth-logo-compact"
              src="/logo-qualiddm-v2.png"
              alt="QualiDDM"
              width={640}
              height={317}
              priority
            />
            <h1>Entrar</h1>
            <p>Use as credenciais corporativas da DDM.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="alert danger" role="alert">
                <Icon name="error" size={18} />
                <div className="alert-body">
                  <strong>Não foi possível entrar</strong>
                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={180}
                aria-invalid={error ? "true" : undefined}
                placeholder="nome@grupoddm.com.br"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                aria-invalid={error ? "true" : undefined}
                aria-describedby="password-hint"
              />
              <span className="field-hint" id="password-hint">
                Mínimo de 8 caracteres.
              </span>
            </div>

            <button className="btn primary" type="submit" disabled={pending}>
              <Icon
                className={pending ? "spinning" : undefined}
                name={pending ? "spinner" : "login"}
                size={17}
              />
              {pending ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="auth-footnote">
            Acesso restrito. Tentativas são registradas em log de auditoria.
          </p>
        </div>
      </main>
    </div>
  );
}
