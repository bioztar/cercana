# Cercana — rules for every agent and contributor

These rules come first. They override anything below, including the Expo template in AGENTS.md.

## `main` is protected — never push to it

- `main` is what runs at https://cercana.pro7ocol.com. GitHub rejects direct pushes to it, for
  everyone, admins included.
- Work on a branch, open a pull request, and let it be merged from there:
  - design work: `design/<topic>` → PR into `main`, files under `design/` only
  - code work: `<feature>` → PR into `main`
- Never force-push, never delete `main`, never try to bypass protection.
- **Don't merge your own PR.** Vitaly (`bioztar`) or helm (his orchestrator) reviews and
  merges, then redeploys. GitHub doesn't block self-merge here (so helm isn't blocked
  when it merges its own branches), so this rule is on you.
- Pull before you start (`git pull --rebase origin main`) so your branch is current.

## Who owns what

- **Andrey (`calledandrey`) — design.** Mockups made in Claude Design go into `design/`
  (one folder per flow, PNGs at 390 px phone width and desktop, plus `notes.md`). See
  `design/README.md`. Don't edit app code (`App.tsx`, `src/`, `supabase/`) in design PRs.
- **Vitaly's crewmates (via helm) — code**: app, Supabase schema and functions, deploy.
- Product concept: `family_memory_concept_for_designer.md`.

## Commits

- Conventional messages: `feat:`, `fix:`, `docs:`, `design:`, `chore:`.
- No AI co-author or "Generated with" lines in commits or PRs. Commits carry only the
  human author's own git user.

## Secrets

- Never commit `.env` or any key. The Supabase anon key is public by design but still lives
  only in the gitignored `.env`. The repo is **public**.

## Project facts that override the template below

- **No Expo Router.** Navigation is plain state in `App.tsx` + `src/screens/*`. Ignore the
  AGENTS.md "Navigation & Routing" section.
- Expo SDK 57, TypeScript. Checks before any PR: `npx tsc --noEmit` and
  `node --test src/lib/*.test.ts`, and `npx expo export -p web` for anything touching screens.

@AGENTS.md
