import ModuloEmConstrucao from "@/components/ModuloEmConstrucao";

export default function AdministracaoPage() {
  return (
    <ModuloEmConstrucao
      active="Administração"
      breadcrumb="Sistema > Administração"
      titulo="Administração"
      proposito="Cadastros e permissões do sistema: usuários, perfis de acesso, clientes e campanhas."
      icone="settings"
      disponivel="será aqui que você cria usuários, define o que cada perfil pode ver e mantém os cadastros em dia."
      atalho={{
        href: "/relatorios",
        rotulo: "Ver relatórios",
        icone: "metrics",
        motivo:
          "Os relatórios “Usuários” e “Extração de Campanhas” já mostram o que está cadastrado hoje.",
      }}
    />
  );
}
