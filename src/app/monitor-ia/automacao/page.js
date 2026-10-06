import { Icon } from "@/components/icons";
import { MonitorIaPageShell } from "../ModuleScaffold";
import styles from "../page.module.css";

export default function AutomacaoPage() {
  return (
    <MonitorIaPageShell title="Monitoria automática" subtitle="Ponte Acervo → Monitor IA: gravação que casa com a regra vira monitoria sozinha." actions={<><button className="btn" type="button"><Icon name="refresh" size={16} />Atualizar</button><button className="btn primary" type="button"><Icon name="plus" size={16} />Nova regra</button></>}>
      <p className="alert warning"><Icon name="alert" size={18} /><span>A regra vale só para o que chegar depois de criada, e o teto por dia é o freio. Confira a simulação antes de ativar.</span></p>
      <section className={`card pad ${styles.emptyModule}`}><Icon name="robot" size={42} /><h2>Nenhuma regra ainda</h2><p>Crie uma regra para ligar acervo, cliente, campanha, Monitor IA e teto diário.</p><div className="actions"><button className="btn" type="button">Cancelar</button><button className="btn" type="button">Salvar desligada</button><button className="btn primary" type="button">Salvar e ativar</button></div></section>
    </MonitorIaPageShell>
  );
}