# Contributing to merit-aktiva-mcp

Development happens on **GitHub** (`werkstatt-jasper/merit-aktiva-mcp`). The default branch is **`main`**.

Product tracking (issues, milestone *Merit Aktiva*) lives in GitLab
(`werkstatt.ee/e-financials-mcp`). This repository is the open-source code host.
Tracker: [#218](https://gitlab.com/werkstatt.ee/e-financials-mcp/-/issues/218).

## Branch and PR workflow

Small OSS work often lands as a single commit on `main`. For larger changes:

1. `git fetch origin`
2. `git checkout main && git pull --ff-only`
3. `git checkout -b <issue-or-short-slug>` (e.g. `225-docs-m7`)
4. Implement changes.
5. Before pushing, run the checklist below.
6. `git push -u origin <issue-or-short-slug>`
7. Open a PR with the [GitHub CLI](https://cli.github.com/):

   ```bash
   gh pr create --base main --head <issue-or-short-slug> \
     --title "Short title" \
     --body $'What changed.\n\nRelates to GitLab #<iid>'
   ```

Always confirm the PR **compare** shows your commits (non-empty diff).

## Pre-push checklist

```bash
npm run lint          # or: npm run lint:fix
npm run test:coverage # 100% thresholds on src/
npm run build
npm audit --audit-level=high
```

With real `MERIT_API_ID` / `MERIT_API_KEY` in `.env`, also:

```bash
npm run test:integration
```

CI on GitHub runs lint, `test:coverage`, build, and `npm audit --audit-level=high`
(Node 20 and 22). Integration tests are local-only and skip cleanly when credentials
are unset.

## Requirements

- **Node.js 20+** (see `engines` in `package.json`).
- Follow existing **Biome** / **TypeScript** / **ESM `.js` import** conventions in `src/`.
- Do not commit `.env`, Api IDs, or Api Keys.
- Official Merit docs win over the [roosa-dev seed map](https://github.com/roosa-dev/merit-aktiva-mcp)
  when they conflict. Record quirks in [docs/api-coverage.md](docs/api-coverage.md).

## Downstream (hosted SaaS)

The GitLab product `werkstatt.ee/e-financials-mcp` will consume this repo as a
**git submodule** (planned under `packages/merit-aktiva`, issue M8 / #226). After
changes land on `main` here, maintainers bump the submodule pointer when releasing
integrated builds.
