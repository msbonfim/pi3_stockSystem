# Relatórios (Metabase) e Vendas

Este documento descreve como o StockSystem expõe **relatórios analíticos** (com foco no Metabase) e como funciona o fluxo de **vendas** com impacto no estoque, do backend à interface web.

---

## Vendas

### Modelo de dados (Django)

- **`Sale`**: cabeçalho da venda — `sold_at`, `gross_revenue` (receita bruta calculada), `notes`, `created_at`.
- **`SaleItem`**: linhas da venda — produto, quantidade, `unit_price`, `line_total` (quantidade × preço).

Os modelos estão em `backend/core/models.py` (app `core`).

### API REST (`/api/`)

Todas as rotas abaixo estão sob o prefixo **`/api/`** (ver `backend/core/urls.py`).

| Método | Caminho | Função |
|--------|---------|--------|
| `GET` | `sales/` | Lista as **últimas 100** vendas (ordenadas por data), com itens e nome do produto em cada linha. |
| `POST` | `sales/` | Registra uma nova venda. Corpo JSON: `notes` (opcional) e `items` (lista obrigatória com pelo menos um item: `product`, `quantity`, `unit_price`). |
| `GET` | `sales/<id>/` | Detalhe de uma venda. |
| `DELETE` | `sales/<id>/` | **Estorno**: apaga a venda e **devolve as quantidades ao estoque** dos produtos associados (transação atómica com `select_for_update`). |
| `GET` | `sales/monthly-summary/?year=AAAA` | Resumo **agregado por mês** no ano indicado (default: ano atual): unidades vendidas e soma de `line_total` por mês. Útil para gráficos ou integrações; o frontend atual de Metabase não consome este endpoint diretamente. |

### Regras de negócio no `POST /sales/`

Implementadas em `sales_collection` em `backend/core/views.py`:

1. Validação via **`SaleCreateSerializer`** / **`SaleItemWriteSerializer`** (`backend/core/serializers.py`).
2. Para cada item: o produto tem de existir; a quantidade em stock tem de ser **≥** à quantidade vendida.
3. Dentro de **`transaction.atomic()`**: cria a venda, cria os itens, decrementa `Product.quantity`, atualiza `Sale.gross_revenue` com a soma dos `line_total`.

Erros de validação devolvem mensagens no formato esperado pelo DRF (por exemplo lista em `items`).

### Interface web (`/vendas`)

- **Rota React**: `App.tsx` → `path="/vendas"` → página `frontend/src/pages/Sales.tsx`.
- **API base**: `http://localhost:8000/api` em desenvolvimento local; em produção usa o host configurado no próprio ficheiro (Render).
- **Fluxo**:
  - Carrega produtos (`GET /products/`) e vendas (`GET /sales/`) em paralelo.
  - Formulário “Nova venda”: várias linhas (produto, quantidade, preço unitário); preço sugere o preço de lista do produto; observações opcionais.
  - **Registrar venda** → `POST /sales/` com `{ notes, items: [{ product, quantity, unit_price }] }`.
  - Tabela “Vendas recentes” com **Estornar** → `DELETE /sales/:id/` (confirmação no browser).

Ligações rápidas na página: **Estoque** (`/`) e **Análises** (`/relatorios`).

---

## Relatórios e análises (Metabase)

O sistema trata o **Metabase** como motor de BI sobre o **mesmo PostgreSQL** usado pelo Django. Credenciais e URLs do Metabase ficam no **servidor** (p. ex. `backend/.env` / `settings.py`), não no browser.

### Duas camadas de “analytics” no backend

1. **`/api/dashboard/analytics/`** (e alias `bi/summary/`) — agregações feitas **no Django ORM** (`build_analytics_payload` e vizinhança em `views.py`). Usada quando o Metabase não está configurado ou falha autenticação.
2. **`/api/metabase/analytics/`** — tenta executar **conjuntos fixos de “cards”** do Metabase (overview, por categoria, por marca, stock baixo, top por valor de stock, expiração). Se faltarem IDs de cards ou a sessão Metabase falhar, responde com o mesmo tipo de payload do ORM e metadados em `_meta` (`source`, `reason`, etc.). Pode **inferir** IDs a partir do nome da collection (`METABASE_COLLECTION_NAME` ou query param `collection`) quando os env vars estão incompletos.

A página **`MetabaseReports`** (ver abaixo) usa sobretudo outra rota.

### Rota usada pela página “Análises”

- **`GET /api/metabase/collection-cards/?collection=NomeDaCollection`** (ou collection default em `METABASE_COLLECTION_NAME`):
  - Resolve a collection no Metabase, lista os **cards** (perguntas), executa cada um e devolve dados já normalizados para o frontend.
  - Para cada card: colunas, tipos inferidos (`chart_inference`), tipo de gráfico sugerido (`infer_chart_type`), linhas como dicionários (células passam por `_jsonify_cell` para JSON seguro — decimais, datas, etc.).

Implementação: `metabase_collection_cards` em `backend/core/views.py`; cliente HTTP e helpers em `backend/core/metabase_client.py`; inferência de gráfico em `backend/core/chart_inference.py`.

### Referência SQL / cards

O ficheiro **`backend/core/metabase_cards.sql`** documenta as consultas esperadas alinhadas aos env vars `METABASE_CARD_*` usados por `metabase_analytics`.

### Frontend: página `MetabaseReports`

- **Rota**: `/relatorios` → `frontend/src/pages/MetabaseReports.tsx`.
- **Pedido**: `fetch(`${API_BASE}/metabase/collection-cards/${query}`)` onde `query` pode incluir `collection=...` se existir `import.meta.env.VITE_METABASE_COLLECTION`.
- **Comportamento**:
  - Particiona cards em resumos no topo vs grelha (`partitionReportCards` e ordenações em `metabaseReports.logic.ts`).
  - Renderiza consoante `chart_type`: barras, linhas, pizza, pizza dupla (categoria/marca/valores altos), scatter, combo vendas vs receita, métricas, tabelas, etc.
  - Link para abrir o Metabase no browser (URL vinda de variável de ambiente no frontend quando definida).

A lógica pesada de transformação de linhas/colunas está em **`metabaseReports.logic.ts`** (com testes em `metabaseReports.logic.test.ts`), para manter o componente React mais fino.

### Configuração necessária (resumo)

- **Backend**: `METABASE_URL`, autenticação (API key ou credenciais conforme `metabase_client`), e `METABASE_COLLECTION_NAME` ou IDs de cards — ver `sistema_gestao/settings.py` e comentários em `.env.example`.
- **Frontend**: opcionalmente `VITE_METABASE_COLLECTION` para escolher a collection na query string; URL pública do Metabase para o link “abrir no Metabase”.

Sem Metabase ou com collection vazia, a API de `collection-cards` pode devolver `400` (collection não informada) ou erros 4xx/5xx tratados na UI.

---

## Onde está cada coisa (referência rápida)

| Tema | Local principal |
|------|-----------------|
| Modelos `Sale` / `SaleItem` | `backend/core/models.py` |
| Serializers de venda | `backend/core/serializers.py` |
| Views vendas + metabase + dashboard | `backend/core/views.py` |
| URLs API | `backend/core/urls.py` |
| Cliente Metabase | `backend/core/metabase_client.py` |
| Inferência de gráficos | `backend/core/chart_inference.py` |
| UI vendas | `frontend/src/pages/Sales.tsx` |
| UI relatórios | `frontend/src/pages/MetabaseReports.tsx`, `metabaseReports.logic.ts` |
| Rotas SPA | `frontend/src/App.tsx` (`/vendas`, `/relatorios`) |

---

## Integração entre vendas e relatórios

- As **vendas** gravam stock e valores em tabelas Django (`Sale`, `SaleItem`, `Product`). O Metabase, ligado ao mesmo Postgres, pode expor **perguntas** que leem essas tabelas (ou vistas) para gráficos de vendas ao longo do tempo, receita, etc.
- O endpoint **`sales/monthly-summary`** oferece agregação mensal **via API Django** sem depender do Metabase; pode ser ligado a um gráfico no futuro ou a ferramentas externas.

Para testes e execução da suíte, ver `docs/TESTES.md`.

**Notificações** (alertas de validade/stock, push): `docs/NOTIFICACOES.md`.
