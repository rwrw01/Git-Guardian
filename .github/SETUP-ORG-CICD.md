# CI/CD Pipeline Setup — rwrw01 Organisatie

## Architectuur

```
rwrw01/.github (centrale repo)
└── .github/workflows/
    ├── reusable-ci.yml          ← TypeCheck, Build, npm audit, Gitleaks
    └── reusable-security.yml    ← CodeQL SAST, Dependency Review, License check

rwrw01/Git-Guardian (en elke andere repo)
└── .github/workflows/
    ├── ci.yml                   ← 3-regelige caller → reusable-ci.yml
    └── security.yml             ← 3-regelige caller → reusable-security.yml
```

## Stap 1: Centrale `.github` repo aanmaken

1. Maak een **publieke** repo `rwrw01/.github` aan op GitHub
2. Kopieer de reusable workflows:

```bash
# Vanuit Git-Guardian repo
mkdir -p /tmp/org-github/.github/workflows
cp .github/workflows/reusable-ci.yml /tmp/org-github/.github/workflows/
cp .github/workflows/reusable-security.yml /tmp/org-github/.github/workflows/

cd /tmp/org-github
git init && git add -A
git commit -m "Add reusable CI/CD workflows for rwrw01 organization"
git remote add origin https://github.com/rwrw01/.github.git
git push -u origin main
```

## Stap 2: Per repo de callers toevoegen

Kopieer de templates uit `.github/workflow-templates/` naar elke repo:

```bash
# In de root van elke rwrw01 repo
mkdir -p .github/workflows
cp <path-to>/workflow-templates/ci.yml .github/workflows/ci.yml
cp <path-to>/workflow-templates/security.yml .github/workflows/security.yml
git add .github/workflows/
git commit -m "Add CI/CD pipeline using rwrw01 reusable workflows"
git push
```

## Stap 3: GitHub organisatie-instellingen

### Dependabot (aanbevolen)
Schakel in via GitHub Settings → Code security → Dependabot:
- **Dependabot alerts**: Aan
- **Dependabot security updates**: Aan
- **Dependabot version updates**: Optioneel

### Branch protection rules
Stel in op `main` branch van elke repo:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (selecteer: `ci`, `security`)
- ✅ Require branches to be up to date before merging
- ❌ Allow force pushes

### Secret scanning
GitHub Settings → Code security:
- **Secret scanning**: Aan (gratis voor publieke repos)
- **Push protection**: Aan (blokkeert pushes met secrets)

## Overzicht: wat wordt wanneer gescand

| Check | Trigger | Blokkeert merge? |
|-------|---------|-------------------|
| TypeScript typecheck | Push + PR | Ja |
| Build | Push + PR | Ja |
| npm audit (HIGH+) | Push + PR | Ja |
| Gitleaks secret scan | Push + PR | Ja |
| CodeQL SAST | Push + wekelijks | Ja (bij PR) |
| Dependency review | PR | Ja |
| License compliance | Push + PR | Ja |
| Dependabot alerts | Continu | Nee (maakt PRs aan) |
| GitHub secret scanning | Push | Ja (met push protection) |

## Per-project overrides

Elke repo kan de defaults overschrijven in de caller workflow:

```yaml
jobs:
  ci:
    uses: rwrw01/.github/.github/workflows/reusable-ci.yml@main
    with:
      node-version: "20"          # Oudere Node versie
      run-typecheck: false         # Geen TypeScript
      build-command: "npm run dist" # Ander build commando
      audit-level: "critical"      # Alleen critical findings blokkeren
```
