# Estoque — Insumos, Limpeza e Escritório

Aplicativo web para controle de estoque, com movimentações de **entrada** (notas de compra) e **saída** (baixas), categorização por Insumos / Limpeza / Escritório, controle de validade por lote, dashboard de alertas e exportação de relatórios em CSV.

## Como funciona (importante ler antes de usar)

Este app roda **inteiramente no navegador** — não existe servidor nem banco de dados remoto:

- O banco de dados é um **SQLite real**, rodando no navegador via [sql.js](https://sql.js.org/) (SQLite compilado para WebAssembly).
- Os dados ficam salvos **apenas neste aparelho**, no armazenamento local do navegador (IndexedDB).
- O GitHub Pages hospeda somente os arquivos estáticos (HTML/CSS/JS) — ele não grava nem guarda seus dados de estoque.
- O login (usuário/senha) é apenas uma **trava de acesso simples**, validada no próprio navegador. Não é uma autenticação de servidor — não use para dados sensíveis de terceiros.

### Isso significa que você PRECISA fazer backups

Se o navegador for limpo, o app desinstalado do celular, ou você trocar de aparelho, **os dados só podem ser recuperados a partir de um backup exportado por você**. Use a aba **Backup**:

- **Baixar backup (.json)** — salva um arquivo com todo o estoque atual (categorias, produtos, notas de compra, lotes e movimentações). Guarde esse arquivo em local seguro (e-mail, nuvem, computador).
- **Restaurar a partir do arquivo** — restabelece o estoque para o ponto salvo naquele backup (substitui os dados atuais do aparelho).

Recomendação: exporte um backup depois de registrar movimentações importantes.

## Publicando no GitHub Pages

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta para ele.
2. No repositório, vá em **Settings → Pages**.
3. Em "Build and deployment", selecione **Deploy from a branch**, branch `main` (ou `master`), pasta `/ (root)`.
4. Salve. Em alguns minutos o app estará disponível em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

Não é necessário nenhum passo de build — é um site estático puro.

## Instalando no Android (like um app)

1. Abra o link do GitHub Pages no Chrome do celular.
2. Toque no menu (⋮) → **Adicionar à tela inicial** / **Instalar app**.
3. O app abre em tela cheia, com ícone próprio, e funciona offline depois do primeiro carregamento (graças ao Service Worker).

## Login

- Usuário: `jheny27`
- Senha: `j270994`

## Estrutura do banco (SQLite)

- `categories` — Insumos, Limpeza, Escritório (pode adicionar mais).
- `products` — cadastro de produtos, vinculados a uma categoria.
- `purchase_notes` — cabeçalho das notas de compra (número, fornecedor, data).
- `batches` — lotes recebidos em cada entrada, com validade e quantidade restante. As saídas consomem primeiro os lotes que vencem mais cedo (FEFO).
- `movements` — ledger de todas as entradas e saídas, usado para os relatórios.

## Relatórios

Na aba **Relatórios**, filtre por período, categoria e tipo de movimentação (entrada/saída) e exporte um CSV (separado por `;`, compatível com Excel em português).

## Desenvolvimento local

Não há build. Para rodar localmente:

```bash
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080`.
