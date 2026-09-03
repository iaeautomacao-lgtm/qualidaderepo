/**
 * Ponto de entrada para o Phusion Passenger (cPanel > Setup Node.js App).
 *
 * O Passenger não sabe rodar `next start`: ele precisa de um arquivo .js que
 * suba um servidor HTTP. Este arquivo é essa ponte.
 *
 * CommonJS de propósito: o package.json não declara "type": "module", então
 * arquivos .js na raiz são CommonJS. Usar `import` aqui quebraria o boot.
 *
 * Antes de subir, o build precisa ter rodado (`npm run build`) — este servidor
 * apenas SERVE o que o build produziu, ele não compila nada.
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

// A porta vem do Passenger. O fallback só serve para teste manual.
const port = process.env.PORT || 3000;

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res, parse(req.url, true));
    }).listen(port, (erro) => {
      if (erro) throw erro;
      console.log(`QualiDDM ouvindo na porta ${port}`);
    });
  })
  .catch((erro) => {
    // Sem este log o Passenger mostra só "Application failed to start" e a
    // causa real fica invisível no painel.
    console.error("Falha ao iniciar o QualiDDM:", erro);
    process.exit(1);
  });
