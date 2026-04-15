# Painel de Implantação — Único

Painel operacional das implantações ativas, integrado ao Jira via API.

## Pré-requisitos

- Node.js 18+
- Conta no GitHub
- Conta no Vercel (gratuita)
- Token de API do Jira

## Como rodar localmente

```bash
npm install
cp .env.example .env.local
# Edite .env.local com seu token do Jira
npm run dev
```

Acesse: http://localhost:3000

## Como fazer deploy no Vercel

### 1. Suba o projeto no GitHub
```bash
git init
git add .
git commit -m "painel unico v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/painel-unico.git
git push -u origin main
```

### 2. Deploy no Vercel
1. Acesse vercel.com e faça login com GitHub
2. Clique em "Add New Project"
3. Selecione o repositório `painel-unico`
4. Clique em "Deploy"

### 3. Configure as variáveis de ambiente no Vercel
No painel do Vercel, vá em:
**Settings → Environment Variables**

Adicione as seguintes variáveis:

| Nome | Valor |
|------|-------|
| `JIRA_BASE_URL` | `https://suporteunico.atlassian.net` |
| `JIRA_EMAIL` | `lucasmaiconj@gmail.com` |
| `JIRA_API_TOKEN` | `seu_token_aqui` |
| `JIRA_PROJECT_KEY` | `KAN` |

4. Após salvar, clique em **Redeploy**.

Pronto! O painel estará disponível em `https://painel-unico.vercel.app` (ou similar).
