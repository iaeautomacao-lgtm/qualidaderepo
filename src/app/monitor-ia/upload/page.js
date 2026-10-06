import Link from "next/link";
import { Icon } from "@/components/icons";
import { FilterBar, MonitorIaPageShell } from "../ModuleScaffold";
import styles from "../page.module.css";

const passos = [
  "Envio",
  "Transcrição do áudio",
  "TXT entra direto",
  "PDF com extração de texto ou OCR",
  "CSV/Excel via template de conversa",
  "IA preenche o formulário",
  "Avaliação fica em revisão humana",
];

export default function MonitorIaUploadPage() {
  return (
    <MonitorIaPageShell
      title="Upload de Arquivos"
      subtitle="Envie lotes para o Monitor IA e acompanhe o processamento."
      actions={<Link className="btn" href="/monitor-ia/historico"><Icon name="history" size={16} />Ver histórico</Link>}
    >
      <section className="card pad">
        <div className="section-head"><div><h2>Configuração do Lote</h2><p>Escolha o Monitor IA, formulário e um nome opcional para rastrear o lote.</p></div></div>
        <div className={styles.configGrid3}>
          <label className="field">Monitor IA<select className="select"><option>Monitor IA Firjan - Telefone Receptivo</option><option>Monitor IA Vero - Churn</option><option>Monitor IA Yduqs - Telefone ativo</option></select></label>
          <label className="field">Formulário<select className="select"><option>IA FIRJAN &gt;&gt;&gt; TELEFONE RECEPTIVO</option><option>Formulário IA vinculado ao monitor</option></select></label>
          <label className="field">Nome do lote<input className="input" placeholder="SAC Janeiro 2026" /></label>
        </div>
      </section>
      <section className="card pad">
        <div className={styles.dropzone}><Icon name="upload" size={28} /><h2>Arraste arquivos aqui</h2><p>MP3/WAV, TXT/PDF ou CSV/Excel. Recomendado: até 500 arquivos por lote.</p><button className="btn primary" type="button">Selecionar arquivos</button></div>
        <div className="actions"><Link className="btn" href="/monitor-ia">Cancelar</Link><button className="btn primary" type="button" disabled>Iniciar Upload (0 arquivos)</button></div>
      </section>
      <section className="card pad"><h2>Como funciona</h2><ol className={styles.steps}>{passos.map((passo) => <li key={passo}>{passo}</li>)}</ol></section>
    </MonitorIaPageShell>
  );
}