# Como funcionam os testes (StockSystem)

Este projeto usa **dois stacks de teste independentes**: **Vitest** no frontend (TypeScript) e **unittest** do Python no backend. Ambos podem ser executados manualmente, pelo **orquestrador** `iniciar_testes.py` na raiz do repositório ou pelo painel **Testing** do Cursor/VS Code.

---

## Visão geral

| Área | Ferramenta | Onde ficam os ficheiros |
|------|------------|-------------------------|
| Frontend | [Vitest](https://vitest.dev/) 3.x | `frontend/src/**/*.test.ts` |
| Backend | `unittest` (stdlib) | `backend/core/tests/test_*.py` |

- O **frontend** corre em ambiente Node (`environment: "node"` no `vite.config.ts`), sem browser real.
- O **backend** descobre testes com `python -m unittest discover -s core/tests -p "test_*.py"`.

---

## Como executar

### Orquestrador (recomendado na raiz do repo)

O script `iniciar_testes.py` alinha-se ao estilo do `iniciar_servicos.py`: usa o **venv** em `backend/venv`, instala dependências quando necessário e gera ficheiros `.bat` para repetir no Windows.

```text
python iniciar_testes.py                  # backend (unittest) + frontend (vitest run)
python iniciar_testes.py --only-frontend # só Vitest (não exige venv)
python iniciar_testes.py --only-backend  # só unittest
python iniciar_testes.py --install       # força pip + npm install
python iniciar_testes.py --watch         # após o fluxo, abre terminal com Vitest em watch
python iniciar_testes.py --ui            # abre Vitest UI noutro terminal (sem vitest run no atual)
python iniciar_testes.py --rebuild-venv  # recria backend/venv
```

Scripts gerados na raiz (após correr o orquestrador): `4-testes-backend.bat` … `8-testes-frontend-ui.bat`.

### Linha de comando manual

**Frontend** (`frontend/`):

```text
npm install
npm test              # execução única (vitest run)
npm run test:watch    # reexecuta ao alterar ficheiros
npm run test:ui       # interface web do Vitest
```

**Backend** (`backend/`):

```text
# Suíte em core/tests (interpretador com Django instalado — tipicamente o venv do projeto)
python -m unittest discover -s core/tests -p "test_*.py" -v

# Apenas inferência de gráficos (não precisa de Django)
python -m unittest core.tests.test_chart_inference -v
```

### Cursor / VS Code

- **Python**: extensão oficial; em `.vscode/settings.json` o unittest está apontado para `backend` e pasta `./core/tests`.
- **Vitest**: extensão recomendada (`vitest.explorer` em `.vscode/extensions.json`); `vitest.rootConfig` indica `frontend/vite.config.ts` para o monorepo aberto na raiz.
- **Tarefas**: `.vscode/tasks.json` inclui “Frontend: Vitest (watch)” como tarefa de teste predefinida (Ctrl+Shift+P → “Tasks: Run Test Task”).

---

## Frontend (Vitest)

### Configuração

Definida em `frontend/vite.config.ts`, bloco `test`:

- `globals: true` — APIs de teste (`describe`, `it`, `expect`) sem imports explícitos em alguns casos.
- `environment: "node"` — adequado a lógica pura (helpers, reducers, parsers).
- `include: ["src/**/*.test.ts"]` — só ficheiros `*.test.ts` sob `src/`.

O alias `@/` aponta para `frontend/src`, igual à aplicação.

### O que está coberto hoje

Exemplos: `src/lib/utils.test.ts`, `src/pages/metabaseReports.logic.test.ts` (lógica desacoplada da UI do Metabase).

Para adicionar testes: crie `alguma-coisa.test.ts` ao lado do módulo ou em `src/**` respeitando o glob acima.

---

## Backend (unittest)

### Localização e módulos

| Ficheiro | Conteúdo |
|----------|----------|
| `test_chart_inference.py` | Inferência de tipo de gráfico / colunas Metabase — **não importa Django**; pode correr com qualquer Python que tenha o pacote `core` no path (normalmente a partir de `backend/`). |
| `test_metabase_client.py` | Helpers do cliente HTTP Metabase (`_jsonify_cell`, collections, linhas → dicts). **Exige Django** (`django.setup()`); caso contrário a classe fica em *skip*. |
| `test_serializers.py` | Serializers REST — **exige Django**. |
| `test_metabase_integration.py` | Integração com **Docker** (Metabase + Postgres). Só corre de forma significativa com variável de ambiente e stack ativo (ver abaixo). |

### Por que alguns testes aparecem como “skipped”

Os módulos que dependem de Django usam `@unittest.skipUnless(django is not None, …)` (ou equivalente). Se correres `unittest` com um Python **sem** Django (ou fora do venv do projeto), esses testes são **ignorados**, não falham.

### Testes de stack BI (Metabase + Postgres)

Definidos em `test_metabase_integration.py`. A classe `MetabaseStackIntegrationTests` só deixa de ser *skipped* quando:

```text
RUN_BI_STACK_TESTS=1
```

(e opcionalmente `METABASE_URL`, `PG_*` conforme o docstring do ficheiro). É necessário **`docker compose up -d`** (ou serviços equivalentes) para os testes de health e Postgres terem hipótese de passar. Há ainda um *smoke test* de `docker-compose.yml` que não depende do stack estar no ar.

---

## Falhas e códigos de saída

- **`iniciar_testes.py`**: termina com código ≠ 0 se **qualquer** suíte executada falhar (unittest ou Vitest).
- Corrige o ambiente (venv, `npm install`, variáveis `RUN_BI_STACK_TESTS`) antes de assumir bug no código.

---

## Resumo

1. **Desenvolvimento rápido no frontend**: `npm run test:watch` ou a extensão Vitest com `watchOnStartup` nas settings do workspace.
2. **Suíte completa local**: `python iniciar_testes.py` na raiz (com `backend/venv` e `frontend/node_modules` preparados).
3. **CI**: normalmente `cd frontend && npm test` e `cd backend && python -m unittest discover …` com o mesmo Python das dependências do projeto.
4. **Integração real com Metabase/Postgres**: opt-in via `RUN_BI_STACK_TESTS=1` e stack Docker.

Para comandos compactos e notas antigas, vê também `backend/requirements-dev.txt` (comentários de desenvolvimento).

Documentação de **relatórios (Metabase) e vendas**: `docs/RELATORIOS_E_VENDAS.md`.

**Notificações** (push, e-mail, tarefas): `docs/NOTIFICACOES.md`.
