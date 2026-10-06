import { Icon } from "@/components/icons";
import { FilterBar, ModuleKpis, MonitorIaPageShell, SimpleTable, StatusDot } from "../ModuleScaffold";
import styles from "../page.module.css";

export default function FilaPage() {
  return (
    <MonitorIaPageShell title="Fila de Processamento" subtitle="Acompanhe lotes, arquivos e transcrições do Monitor IA." actions={<button className="btn" type="button"><Icon name="refresh" size={16} />Atualizar</button>}>
      <ModuleKpis items={[{ label: "Lotes", value: "519" }, { label: "Concluídos", value: "1.284" }, { label: "Processando", value: "37" }, { label: "Falhas", value: "8" }, { label: "Enviados", value: "1.500+" }]} />
      <FilterBar><input className="input" placeholder="arquivo, texto, persona..." /><select className="select"><option>Status: Todos</option><option>Concluídos</option><option>Transcrevendo</option><option>Preenchendo</option><option>Falhas</option></select><select className="select"><option>Lote: Todos</option></select></FilterBar>
      <section className="card pad"><h2>Lotes</h2><div className={styles.progressSegment}><span data-tone="success" style={{ width: "72%" }} /><span data-tone="warning" style={{ width: "20%" }} /><span data-tone="danger" style={{ width: "8%" }} /></div><p><StatusDot tone="success" label="Concluído" /> <StatusDot tone="warning" label="Processando" /> <StatusDot tone="danger" label="Falha" /></p><SimpleTable columns={["Arquivo", "Status", "Ação"]} rows={[["PALOMA 23-09.mp3", <StatusDot key="s" tone="success" label="Concluído" />, <button key="b" className="btn" type="button">Ver transcrição</button>], ["PABLO-22-09.mp3", <StatusDot key="p" tone="warning" label="Preenchendo" />, "-"]]} /></section>
    </MonitorIaPageShell>
  );
}