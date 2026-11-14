# TypeScript Integration Checklist — Backend & Frontend

Reusable setup guide for new React + Node.js projects.

---

# 1. Backend — Node.js + Express + TypeScript

## Step 1: Initialize project

```bash
mkdir backend
cd backend
npm init -y
```

## Step 2: Install dependencies

**Runtime dependencies**

```bash
npm install express dotenv pg zod bcryptjs
```

**Development dependencies**

```bash
npm install -D typescript tsx @types/node @types/express @types/pg
```

## Step 3: Create TypeScript configuration

```bash
npx tsc --init
```

Replace `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 4: Update package.json

Set `"type": "module"` and configure scripts:

```json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

Keep existing dependencies and other package details.

## Step 5: Create folder structure

```text
backend/
├── src/
│   ├── config/
│   │   └── db.ts
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── index.ts
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

## Step 6: Environment configuration

In `src/index.ts`:

```ts
import "dotenv/config";
```

For database configuration in `src/config/db.ts`:

```ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

export default pool;
```

Import local TypeScript modules using `.js` extensions with NodeNext:

```ts
import pool from "./config/db.js";
```

## Step 7: Create .gitignore

```gitignore
node_modules/
dist/
.env
uploads/
```

## Step 8: Run backend

```bash
# Development
npm run dev

# Type checking
npm run typecheck

# Compile TypeScript
npm run build

# Production
npm start
```

---

# 2. Frontend — React + TypeScript + Vite

## Step 1: Create project

For a new project:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

For an existing React JavaScript project, use the migration approach instead of creating another project.

## Step 2: Install dependencies

```bash
npm install axios react-router-dom @reduxjs/toolkit react-redux
```

**Development dependencies**

```bash
npm install -D @types/node
```

Install additional `@types/*` packages only when a library needs them.

## Step 3: Vite TypeScript configuration

The React TypeScript Vite template already generates:

```text
tsconfig.json
tsconfig.app.json
tsconfig.node.json
```

Keep these generated configurations initially.

## Step 4: Frontend folder structure

```text
frontend/
├── src/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── .env
├── package.json
└── tsconfig.json
```

## Step 5: Use TypeScript extensions

| File type         | Extension  |
| ----------------- | ---------- |
| React component   | `.tsx`     |
| TypeScript logic  | `.ts`      |
| Type definitions  | `.d.ts`    |
| React entry point | `main.tsx` |

Examples:

```text
Button.tsx
Login.tsx
auth.service.ts
user.types.ts
api.ts
```

## Step 6: Frontend environment variables

Create `.env`:

```env
VITE_API_URL=http://localhost:3000
```

Access it in TypeScript:

```ts
const API_URL = import.meta.env.VITE_API_URL;
```

Never put secrets or private API keys in frontend environment variables.

## Step 7: Create shared types

Example: `src/types/user.types.ts`

```ts
export interface User {
  id: string;
  name: string;
  email: string;
}
```

Use these types in components and services:

```tsx
import type { User } from "../types/user.types";

interface Props {
  user: User;
}

function UserProfile({ user }: Props) {
  return <h2>{user.name}</h2>;
}

export default UserProfile;
```

## Step 8: Run frontend

```bash
# Development
npm run dev

# Production build + TypeScript checks
npm run build

# Preview production build
npm run preview
```

---

# 3. Final Project Structure

```text
project/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   ├── dist/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── main.tsx
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
└── .gitignore
```

# 4. Final Verification Checklist

## Backend

- [ ] Install TypeScript and development dependencies.
- [ ] Create `tsconfig.json`.
- [ ] Set `"type": "module"`.
- [ ] Configure `tsx watch` for development.
- [ ] Configure `tsc` for compilation.
- [ ] Configure `dist` as the output directory.
- [ ] Add required type definitions.
- [ ] Add `.env` to `.gitignore`.
- [ ] Run `npm run dev`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm start`.

## Frontend

- [ ] Create React project using `react-ts` template.
- [ ] Install dependencies.
- [ ] Keep Vite TypeScript configurations.
- [ ] Use `.tsx` for React components.
- [ ] Use `.ts` for TypeScript logic.
- [ ] Create reusable interfaces and types.
- [ ] Configure frontend environment variables.
- [ ] Run `npm run build`.

---

**Standard technology choices:**

- Backend: Node.js + Express + TypeScript
- Backend development runner: tsx
- Backend compiler: TypeScript (`tsc`)
- Frontend: React + TypeScript + Vite
- Package manager: npm
- Module system: ES Modules
- Backend module configuration: NodeNext
