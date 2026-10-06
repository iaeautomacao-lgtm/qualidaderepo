import { Icon } from "@/components/icons";
import { FilterBar, ModuleKpis, MonitorIaPageShell, StatusDot } from "../ModuleScaffold";
import styles from "../page.module.css";

export default function PerformancePage() {
  return (
    <MonitorIaPageShell title="Performance por Agente" subtitle="Onde cada agente mais erra e o que treinar com quem." actions={<><select className="select"><option>Todas as origens</option><option>Monitor IA</option><option>Manual</option></select><button className="btn" type="button"><Icon name="refresh" size={16} />Atualizar</button></>}>
      <FilterBar><input className="input" type="date" /><input className="input" type="date" /><select className="select"><option>Cliente</option></select><select className="select"><option>Campanha</option></select><select className="select"><option>Avaliado</option></select><button className="btn primary" type="button">Aplicar Filtros</button></FilterBar>
      <ModuleKpis items={[{ label: "Agentes avaliados", value: "42" }, { label: "Avaliações no recorte", value: "470" }, { label: "Nota média do time", value: "54.4" }]} />
      <section className={styles.twoColumns}><div className="card pad"><h2>Ranking</h2>{["Sônia Oliveira", "Paulo Victor", "Gabriela Barbosa"].map((nome, index) => <p key={nome}><span className="chip danger">{index + 1}</span> <strong>{nome}</strong><br />{5 + index} avaliações <StatusDot tone="danger" label="Omissão +67pp" /></p>)}</div><div className="card pad"><h2>O que treinar</h2><p><strong>Orientações finais</strong><br />Falha do agente 62% contra time 31%</p><div className={styles.compareBar}><span style={{ width: "62%" }} /><i style={{ width: "31%" }} /></div><p><strong>Histórico de notas</strong></p><div className={styles.fakeChart}><span /><span /><span /><span /></div></div></section>
    </MonitorIaPageShell>
  );
}