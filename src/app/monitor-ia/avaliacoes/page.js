import Link from "next/link";
import { Icon } from "@/components/icons";
import { FilterBar, ModuleKpis, MonitorIaPageShell, SimpleTable, StatusDot } from "../ModuleScaffold";

export default function AvaliacoesMonitorIaPage() {
  return (
    <MonitorIaPageShell title="Avaliações IA" subtitle="Visualize formulários preenchidos automaticamente pelo Monitor IA." actions={<><Link className="btn" href="/api/avaliacoes/exportar"><Icon name="download" size={16} />Exportar</Link><button className="btn" type="button"><Icon name="refresh" size={16} />Atualizar</button></>}>
      <ModuleKpis items={[{ label: "Total de Avaliações", value: "1351", icon: "review" }, { label: "Nota Média", value: "47.4", icon: "metrics" }, { label: "Confiança Média", value: "77.3%", icon: "target" }, { label: "Com Conceito", value: "0", icon: "trendUp" }]} />
      <FilterBar><input className="input" placeholder="Buscar por nome do arquivo..." /><select className="select"><option>Todas as Personas</option></select><select className="select"><option>Todos os Formulários</option></select><select className="select"><option>Todos os Clientes</option></select><select className="select"><option>Todas as Campanhas</option></select></FilterBar>
      <section className="card pad"><h2>Avaliações</h2><SimpleTable columns={["Arquivo", "Persona", "Formulário", "Nota", "Confiança", "Duração", "Data", "Ações"]} rows={[["PALOMA 23-09.mp3", "Monitor IA Vero", "Vero Ativo IA", "86.0", "83%", "3:14", "23/09/2026", <Link key="v" href="/avaliacoes?origem=ia&persona=Monitor%20IA%20Vero">Ver</Link>], ["Firjan-001.mp3", "Monitor IA Firjan", "IA FIRJAN >>> TELEFONE RECEPTIVO", "85.0", "86%", "2:43", "23/09/2026", <Link key="f" href="/avaliacoes?origem=ia&persona=Monitor%20IA%20Firjan">Ver</Link>]]} /></section>
    </MonitorIaPageShell>
  );
}