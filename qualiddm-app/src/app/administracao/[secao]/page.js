import { notFound } from "next/navigation";
import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";
import { funcionalidadePorId } from "../funcionalidades";

/**
 * Destino de qualquer cartão de Administração que ainda não tem tela própria.
 *
 * Uma rota dinâmica em vez de doze arquivos quase iguais: o texto de cada seção
 * já vive em `funcionalidades.js`, que é a mesma fonte que desenha os cartões.
 * Assim o cartão e a tela nunca divergem, e nenhum dos doze links devolve 404.
 *
 * Slug desconhecido cai em 404 de propósito — inventar uma tela para um id que
 * não está no catálogo esconderia um link errado no menu.
 */
export default async function AdministracaoSecaoPage({ params }) {
  const { secao } = await params;
  const item = funcionalidadePorId(secao);

  if (!item) notFound();

  return (
    <ModuloEmConstrucao
      active="Administração"
      breadcrumb={`Administração > ${item.rotulo}`}
      titulo={item.rotulo}
      proposito={item.proposito ?? item.detalhe}
      icone={item.icone}
      disponivel={
        item.disponivel ??
        `será aqui que você configura ${item.rotulo.toLowerCase()} sem depender de deploy.`
      }
      atalho={{
        href: "/administracao",
        rotulo: "Voltar para Administração",
        icone: "chevronLeft",
        motivo: "O painel de Administração lista tudo que já pode ser configurado hoje.",
      }}
    />
  );
}
