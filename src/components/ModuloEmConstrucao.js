import Link from "next/link";
import AppShell from "./AppShell";
import { Icon } from "./icons";

/**
 * Casca única das telas que ainda não têm referência visual.
 *
 * Estas telas existem para o menu não levar a lugar nenhum — e só. Não trazem
 * KPI, tabela nem gráfico de propósito: sem print e sem banco, qualquer número
 * aqui seria invenção, e número inventado vira decisão errada mais tarde.
 *
 * Cada uma diz o que o módulo vai fazer e oferece um caminho útil agora, para
 * o usuário não ficar num beco sem saída.
 */
export default function ModuloEmConstrucao({
  active,
  breadcrumb,
  titulo,
  proposito,
  icone,
  disponivel,
  atalho,
}) {
  return (
    <AppShell active={active} breadcrumb={breadcrumb}>
      <section className="page-header">
        <div>
          <h1>{titulo}</h1>
          <p>{proposito}</p>
        </div>
        <div className="actions">
          <span className="chip warning">
            <Icon name="alert" size={13} />
            Módulo em construção
          </span>
        </div>
      </section>

      <section className="card pad">
        <div className="empty-state">
          <span className="icon-badge">
            <Icon name={icone} size={22} />
          </span>
          <h2>Esta tela ainda não foi construída</h2>
          <p>
            Nada é exibido aqui porque ainda não existe dado real para este módulo. Quando
            ele entrar no ar, {disponivel}
          </p>
          <div className="btn-row">
            <Link className="btn primary" href={atalho.href}>
              <Icon name={atalho.icone} size={16} />
              {atalho.rotulo}
            </Link>
          </div>
          <p className="subtle-text">{atalho.motivo}</p>
        </div>
      </section>
    </AppShell>
  );
}
