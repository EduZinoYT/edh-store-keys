# Gerenciador de Senhas - TODO

## Backend
- [x] Schema: tabela `credentials` com userId, serviceName, username, encryptedPassword, createdAt, updatedAt
- [x] Migration SQL aplicada via webdev_execute_sql
- [x] db.ts: helpers para CRUD de credenciais
- [x] routers.ts: procedures credentials.list, credentials.create, credentials.update, credentials.delete

## Frontend
- [x] Design system: paleta dark elegante (preto/dourado/cinza), fonte Inter + Playfair Display
- [x] Layout com DashboardLayout (sidebar) + rota protegida
- [x] Página de login elegante para usuários não autenticados
- [x] Página principal: lista de contas salvas com cards elegantes
- [x] Campo de busca para filtrar por nome do serviço
- [x] Modal/drawer para adicionar nova conta (nome, email/usuário, senha)
- [x] Indicador visual de força da senha (fraca/média/forte)
- [x] Botão copiar senha com um clique (feedback visual)
- [x] Modal para editar conta existente
- [x] Confirmação para excluir conta
- [x] Mostrar/ocultar senha nos campos

## Testes
- [x] Vitest: credentials.create procedure
- [x] Vitest: credentials.list procedure
- [x] Vitest: credentials.delete procedure

## Atualização v2 — EDH STORE KEYS
- [x] Renomear site para "EDH STORE KEYS"
- [x] Redesign: paleta vermelho/preto (substituir dourado/escuro)
- [x] Schema: tabela `local_users` com email, passwordHash, salt
- [x] Backend: procedures auth.register, auth.login, auth.logout (JWT próprio)
- [x] Tela de registro (nome, email, senha) com validação
- [x] Tela de login (email + senha)
- [x] Criptografia AES-256-GCM das senhas no cliente (Web Crypto API)
- [x] Chave derivada da senha mestra do usuário (PBKDF2)
- [x] Atualizar cards e modais com novo design vermelho/preto
- [x] Testes Vitest: auth.register e auth.login

## Atualização v3
- [x] Remover fonte Cinzel dos títulos, usar Inter padrão em todo o site

## Atualização v4
- [x] Upload da imagem EDH STORE KEYS como fundo da tela de login
- [x] Gerar imagem de fundo para a tela do vault com IA
- [x] Aplicar imagens como background nas páginas Auth e Vault

## Atualização v5 — Sistema de Grupos
- [x] Schema: tabela `credential_groups` (id, userId, name, createdAt)
- [x] Schema: adicionar coluna `groupId` na tabela `local_credentials`
- [x] Migration SQL aplicada
- [x] db helpers: CRUD de grupos em localDb.ts
- [x] tRPC: procedures groups.list, groups.create, groups.update, groups.delete
- [x] tRPC: atualizar credentials.create e credentials.update para aceitar groupId
- [x] Frontend: sidebar/painel lateral com lista de grupos
- [x] Frontend: botão "Novo grupo" com modal para criar grupo
- [x] Frontend: filtrar credenciais por grupo selecionado
- [x] Frontend: opção de renomear e excluir grupo
- [x] Frontend: campo de grupo no formulário de adicionar/editar conta
- [x] Testes Vitest: groups.create, groups.list, groups.delete

## Atualização v6 — Sistema de Validade/Assinatura
- [x] Schema: adicionar colunas `subscriptionStart` (date) e `subscriptionDays` (int) em `local_credentials`
- [x] Migration SQL aplicada
- [x] db helpers: atualizar updateLocalCredential para aceitar novos campos
- [x] tRPC: atualizar vault.create e vault.update para aceitar subscriptionStart e subscriptionDays
- [x] Frontend: campos "Data de início" e "Duração (dias)" no formulário de adicionar/editar
- [x] Frontend: badge de dias restantes no card (verde/amarelo/vermelho/expirado)
- [x] Frontend: barra de progresso de validade no card
- [x] Frontend: ordenação/filtro por contas próximas do vencimento
- [x] Testes Vitest: vault.create com campos de validade

## Bug Fix v7
- [x] Corrigir erro "Este email já está cadastrado" no registro — melhorar UX para redirecionar ao login
- [x] Mostrar mensagem clara com botão "Fazer login" quando email já existe

## Atualização v8
- [x] Redesenhar sidebar de grupos: minimalista, sem ícones de pasta, sem bordas excessivas
- [x] Redesenhar modal de criação/edição de grupo: inline simples, sem dialog pesado

## Bug Fix v11
- [ ] Corrigir INTERNAL_SERVER_ERROR no registro: o rollback voltou para versão com campo "email" mas o banco tem coluna "username" — sincronizar schema, localDb e routers
