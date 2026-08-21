"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import TrocarSenha from "@/components/TrocarSenha";
import { Icon } from "@/components/icons";

/**
 * Minha conta > Senha.
 *
 * Rota própria para quem quer trocar a senha por decisão própria, sem esperar
 * um reset. Quando a senha ainda é a padrão, o AppShell já assume a tela em
 * qualquer rota — então aqui o formulário aparece no modo voluntário.
 */
export default function TrocarSenhaPage() {
  return (
    <AppShell active="Dashboard" breadcrumb="Minha conta > Senha">
      <section className="page-header">
        <div>
          <h1>Minha senha</h1>
          <p>Trocar a senha de acesso ao QualiDDM</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/">
            <Icon name="chevronLeft" size={16} />
            Dashboard
          </Link>
        </div>
      </section>

      <TrocarSenha />

      <p className="subtle-text">
        Esqueceu a senha? Só um administrador pode redefinir, em Gestão &gt; Usuários. A senha volta
        para a padrão e o sistema exige a troca no acesso seguinte.
      </p>
    </AppShell>
  );
}
