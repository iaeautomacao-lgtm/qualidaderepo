import Link from "next/link";
import { MonitorIaPageShell, SimpleTable, StatusDot } from "../../ModuleScaffold";

export default function UploadDetalhePage({ params }) {
  const id = params?.id || "lote";
  return (
    <MonitorIaPageShell title={`Lote ${id}`} subtitle="Detalhe do lote e arquivos processados.">
      <section className="card pad"><div className="section-head"><div><h2>Lote carregado</h2><p>Monitor IA • Formulário • Data</p></div><StatusDot tone="success" label="Concluído" /></div></section>
      <section className="card pad"><h2>Arquivos</h2><SimpleTable columns={["Arquivo", "Status", "Avaliação"]} rows={[["audio-001.mp3", <StatusDot key="s" tone="success" label="Concluído" />, <Link key="a" href="/avaliacoes?origem=ia">Ver avaliação</Link>], ["audio-002.mp3", <StatusDot key="p" tone="warning" label="Processando" />, "-"]]} /></section>
    </MonitorIaPageShell>
  );
}