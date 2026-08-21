import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";

const MODULOS = [
  {
    href: "/gestao/usuarios",
    titulo: "Usuários",
    detalhe: "Gerencie acessos, cargos, supervisores e escopo por campanha.",
    icone: "users",
    tom: "blue",
  },
  {
    href: "/gestao/turnos",
    titulo: "Turnos",
    detalhe: "Cadastre e organize os turnos de trabalho da operação.",
    icone: "clock",
    tom: "yellow",
  },
  {
    href: "/gestao/metas",
    titulo: "Metas mensais",
    detalhe: "Defina e acompanhe metas de monitoria por período.",
    icone: "target",
    tom: "green",
  },
  {
    href: "/gestao/bugs",
    titulo: "Bugs e Reports",
    detalhe: "Registre, priorize e acompanhe problemas e melhorias.",
    icone: "bug",
    tom: "red",
  },
];

export default function PainelGestao() {
  return (
    <AppShell active="Gestão" breadcrumb="Gestão">
      <section className="page-header">
        <div>
          <h1>Gestão</h1>
          <p>Usuários, turnos, metas e suporte da plataforma.</p>
        </div>
      </section>

      <section className="card pad" aria-labelledby="titulo-modulos-gestao">
        <div className="section-head">
          <div>
            <h2 id="titulo-modulos-gestao">Módulos de gestão</h2>
            <p>Selecione o cadastro que deseja administrar.</p>
          </div>
        </div>

        <ul className="tile-grid">
          {MODULOS.map((modulo) => (
            <li key={modulo.href}>
              <Link className="tile" href={modulo.href}>
                <span className="icon-tile" data-tom={modulo.tom} aria-hidden="true">
                  <Icon name={modulo.icone} size={20} />
                </span>
                <span className="tile-body">
                  <strong>{modulo.titulo}</strong>
                  <span>{modulo.detalhe}</span>
                </span>
                <Icon className="tile-chevron" name="chevronRight" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
