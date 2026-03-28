# EDH STORE KEYS — Deploy no Vercel

## Variáveis de Ambiente Necessárias

Configure as seguintes variáveis em **Project Settings → Environment Variables** no Vercel:

| Variável | Descrição | Obrigatória |
|---|---|---|
| `DATABASE_URL` | String de conexão MySQL/TiDB. Ex: `mysql://user:pass@host:3306/db` | ✅ Sim |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT (mínimo 32 caracteres aleatórios) | ✅ Sim |
| `VITE_APP_ID` | ID do app OAuth Manus (se usar login Manus) | Opcional |
| `OAUTH_SERVER_URL` | URL do servidor OAuth Manus | Opcional |
| `VITE_OAUTH_PORTAL_URL` | URL do portal OAuth Manus | Opcional |
| `OWNER_OPEN_ID` | OpenID do dono do app | Opcional |
| `OWNER_NAME` | Nome do dono do app | Opcional |

## Banco de Dados

O projeto usa **MySQL**. Você pode usar:
- [PlanetScale](https://planetscale.com) (gratuito)
- [TiDB Cloud](https://tidbcloud.com) (gratuito)
- [Railway](https://railway.app) (MySQL)
- Qualquer MySQL 8.0+

Após criar o banco, execute as migrations em `drizzle/` manualmente ou via `pnpm drizzle-kit migrate`.

## Passos para Deploy

1. Faça upload do ZIP no GitHub (crie um repositório)
2. Importe o repositório no Vercel
3. Configure as variáveis de ambiente acima
4. O Vercel detectará automaticamente o `vercel.json` e fará o build

## Comando de Build

```
pnpm install && pnpm build
```

## Observação sobre Criptografia

As senhas são criptografadas com **AES-256-GCM** diretamente no navegador do usuário. O servidor **nunca recebe senhas em texto puro** — apenas os dados já criptografados são salvos no banco de dados.
