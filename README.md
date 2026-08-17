# Elward Flow

Elward Flow is the operational source of truth for Elward Systems from release
intake through shipment.

## Getting Started

Install dependencies and run the development server:

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Before submitting a change, run:

```bash
bun run format:check
bun run lint
bun run typecheck
bun run build
```

## Stack

- Next.js 16 App Router
- React 19 and strict TypeScript
- Tailwind CSS 4 and shadcn/ui
- Bun

PostgreSQL, Drizzle, Auth.js, FileStore, the job worker, and test tooling will be
introduced in their respective implementation milestones.

## Project records

- Product decisions: `docs/product/decisions.md`
- Binding implementation rules: `AGENTS.md`

## Linked services

- GitHub: `4twentydev/elward-flow-v1`
- Vercel: `4twentydev/elward-flow-v1`
