# Notificações

Este documento descreve o **sistema de alertas** do StockSystem: registo em base de dados, API REST, **push** no browser (Web Push + VAPID), e-mail, notificações **desktop no Windows** (quando disponível), e tarefas agendadas via **Django Q**.

---

## Componentes principais

| Componente | Ficheiro / local |
|------------|------------------|
| Modelo `Notification` | `backend/core/models.py` |
| Modelo `PushSubscription` | `backend/core/models.py` |
| Serializers | `backend/core/serializers.py` (`NotificationSerializer`, `PushSubscriptionSerializer`) |
| Views API | `backend/core/views.py` |
| Rotas | `backend/core/urls.py` |
| Tarefas de negócio (validade, stock) | `backend/core/tasks.py` |
| Envio Web Push + opcional desktop | `backend/core/push_utils.py` |
| Cliente push + registo SW | `frontend/src/services/pushNotifications.ts` |
| Chamadas HTTP genéricas (incl. notificações) | `frontend/src/services/api.ts` |
| Inicialização ao abrir a app | `frontend/src/App.tsx` |

---

## Modelo `Notification`

Campos relevantes:

- **`title`**, **`message`**: texto apresentado ao utilizador ou enviado por push/e-mail.
- **`notification_type`**: `expiring_soon` \| `expired` \| `low_stock` (definido nas choices do modelo).
- **`read`**: indica se foi lida (caixa de entrada in-app / admin).
- **`user`**, **`product`**: opcionais; as tarefas atuais ligam **`product`** quando o alerta é por artigo.

**Nota:** As tarefas em `tasks.py` criam hoje registos com tipo **`expiring_soon`** (validade) e **`low_stock`**. O tipo **`expired`** existe no modelo para extensões futuras ou dados migrados, mas não é atribuído automaticamente por essas funções.

---

## API REST (`/api/`)

### Notificações

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET`, `POST` | `notifications/` | **GET:** últimas **50** notificações, mais recentes primeiro. Query opcional `?read=true` ou `?read=false`. **POST:** cria notificação (payload conforme serializer — uso típico: integrações ou testes). |
| `GET`, `PUT`, `PATCH`, `DELETE` | `notifications/<id>/` | Detalhe / atualização / remoção (`RetrieveUpdateDestroyAPIView`). |
| `POST` | `notifications/<id>/read/` | Marca uma notificação como lida. |
| `POST` | `notifications/read-all/` | Marca **todas** como lidas. |

### Push subscriptions (Web Push)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET`, `POST` | `push-subscriptions/` | Lista ou regista uma subscription (endpoint, chaves `p256dh`, `auth`). |
| `POST` | `push-subscriptions/unregister/` | Desativa subscription (corpo com `endpoint`, `p256dh`, `auth`). |

O frontend regista a subscription via cliente HTTP em `pushNotifications.ts` após `pushManager.subscribe`, usando a **chave pública VAPID** conhecida do browser.

---

## Tarefas agendadas (`tasks.py`)

### `check_expiring_products_and_notify`

- Produtos com validade entre **hoje e +7 dias** (e `quantity > 0`): tratados como **críticos**.
- Produtos entre **+8 e +30 dias**: **aviso**, só se **não** existirem críticos (para reduzir ruído).
- Para cada produto afetado: cria **`Notification`** (`expiring_soon`), envia **e-mail** (`_send_email_notification`), **Web Push** (`send_push_notification`) e notificação **desktop** no Windows (`send_desktop_notification`), quando configurado.

### `check_low_stock_and_notify(**kwargs)`

- Considera stock baixo quando `0 < quantity < min_quantity` (por defeito **`min_quantity=2`**, configurável nos kwargs / agendamento).
- Cria **`Notification`** (`low_stock`) por produto, e-mail, push e desktop com a mesma ideia.

### E-mail

- Destinatários: **`NOTIFICATION_EMAILS`** em `settings` (pode vir de variável de ambiente, lista separada por vírgulas).
- Se não estiver configurado adequadamente, o helper regista aviso e não bloqueia o resto (push pode continuar).

### Agendamento

- O projeto usa **Django Q** (`django_q`). O cluster trabalhador corre com `python manage.py qcluster` (no Windows costuma haver um `.bat` gerado pelo `iniciar_servicos.py`).
- Os **schedules** (frequência das funções acima) configuram-se no **Admin** em Django Q (Schedules) ou equivalente — ver comentários em `sistema_gestao/settings.py` sobre `check_expiring_products_and_notify` e `check_low_stock_and_notify`.

---

## Web Push (backend)

Implementação em `push_utils.py`:

- Usa **`pywebpush`** e **`py-vapid`** para assinar e enviar para cada `PushSubscription` ativa.
- **`VAPID_PRIVATE_KEY`** e claims (**`VAPID_CLAIMS`**, tipicamente `mailto:...`) devem estar corretos em `settings` / ambiente.
- Sem subscriptions ativas, o envio não falha a aplicação: devolve contagem `sent: 0`.

Em **Windows**, se **`winotify`** estiver instalado, `send_desktop_notification` pode mostrar toasts no ambiente do servidor (útil em desenvolvimento com `qcluster` local; em produção o significado depende de onde o processo corre).

---

## Frontend

### Push ao carregar a SPA

`App.tsx` chama `pushNotificationService.initialize()` no arranque. O serviço:

1. Garante **Service Worker** (`navigator.serviceWorker`).
2. Lê a **chave pública VAPID** (constant em `pushNotifications.ts` ou fluxo do projeto para alinhar com o par `VAPID_PUBLIC_KEY` do backend).
3. Pede permissão **`Notification`** ao utilizador.
4. Cria subscription e faz **POST** para `/api/push-subscriptions/`.

Se a chave pública for a placeholder ou estiver vazia, o código **desativa** push de forma explícita e regista mensagem na consola — comportamento normal em dev.

### Lista de notificações na UI

`api.ts` expõe `getNotifications`, `markNotificationRead` e `markAllNotificationsRead`. **Não há** neste repositório uma página dedicada que consuma esses métodos no ecrã principal; a caixa de entrada pode ser consultada via **Admin Django**, API ou futura componente React.

---

## Ferramentas de apoio na raiz / backend

- **`gerenciar_chaves_vapid.py`** / **`iniciar_servicos.py`**: fluxo para gerar ou sincronizar chaves VAPID (alinhamento backend ↔ frontend).
- **`backend/testar_notificacoes.py`**: execução manual de cenários (ex.: chamar `check_expiring_products_and_notify`).
- **`backend/diagnosticar_notificacoes.py`**: diagnóstico de filas, subscriptions e registos.

---

## Boas práticas e segurança

- **Chaves VAPID** e **credenciais SMTP** devem preferencialmente vir de **variáveis de ambiente** em produção, não de valores fixos no repositório.
- Push só funciona em **HTTPS** (ou `localhost`) e com **Service Worker** registado pela PWA/Vite conforme `frontend` configura.
- O tipo **`expired`** no modelo permite evoluções (ex.: job que marque produtos já vencidos); ao implementar, manter coerência com `Notification` e com os endpoints existentes.

---

## Leitura relacionada

- Testes: `docs/TESTES.md`
- Vendas e relatórios (contexto de stock / validade): `docs/RELATORIOS_E_VENDAS.md`
