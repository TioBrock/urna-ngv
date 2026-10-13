# Urna Eletrônica NGV 🗳️

Sistema web de votação eletrônica inspirado na urna eletrônica brasileira e no Tribunal Superior Eleitoral (TSE), desenvolvido para simulações eleitorais e RPG político.

---

## 🚀 Funcionalidades

* **Urna Eletrônica Interativa:**
  * Interface fiel com teclado numérico (numérico, BRANCO, CORRIGE, CONFIRMA).
  * Sons oficiais da urna sintetizados via Web Audio API (bip ao digitar, confirmação intermediária e pililiilili de fim).
  * Exibição de foto do candidato, partido, vice/suplente e validação de dígitos por cargo.
  * Voto em branco, voto nulo e validação em tempo real.
* **Painel Administrativo Completo (`/admin`):**
  * **Dashboard:** Resumo da eleição, contagem de votos, gráficos de apuração e status do pleito.
  * **Eleições:** Criação e configuração de eleições, datas, status e alternância de verificação de IP (Modo Teste vs Modo Seguro). Suporte a vincular eleições de 2º turno como registros independentes.
  * **Cargos Políticos:** Catálogo com distinção visual por âmbito (**NACIONAL**, **ESTADUAL** e **MUNICIPAL**), dígitos, vagas e escolhas por eleitor.
  * **Candidatos:** Cadastro de chapas com upload de foto, número, partido e vinculação por estado ou nacional.
  * **Estados (UFs):** Gestão de unidades federativas participantes com ativação/desativação instantânea sem salto de rolagem.
  * **Votantes:** Listagem de sessões de eleitores com status (em votação / votou).
  * **Resultados & Boletim de Urna:** Apuração detalhada com emissão visual do Boletim de Urna (BU) e análise de 2º turno.
  * **Auditoria:** Registro imutável de logs de ações administrativas e eventos do sistema.

### Configuração avançada de cargos

Cada cargo configurado em uma eleição suporta:

| Campo | Descrição |
|---|---|
| **Vagas (`slots`)** | Quantidade de candidatos a serem eleitos |
| **Escolhas por eleitor (`choicesPerVoter`)** | Quantos votos o eleitor pode lançar para este cargo (independente das vagas) |
| **Sistema eleitoral** | `MAJORITARIO` (mais votado) ou `PROPORCIONAL` (quociente eleitoral + D'Hondt) |
| **Âmbito** | `NACIONAL` (um único resultado) ou `ESTADUAL` (resultado independente por UF) |
| **2º Turno** | Apenas para cargos majoritários de vaga única — indica se a maioria absoluta (>50%) é exigida |

### Fluxo de 2º Turno

1. O administrador configura um cargo como "Admite 2º turno".
2. Ao encerrar a eleição, o sistema calcula automaticamente se algum candidato atingiu maioria absoluta (`floor(votos_válidos/2)+1`).
3. O resultado é salvo no campo `finalResults` da eleição (snapshot imutável).
4. Se necessário, o administrador **cria uma nova eleição** para o 2º turno, informando o `parentElectionId` (ID do 1º turno). As duas eleições permanecem independentes.
5. O histórico do 1º turno é preservado integralmente.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React 18, TypeScript, Vite, React Router DOM, Lucide React, React Hot Toast, Tailwind/Vanilla CSS.
* **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Zod, JWT, Multer, Bcrypt.
* **Infraestrutura:** Docker Compose (PostgreSQL 16), Supabase (produção), GitHub Actions (keepalive).

---

## 📦 Como Executar o Projeto

### 1. Pré-requisitos
* Node.js (v18+)
* Docker e Docker Compose

### 2. Clonar o repositório
```bash
git clone https://github.com/TioBrock/urna-ngv.git
cd urna-ngv
```

### 3. Subir o Banco de Dados (PostgreSQL)
```bash
docker compose up -d
```

### 4. Instalar as Dependências
```bash
npm install
```

### 5. Configurar o Ambiente e Banco
Copie as variáveis de ambiente:
```bash
cp backend/.env.example backend/.env
```

Gere o cliente do Prisma, sincronize o schema e execute o seed:
```bash
npm run db:push -w backend
npm run db:seed -w backend
```

*Credenciais padrão do Admin:*
* **Email:** `admin@urna.ngv`
* **Senha:** `admin123`

### 6. Aplicar Migrations (Supabase/produção)

Para aplicar as migrations no banco de dados de produção (Supabase), execute o SQL da migration manualmente no editor SQL do Supabase:

1. Acesse o painel do Supabase → **SQL Editor**
2. Copie e execute o conteúdo de: `backend/prisma/migrations/20261013100000_vagas_escolhas_segundo_turno/migration.sql`

> **Atenção:** A migration usa `IF NOT EXISTS` em todas as colunas e tabelas, sendo segura para re-execução sem perda de dados.

### 7. Iniciar a Aplicação em Desenvolvimento
```bash
# Iniciar backend e frontend simultaneamente:
npm run dev
```

* **Urna Eletrônica (Eleitor):** [http://localhost:5173/votar](http://localhost:5173/votar)
* **Painel Administrativo:** [http://localhost:5173/admin](http://localhost:5173/admin)
* **Backend API:** [http://localhost:3001](http://localhost:3001)

---

## 🔄 GitHub Actions — Keepalive do Supabase

O projeto inclui uma rotina automática (`.github/workflows/supabase-keepalive.yml`) que faz uma consulta leve ao banco de dados uma vez por dia para reduzir o risco de pausa por inatividade no **plano gratuito do Supabase**.

> ⚠️ **Limitação:** Esta rotina **não garante** que o projeto nunca será pausado pelo Supabase. O plano gratuito pode pausar o banco após 7 dias sem atividade *real de usuários*, independentemente de pings automatizados. Consulte a [documentação oficial do Supabase](https://supabase.com/docs/guides/platform/pause-resume) para detalhes.

### Configuração

Adicione os seguintes **Secrets** no repositório GitHub (`Settings → Secrets and variables → Actions`):

| Secret | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase (ex: `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Chave pública anon do projeto Supabase |

### Frequência

* **Automática:** Diariamente às 07:00 UTC (04:00 BRT)
* **Manual:** Aba **Actions → Supabase Keepalive → Run workflow**

### Verificar logs

1. Acesse **GitHub → Actions → Supabase Keepalive**
2. Clique na execução mais recente para ver os logs detalhados

### Segurança

* Usa apenas a chave `anon` (mínimo privilégio) com uma consulta `SELECT` simples à tabela `states`
* Nenhuma chave secreta é exposta no código-fonte
* Nenhuma escrita no banco é realizada

---

## ⚖️ Licença
Projeto desenvolvido para fins de simulação e RPG político.
