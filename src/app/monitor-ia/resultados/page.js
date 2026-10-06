import Link from "next/link";
import { FilterBar, ModuleKpis, MonitorIaPageShell, SimpleTable, StatusDot } from "../ModuleScaffold";
import styles from "../page.module.css";

export default function ResultadosPage() {
  return (
    <MonitorIaPageShell title="Resultados Monitor IA" subtitle="Breakdown executivo" actions={<Link className="btn primary" href="/monitor-ia/avaliacoes">Ver avaliações</Link>}>
      <FilterBar><select className="select"><option>Persona</option></select><select className="select"><option>Formulário</option></select><input className="input" type="date" /><label><input type="checkbox" /> Baixa confiança</label><label><input type="checkbox" /> Somente com N/C</label><label><input type="checkbox" /> Somente falhas</label><button className="btn primary" type="button">Aplicar</button></FilterBar>
      <ModuleKpis items={[{ label: "Avaliações", value: "1351" }, { label: "Nota média", value: "47.4" }, { label: "Confiança", value: "77.3%" }, { label: "Não conformes", value: "312" }, { label: "Falhas", value: "8" }]} />
      <section className="card pad"><h2>Por Formulário</h2><SimpleTable columns={["Formulário", "Total", "Pendente", "Processados", "Erro", "Ver"]} rows={[["IA FIRJAN >>> TELEFONE RECEPTIVO", "65", "0", "65", "0", <Link key="v" href="/monitor-ia/avaliacoes?formulario=3128">Ver</Link>]]} /></section>
      <section className="card pad"><h2>Top critérios com mais falhas</h2><div className={styles.listStack}><p><strong>Orientações finais</strong><br />Formulário • Fechamento • falhas/total <StatusDot tone="danger" label="Falhas" /></p><p><strong>Disponibilidade</strong><br />Formulário • Encerramento • falhas/total <StatusDot tone="warning" label="Atenção" /></p></div></section>
    </MonitorIaPageShell>
  );
}