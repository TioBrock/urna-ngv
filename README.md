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
  * **Eleições:** Criação e configuração de eleições, datas, status e alternância de verificação de IP (Modo Teste vs Modo Seguro).
  * **Cargos Políticos:** Catálogo com distinção visual por âmbito (**NACIONAL**, **ESTADUAL** e **MUNICIPAL**), dígitos e vagas padrão.
  * **Candidatos:** Cadastro de chapas com upload de foto, número, partido e vinculação por estado ou nacional.
  * **Estados (UFs):** Gestão de unidades federativas participantes com ativação/desativação instantânea sem salto de rolagem.
  * **Votantes:** Listagem de sessões de eleitores com status (em votação / votou).
  * **Resultados & Boletim de Urna:** Apuração detalhada com emissão visual do Boletim de Urna (BU).
  * **Auditoria:** Registro imutável de logs de ações administrativas e eventos do sistema.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React 18, TypeScript, Vite, React Router DOM, Lucide React, React Hot Toast, Tailwind/Vanilla CSS.
* **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Zod, JWT, Multer, Bcrypt.
* **Infraestrutura:** Docker Compose (PostgreSQL 16).

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

### 6. Iniciar a Aplicação em Desenvolvimento
```bash
# Iniciar backend e frontend simultaneamente:
npm run dev
```

* **Urna Eletrônica (Eleitor):** [http://localhost:5173/votar](http://localhost:5173/votar)
* **Painel Administrativo:** [http://localhost:5173/admin](http://localhost:5173/admin)
* **Backend API:** [http://localhost:3001](http://localhost:3001)

---

## ⚖️ Licença
Projeto desenvolvido para fins de simulação e RPG político.
