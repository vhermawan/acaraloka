@AGENTS.md

# hadirly (sebelumnya event-in)

## Tentang project
<!-- Isi setelah rencana disetujui: 2-3 kalimat tujuan sistem. -->
Rencana lengkap: /Users/vihermawan/Documents/Obsidian Vault/agent-memory/plans/event-in-v1.md

## Perintah
- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck` (menjalankan `next typegen && tsc --noEmit`)
- Test: `pnpm test` (Vitest)
- Test integrasi (DB dev dari `.env.local`): `pnpm test:integration`
- Siapkan bucket Storage: `pnpm storage:setup`
- Migrasi DB: `pnpm db:migrate`
- Generate Prisma client: `pnpm db:generate`
- Seed DB: `pnpm db:seed`

## Aturan khusus project
- Ikuti skill nextjs-conventions.
- Memory project: /Users/vihermawan/Documents/Obsidian Vault/agent-memory/projects/event-in.md
- Todo: /Users/vihermawan/Documents/Obsidian Vault/agent-memory/projects/event-in-todo.md
<!-- Tambahkan: folder yang tidak boleh disentuh, keputusan arsitektur penting, dsb. -->
