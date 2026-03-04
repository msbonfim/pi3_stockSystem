# ⚠️ ALERTA DE SEGURANÇA - CHAVE PRIVADA EXPOSTA

## O que aconteceu?
Uma chave privada VAPID foi commitada no repositório Git, o que é um **risco crítico de segurança**.

## O que foi feito?
1. ✅ Removida a chave privada do arquivo `settings.py`
2. ✅ Configurado para usar apenas variáveis de ambiente
3. ✅ Adicionado `.gitignore` para prevenir futuras exposições

## O que você DEVE fazer AGORA:

### 1. REGENERAR NOVAS CHAVES VAPID
A chave privada antiga foi exposta e está comprometida. Você DEVE gerar novas chaves:

```bash
cd backend
python gerar_chaves_vapid.py
```

Isso vai gerar:
- Nova chave privada (NÃO commite!)
- Nova chave pública (use no Vercel)

### 2. REMOVER A CHAVE DO HISTÓRICO DO GIT
A chave ainda está no histórico do Git. Você precisa removê-la:

```bash
# Opção 1: Usar git-filter-repo (recomendado)
pip install git-filter-repo
git filter-repo --path backend/sistema_gestao/settings.py --invert-paths

# Opção 2: Se não tiver git-filter-repo, use BFG Repo-Cleaner
# https://rtyley.github.io/bfg-repo-cleaner/
```

**IMPORTANTE**: Se o repositório já foi compartilhado, considere:
- Rotacionar TODAS as chaves expostas
- Notificar todos que têm acesso ao repositório
- Considerar criar um novo repositório

### 3. ATUALIZAR AS CHAVES NO RENDER.COM
1. Acesse Render.com → seu serviço → Environment Variables
2. Atualize `VAPID_PRIVATE_KEY` com a NOVA chave privada
3. Atualize `VAPID_EMAIL` se necessário

### 4. ATUALIZAR A CHAVE PÚBLICA NO VERCEL
1. Extraia a chave pública da nova chave privada:
   ```bash
   python extrair_chave_publica_vapid.py
   ```
2. No Vercel → Environment Variables
3. Atualize `VITE_VAPID_PUBLIC_KEY` com a NOVA chave pública

### 5. LIMPAR SUBSCRIPTIONS ANTIGAS
1. No Django Admin: `/admin/core/pushsubscription/`
2. Delete TODAS as subscriptions antigas
3. No navegador: limpe Service Worker e localStorage
4. Recrie as subscriptions com as novas chaves

### 6. COMMITAR AS CORREÇÕES
```bash
git add backend/sistema_gestao/settings.py backend/.gitignore
git commit -m "SECURITY: Remove exposed private key, use environment variables only"
git push
```

## Prevenção futura
- ✅ NUNCA commite chaves privadas, senhas ou tokens
- ✅ Use sempre variáveis de ambiente
- ✅ Verifique `.gitignore` antes de commitar
- ✅ Use ferramentas como `git-secrets` ou `truffleHog` para detectar vazamentos

