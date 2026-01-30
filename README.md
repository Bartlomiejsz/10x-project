# HomeBudget 

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

> AI‑assisted household budgeting PWA focused on fast expense capture, accurate automatic categorization, monthly limit tracking, and clear visual feedback.

---
## Table of Contents
1. [Project Name](#homebudget-working-title)
2. [Project Description](#project-description)
3. [Tech Stack](#tech-stack)
4. [Getting Started Locally](#getting-started-locally)
5. [Available Scripts](#available-scripts)
6. [Project Scope](#project-scope)
7. [Project Status](#project-status)
8. [License](#license)

---
## Project Description
HomeBudget is a web Progressive Web App (PWA) for managing a shared monthly household budget (initially a single shared household). It streamlines tracking through:
- AI category suggestion for new expenses (target ≥90% accepted without correction) with keyword fallback mapping.
- 11 predefined categories to improve consistency & ML accuracy.
- Monthly per‑category limits with inline editing and threshold coloring.
- CSV import with automatic categorization, duplicate detection, and selective inclusion.
- Real‑time visualization (usage vs. limits, participant spending share).
- Fast load (<3s target) and responsive UI for mobile & desktop.

Current interface language: Polish (README in English). Currency: PLN. Time zone: Europe/Warsaw. Branding & final product name are still TBD.

---
## Tech Stack
**Frontend**
- Astro 5 (SSR + islands, hybrid rendering)
- React 19 (only where interactivity is required)
- TypeScript 5
- Tailwind CSS 4 (utility-first styling)
- Shadcn/ui components + Radix primitives
- lucide-react icons
- class-variance-authority, tailwind-merge, clsx (styling utilities)

**Backend / Data**
- Supabase (PostgreSQL, Auth / OAuth, edge functions optional later)

**AI Layer**
- OpenRouter (multi-model gateway: OpenAI / Anthropic / others)
- Fallback local keyword mapping → Inne (Other) when confidence too low / no match

**Tooling & Quality**
- ESLint 9 (Astro, React, a11y, import rules)
- Prettier + prettier-plugin-astro
- Husky + lint-staged (pre-commit formatting & lint)
- Sitemap integration (@astrojs/sitemap)
- @astrojs/node adapter (SSR deployment)

**CI/CD & Hosting (Planned)**
- GitHub Actions (build, lint, test, deploy)
- Docker image deployment on DigitalOcean

Further technical guidelines and conventions:
- `.github/copilot-instructions.md` (AI coding rules)
- `.ai/prd.md` (Product Requirements)
- `.ai/tech-stack.md` (Extended rationale)

---
## Getting Started Locally
### Prerequisites
- Node.js 22.x (see `.nvmrc`)
- npm (bundled with Node). Yarn / pnpm not configured in scripts.

### 1. Clone
```bash
git clone <your-fork-or-origin-url> home-budget
cd home-budget
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root (never commit secrets). Adjust as needed:
```bash
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=public_anon_key
# Optional (only for secure server tasks / not exposed client-side)
SUPABASE_SERVICE_ROLE_KEY=service_role_secret

# AI (OpenRouter)
OPENROUTER_API_KEY=your_openrouter_key
# (If you decide to call a specific provider directly)
# OPENAI_API_KEY=your_openai_key

# Site / Metadata
SITE_URL=https://localhost:4321
```
> NOTE: Only expose the anonymous public key client-side. Keep service role keys server-only.

### 4. Run Development Server
```bash
npm run dev
```
Dev server default: http://localhost:4321 (Astro prints actual port if changed).

### 5. Build & Preview
```bash
npm run build
npm run preview
```

### 6. Formatting & Linting (Pre-Commit Hook)
Husky + lint-staged will run automatically after `npm install` (if `.husky` hooks are set up). If not initialized:
```bash
npx husky install
```

### 7. Troubleshooting
| Issue | Resolution |
|-------|------------|
| Node version warning | Run `nvm use` (install Node 22 if missing) |
| Missing env variables | Verify `.env` matches required keys |
| AI requests failing | Check `OPENROUTER_API_KEY` or provider quota |
| Styling anomalies | Ensure Tailwind 4 config & PostCSS not overridden |
| Import duplicate mismatch | Confirm CSV delimiters (comma/semicolon auto-detect planned) |

---
## Available Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development server (Astro) |
| `npm run build` | Production build |
| `npm run preview` | Preview built output locally |
| `npm run astro` | Direct Astro CLI passthrough (e.g. `npm run astro -- add`) |
| `npm run lint` | Run ESLint across project |
| `npm run lint:fix` | ESLint with automatic fixes |
| `npm run format` | Prettier format all supported files |

**Pre-commit:** `lint-staged` runs: ESLint (fix) on `*.ts,*.tsx,*.astro`; Prettier on `*.json,*.css,*.md`.

---
## Project Scope
### In Scope (MVP)
- Social OAuth (≥1 provider) via Supabase Auth
- Single shared household data context
- 11 predefined categories (see below)
- Monthly per-category limits (edit current & previous month only)
- Add / edit (current month) / delete single expenses
- AI categorization + confidence + manual override + fallback mapping
- CSV import (minimal schema) with preview, categorization, duplicate detection, selective commit
- Budget visualization (usage vs. limits with thresholds) + participant share
- Historical months read-only (> previous month)
- Basic PWA (installable, cached shell)

### Out of Scope (MVP)
- Advanced recurring expenses section
- Credit / debt tracking modules
- Trend / advanced analytical reporting
- Bank integrations / automatic transaction sync
- Data export / backup
- Multi-currency / multi-language
- Threshold push/email notifications
- Soft delete / audit trails / versioning

### Constraints
- Currency: PLN fixed
- Timezone: Europe/Warsaw
- No offline queue for writes (online required for mutations)

### Open / Unresolved Items
- Precise CSV format defaults (delimiter, decimal separator) sample pending
- AI correction logging scope & retention
- Confidence threshold ranges (e.g. low/medium/high boundaries)
- Refund handling (negative values vs. separate category)
- Partial import policy (skip vs. block on some invalid rows) – preference: skip with report

### Data Model (MVP Summary)
- Users (id, email, name, created_at)
- Transactions (amount, description, date, type_id, ai_confidence, ai_status, import_hash, user_id)
- Budget (month, type/category, amount)
- TransactionTypes (enumerated categories)
- AIKeywordMapping (static configuration for fallback)

### Categories (11)
Spożywcze · Dom · Zdrowie i Uroda · Samochód · Moda · Rozrywka i Okazje · Rachunki · Stałe wydatki · Nieplanowane · Inne (fallback) · Inwestycje

---
## Project Status
- Version: 0.0.1 (pre-MVP, active development)
- Current Focus: Core scaffolding (infrastructure, auth integration, initial data model, AI categorization prototype)

### Planned Roadmap (High Level)
1. Auth & Session Layer (OAuth + household bootstrap)
2. Expense CRUD + AI categorization + manual override
3. Monthly limits + visualization (threshold coloring)
4. CSV import pipeline (preview, duplicates, AI batch)
5. Metrics & logging (AI accuracy, fallback rate)
6. PWA enhancements & performance hardening (<3s TTI target)

### Success Metrics Targets
| Metric | Target |
|--------|--------|
| AI categorization acceptance | ≥90% (monthly rolling) |
| AI mean response time | <2s (p95 <3s) |
| Duplicate detection | 100% identical (Date+Amount+Description) |
| Import correctness (valid rows) | ≥95% typical files |
| Fallback rate | <10% of categorizations |
| Initial interactive load | <3s mobile reference |

### Documentation Links
- Product Requirements: [`./.ai/prd.md`](./.ai/prd.md)
- Tech Stack Rationale: [`./.ai/tech-stack.md`](./.ai/tech-stack.md)
- AI Coding Guidelines (Copilot): `.github/copilot-instructions.md`

> For contributors: please review the PRD before implementing features to ensure alignment with acceptance criteria and scope boundaries.

---
## License
MIT License. If a `LICENSE` file is not yet present, one should be added before public release.

---

_This README will evolve as open items are resolved (CSV format, confidence thresholds, branding). Contributions that clarify unsettled sections are welcome._
