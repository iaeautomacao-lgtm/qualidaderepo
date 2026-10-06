import Link from "next/link";
import { Icon } from "@/components/icons";
import { ModuleKpis, MonitorIaPageShell, StatusDot } from "../ModuleScaffold";
import styles from "../page.module.css";

const lotes = [
  { id: "firjan-3128", nome: "Lote 06/10/2026 - Monitor IA Firjan", persona: "Monitor IA Firjan", formulario: "IA FIRJAN >>> TELEFONE RECEPTIVO", pct: 100 },
  { id: "vero-churn", nome: "Lote 05/10/2026 - Monitor IA Vero", persona: "Monitor IA Vero", formulario: "Avaliação de atendimento Vero - Churn", pct: 82 },
];

export default function HistoricoUploadsPage() {
  return (
    <MonitorIaPageShell
      title="Histórico de Uploads"
      subtitle="Lotes enviados para processamento automático."
      actions={<><button className="btn" type="button"><Icon name="refresh" size={16} />Atualizar</button><Link className="btn primary" href="/monitor-ia/upload"><Icon name="plus" size={16} />Novo Upload</Link></>}
    >
      <ModuleKpis items={[{ label: "Todos", value: "2", icon: "layers" }, { label: "Processando", value: "1", icon: "clock" }, { label: "Concluídos", value: "1", icon: "checkCircle" }, { label: "Falhas", value: "0", icon: "alert" }]} />
      <div className={styles.tabs}><button>Todos</button><button>Processando</button><button>Concluídos</button><button>Falhas</button></div>
      <section className={styles.listStack}>{lotes.map((lote) => <article className="card pad" key={lote.id}><div className="section-head"><div><h2>{lote.nome} <StatusDot tone="success" label="Concluído" /></h2><p>{lote.persona} • {lote.formulario}</p></div><div className="actions"><Link className="btn" href={`/monitor-ia/uploads/${lote.id}`}>Abrir lote</Link><button className="btn" type="button">Excluir análises</button><button className="btn danger" type="button">Excluir lote</button></div></div><div className={styles.progress}><span style={{ width: `${lote.pct}%` }} /></div><p>Concluído: {lote.pct}% processado, 0 falhas</p></article>)}</section>
    </MonitorIaPageShell>
  );
}