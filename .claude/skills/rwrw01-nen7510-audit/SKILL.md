---
name: rwrw01-nen7510-audit
description: Analyze document coverage against NEN7510 controls, identify gaps and duplicates, and generate a compliance report. Use for NEN7510 audits, gap analysis, or coverage checks.
argument-hint: "[database path] [controls file]"
disable-model-invocation: true
---

# NEN7510 Dekkingsanalyse

Genereer rapport in het **Nederlands**.

## Data Sources

- Database: path provided via $ARGUMENTS[0] (SQLite with tables: documents, document_chunks, chunk_control_matches)
- Controls: path provided via $ARGUMENTS[1] (JavaScript module exporting NEN7510 control definitions)
- Matches: table `chunk_control_matches` (hybrid score >= 0.50)
- Documents: table `documents` + `document_chunks`

## Rapport template

```markdown
# NEN7510 Dekkingsanalyse — [datum]

## Samenvatting
- X beheersmaatregelen geanalyseerd
- X goed gedekt (>=60%), X beperkt (50-59%), X zonder dekking

## Kritieke gaps
[Beheersmaatregelen zonder documentatie — actie vereist]

## Dubbelingen
[Documenten die dezelfde controls dekken — samenvoegkansen]

## Actielijst (geprioriteerd)
1. [actie + verantwoordelijke + type document]
```

## Classificatie

| Score | Status | Actie |
|---|---|---|
| >=60% | Goed | Geen |
| 50-59% | Beperkt | Review inhoud |
| <50% | Geen | Document schrijven of uitbreiden |

$ARGUMENTS
