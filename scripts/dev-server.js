// Servidor local para desenvolvimento, sem depender da CLI da Vercel.
// Serve os arquivos estáticos da raiz e as funções de /api do mesmo jeito que a Vercel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const porta = Number(process.env.PORT) || 3000;
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    const rota = pathname.match(/^\/api\/([a-z]+)$/);
    if (rota) {
      const { default: handler } = await import(`../api/${rota[1]}.js`);
      return await handler(req, res);
    }
    const arquivo = normalize(join(raiz, pathname === '/' ? 'index.html' : pathname));
    if (!arquivo.startsWith(raiz) || arquivo.includes(`${raiz}api`) || arquivo.includes(`${raiz}scripts`)) {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    }
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] || 'application/octet-stream' });
    res.end(conteudo);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' || e.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500);
    res.end('Não encontrado');
  }
}).listen(porta, () => console.log(`Rodando em http://localhost:${porta}`));
