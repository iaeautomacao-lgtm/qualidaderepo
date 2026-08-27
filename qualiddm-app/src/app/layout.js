import "./globals.css";

export const metadata = {
  title: "QualiDDM - Monitoria e Qualidade",
  description: "Plataforma de qualidade e feedback com IA para call centers.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Não trave o zoom: WCAG 2.2 1.4.4 exige ampliação até 200%.
  themeColor: "#ff5106",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* Roda antes de qualquer pintura, de proposito.

            Se a escolha do tema so fosse aplicada depois que o React monta, a
            pagina apareceria clara por uma fracao de segundo antes de virar
            escura -- o "flash" branco que incomoda justamente quem escolheu o
            escuro. Por isso e script sincrono no topo do body, e nao efeito de
            componente. O try/catch cobre navegador com armazenamento bloqueado:
            sem ele, uma excecao aqui abortaria o resto do documento. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("qualiddm-tema")==="escuro")' +
              'document.documentElement.setAttribute("data-theme","escuro")}catch(e){}',
          }}
        />
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
