import { normalizar } from "@/lib/formato";
import { Icon } from "./icons";
import styles from "./CriterioCard.module.css";

/**
 * Cartão de um critério da ficha — o mesmo componente na ficha de monitoria
 * humana e nos detalhes da avaliação IA.
 *
 * As duas telas recebem o critério em formatos diferentes: a ficha
 * (`GET /api/avaliacoes/{codigo}`) manda `enunciado`, `statusChave` e um objeto
 * `ia: { evidencia, confianca, raciocinio }`; a análise IA
 * (`GET /api/transcricoes/{id}`) manda `descricao`, `status` já como chave e os
 * campos da IA soltos na raiz. `normalizarCriterio` achata os dois num só
 * formato para o cartão não precisar saber de onde veio — e para que campo
 * novo que o backend ainda não devolve simplesmente não renderize seu bloco.
 */

const ROTULO_STATUS = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  nao_aplicavel: "Não Aplicável",
  revisar: "Revisar",
};

const TOM_CHIP = {
  conforme: "success",
  nao_conforme: "danger",
  nao_aplicavel: "warning",
  revisar: "info",
};

const ICONE_STATUS = {
  conforme: "checkCircle",
  nao_conforme: "error",
  nao_aplicavel: "info",
  revisar: "alert",
};

/** Aceita "Não Conforme", "nao_conforme" e "NAO CONFORME" como o mesmo estado. */
export function chaveStatus(criterio) {
  const texto = normalizar(criterio?.statusChave ?? criterio?.status).replace(/[\s-]+/g, "_");
  if (texto.startsWith("nao_conforme")) return "nao_conforme";
  if (texto.startsWith("nao_aplicavel")) return "nao_aplicavel";
  if (texto.startsWith("conforme")) return "conforme";
  return "revisar";
}

export function rotuloStatus(chave) {
  return ROTULO_STATUS[chave] || ROTULO_STATUS.revisar;
}

/** 0..1 ou 0..100 -> "78%". A IA manda fração; o banco às vezes já manda %. */
export function percentual(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return `${Math.round(numero > 1 ? numero : numero * 100)}%`;
}

function tamanhoLegivel(bytes) {
  const numero = Number(bytes);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  if (numero < 1024) return `${numero} B`;
  if (numero < 1024 * 1024) return `${(numero / 1024).toFixed(0)} KB`;
  return `${(numero / (1024 * 1024)).toFixed(1)} MB`;
}

/** Primeiro valor numérico utilizável da lista; `null` se nenhum servir. */
function primeiroNumero(...valores) {
  for (const valor of valores) {
    if (valor === null || valor === undefined || valor === "") continue;
    const numero = Number(valor);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}

export function normalizarCriterio(bruto, indice = 0) {
  const ia = bruto?.ia && typeof bruto.ia === "object" ? bruto.ia : null;
  const chave = chaveStatus(bruto);

  return {
    id: bruto?.id ?? `${bruto?.nome ?? "criterio"}-${indice}`,
    nome: bruto?.nome || "Critério sem nome",
    enunciado: bruto?.enunciado ?? bruto?.descricao ?? null,
    // `resposta` vem literal do banco (`nao`, `diagnostico`, rótulo próprio da
    // carteira); `respostaLabel` é o legível dos valores conhecidos.
    resposta: bruto?.respostaLabel ?? bruto?.resposta ?? null,
    statusChave: chave,
    statusRotulo: rotuloStatus(chave),
    // `peso` da API é o peso APLICADO — 0 em todo critério não conforme. O que a
    // ficha exibe é o peso de cadastro do critério (`pesoCriterio`): o print
    // mostra "Peso: 15 pts" num item Não Conforme, não "Peso: 0 pts".
    peso: primeiroNumero(bruto?.pesoCriterio, bruto?.peso),
    eliminatoria: Boolean(bruto?.eliminatoria),
    observacao: bruto?.observacao || null,
    anexos: Array.isArray(bruto?.anexos) ? bruto.anexos : [],
    evidencia: ia?.evidencia ?? bruto?.evidencia ?? null,
    confianca: ia?.confianca ?? bruto?.confianca ?? null,
    raciocinio: ia?.raciocinio ?? bruto?.raciocinio ?? null,
  };
}

/** Achata `secoes[].criterios[]` já normalizados, guardando a seção de origem. */
export function criteriosDeSecoes(secoes) {
  return (Array.isArray(secoes) ? secoes : []).flatMap((secao, indiceSecao) =>
    (secao?.criterios || []).map((criterio, indice) => ({
      ...normalizarCriterio(criterio, `${indiceSecao}-${indice}`),
      secao: secao?.nome || "Sem seção",
    })),
  );
}

/** Conta conformes/não conformes/não aplicáveis de uma lista de critérios. */
export function contarConformidade(criterios) {
  const lista = Array.isArray(criterios) ? criterios : [];
  return {
    conformes: lista.filter((item) => item.statusChave === "conforme").length,
    naoConformes: lista.filter((item) => item.statusChave === "nao_conforme").length,
    naoAplicaveis: lista.filter((item) => item.statusChave === "nao_aplicavel").length,
    total: lista.length,
  };
}

export default function CriterioCard({ criterio, nivelTitulo = 4 }) {
  const dados = criterio?.statusChave ? criterio : normalizarCriterio(criterio);
  const Titulo = `h${Math.min(Math.max(nivelTitulo, 2), 6)}`;
  const confianca = percentual(dados.confianca);
  const anexos = dados.anexos;

  return (
    <article className={styles.criterio} data-status={dados.statusChave}>
      <header className={styles.topo}>
        <Titulo className={styles.nome}>{dados.nome}</Titulo>
        {/* Ícone + texto: o estado nunca depende só da cor (WCAG 1.4.1). */}
        <span className={`chip ${TOM_CHIP[dados.statusChave]}`}>
          <Icon name={ICONE_STATUS[dados.statusChave]} size={13} />
          {dados.statusRotulo}
        </span>
      </header>

      {dados.enunciado ? (
        <p className={styles.enunciado}>
          <span className={styles.rotuloInline}>Descrição:</span> {dados.enunciado}
        </p>
      ) : null}

      <p className={styles.resposta}>
        <span className={styles.rotuloInline}>Resposta:</span> {dados.resposta || "Não registrada"}
      </p>

      {dados.observacao ? (
        <div className={styles.bloco} data-tom="monitor">
          <p className={styles.blocoTitulo}>
            <Icon name="feedback" size={14} />
            Observação do Monitor
          </p>
          <p>{dados.observacao}</p>
        </div>
      ) : null}

      {anexos.length > 0 ? (
        <div className={styles.bloco} data-tom="anexo">
          <p className={styles.blocoTitulo}>
            <Icon name="paperclip" size={14} />
            Anexos ({anexos.length})
          </p>
          <ul className={styles.anexos}>
            {anexos.map((anexo, indice) => {
              const tamanho = anexo?.tamanhoLabel || tamanhoLegivel(anexo?.tamanhoBytes);
              const nome = anexo?.nome || "Arquivo sem nome";
              return (
                <li key={anexo?.id ?? `${nome}-${indice}`}>
                  {anexo?.url ? (
                    <a href={anexo.url} download>
                      <Icon name="download" size={14} />
                      {nome}
                    </a>
                  ) : (
                    <span>
                      <Icon name="paperclip" size={14} />
                      {nome}
                    </span>
                  )}
                  {tamanho ? <span className={styles.anexoTamanho}>{tamanho}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {dados.evidencia ? (
        <div className={styles.bloco} data-tom="evidencia">
          <p className={styles.blocoTitulo}>
            <Icon name="quote" size={14} />
            Evidência da IA (trecho da transcrição)
            {confianca ? <span className={styles.confianca}>Confiança: {confianca}</span> : null}
          </p>
          <blockquote className={styles.evidencia}>{dados.evidencia}</blockquote>
        </div>
      ) : null}

      {dados.raciocinio ? (
        <div className={styles.bloco} data-tom="raciocinio">
          <p className={styles.blocoTitulo}>
            <Icon name="brain" size={14} />
            Notas da IA (raciocínio)
          </p>
          <p>{dados.raciocinio}</p>
        </div>
      ) : null}

      {dados.peso !== null || dados.eliminatoria ? (
        <footer className={styles.rodape}>
          {dados.peso !== null ? (
            <span className={styles.peso}>
              Peso: <strong>{dados.peso} pts</strong>
            </span>
          ) : null}
          {dados.eliminatoria ? (
            <span className="chip danger">
              <Icon name="alert" size={13} />
              Eliminatória
            </span>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
