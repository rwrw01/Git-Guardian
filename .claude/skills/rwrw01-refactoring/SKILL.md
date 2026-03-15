---
name: rwrw01-refactoring
description: Split large files (>300 lines) into logical modules while preserving functionality. Use when a file exceeds the line limit or needs structural reorganization.
argument-hint: "[file path]"
disable-model-invocation: true
---

# Refactoring — Bestand Opsplitsen

## Workflow

1. Lees het bestand, tel regels per functie/blok
2. Presenteer splitsplan aan gebruiker (nieuwe bestanden, regelaantallen, gedeelde exports)
3. **Wacht op goedkeuring** voordat je begint
4. Maak nieuwe modules aan, verplaats functies, voeg imports/exports toe
5. Verificatie:
   - `node -c <bestand>` op elk nieuw bestand
   - Start applicatie en test alle routes/functies
   - Elk bestand < 300 regels

## Splitsplan format

Per nieuw bestand:
- Bestandsnaam en pad
- Welke functies/exports het bevat
- Geschat regels
- Afhankelijkheden van andere modules

## Regels

- Geen functionele wijzigingen — alleen structureel
- Gedeelde helpers (escapeHtml, getDb) in een shared module
- CSS/styles apart van logica
- Het oorspronkelijke bestand wordt de router die modules importeert

$ARGUMENTS
