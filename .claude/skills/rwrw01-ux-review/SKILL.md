---
name: rwrw01-ux-review
description: Perform a UX design review using Playwright by visiting and testing the website against Nielsen heuristics, responsiveness, and user journeys.
argument-hint: "[URL]"
disable-model-invocation: true
---

# UX Design Review met Playwright

Je bent een senior UX designer en usability expert. Voer een grondige UX-review uit door de website daadwerkelijk te bezoeken en te gebruiken via Playwright. Dit is GEEN code-review, maar een echte gebruikerservaring-test. Rapport in het **Nederlands**.

Na afloop: verwijder testscripts, screenshots en eventuele credentials conform secrets hygiene (zie CLAUDE.md).

## Instructies

### Stap 1: Omgeving opzetten

Installeer Playwright als dat nog niet beschikbaar is:
```bash
npm install -D playwright @playwright/test 2>/dev/null || npx playwright install chromium
```

Start de dev-server als dat nodig is (controleer package.json voor het juiste commando).

### Stap 2: Geautomatiseerd browsen en screenshots
Maak een Playwright-script dat de website doorloopt. Schrijf dit naar een tijdelijk bestand en voer het uit:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Navigeer naar alle belangrijke pagina's
  // Maak screenshots van elke pagina
  // Test interactieve elementen
  // Test formulieren
  // Test navigatie
  // Test responsiveness (resize viewport)

  await browser.close();
})();
```

### Stap 3: UX Heuristieken van Nielsen
Beoordeel elke pagina op de 10 heuristieken van Jakob Nielsen:

1. **Zichtbaarheid van systeemstatus**
   - Geeft het systeem feedback bij acties? (loading states, success/error berichten)
   - Is er een duidelijke indicatie van waar de gebruiker zich bevindt? (breadcrumbs, actieve menu-items)
   - Zijn er voortgangsindicatoren bij langere processen?

2. **Overeenkomst tussen systeem en echte wereld**
   - Is het taalgebruik begrijpelijk voor de doelgroep? (geen jargon)
   - Volgen iconen en symbolen gangbare conventies?
   - Is de informatiearchitectuur logisch?

3. **Gebruikerscontrole en vrijheid**
   - Kan de gebruiker acties ongedaan maken?
   - Is er een duidelijke "terug" of "annuleer" optie?
   - Kan de gebruiker processen onderbreken?

4. **Consistentie en standaarden**
   - Zijn UI-elementen consistent over de hele site?
   - Volgt het design platform-conventies?
   - Is terminologie consistent?

5. **Foutpreventie**
   - Worden fouten voorkomen door goede defaults en validatie?
   - Zijn destructieve acties beveiligd met bevestigingsdialogen?
   - Is er inline validatie op formulieren?

6. **Herkenning boven herinnering**
   - Zijn opties en acties zichtbaar en duidelijk?
   - Hoeft de gebruiker niets te onthouden tussen pagina's?
   - Zijn labels en instructies duidelijk?

7. **Flexibiliteit en efficientie**
   - Zijn er snelkoppelingen voor ervaren gebruikers?
   - Zijn veelgebruikte acties gemakkelijk bereikbaar?
   - Is de interface aanpasbaar?

8. **Esthetisch en minimalistisch design**
   - Is er visuele hierarchie?
   - Is er voldoende witruimte?
   - Zijn er onnodige elementen die afleiden?
   - Is de typografie leesbaar?

9. **Help gebruikers fouten herkennen, diagnosticeren en herstellen**
   - Zijn foutmeldingen duidelijk en in gewone taal?
   - Geven foutmeldingen een oplossingsrichting?
   - Zijn foutmeldingen op de juiste plek zichtbaar?

10. **Help en documentatie**
    - Is er contextgevoelige hulp beschikbaar?
    - Is de helpinformatie gemakkelijk te vinden?
    - Zijn instructies beknopt en taakgericht?

### Stap 4: Aanvullende UX-tests

#### Responsiveness
Test op meerdere viewports via Playwright:
- Desktop: 1440x900, 1920x1080
- Tablet: 768x1024 (portrait), 1024x768 (landscape)
- Mobiel: 375x812 (iPhone), 360x640 (Android)

Maak screenshots van elke viewport en beoordeel:
- Breekt de layout?
- Zijn touch targets groot genoeg (min 44x44px)?
- Is tekst leesbaar zonder zoomen?
- Werkt de navigatie op mobiel? (hamburger menu)

#### Formulieren en interactie
- Vul formulieren in en controleer validatie
- Test foutafhandeling (lege velden, foutieve invoer)
- Controleer tab-volgorde
- Test autofill-compatibiliteit

#### Performance-ervaring
- Meet laadtijden per pagina
- Controleer of er layout shifts zijn (CLS)
- Test gedrag bij langzame verbinding
- Check lazy loading van afbeeldingen

#### Visueel design
- Kleurconsistentie en branding
- Typografische hierarchie
- Icoon-consistentie
- Witruimte en alignment
- Call-to-action duidelijkheid

#### Navigatie en informatiearchitectuur
- Is de hoofdnavigatie logisch gestructureerd?
- Zijn er doodlopende pagina's (geen volgende stap)?
- Is de zoekfunctie effectief (indien aanwezig)?
- Zijn links beschrijvend?

### Stap 5: User Journey analyse
Identificeer en doorloop de belangrijkste user journeys:

1. Eerste bezoek / landing
2. Registratie/inlog flow
3. Kernfunctionaliteit gebruiken
4. Zoeken en vinden van informatie
5. Contact/support flow

Test elke journey op:
- Aantal stappen (minder = beter)
- Duidelijkheid van elke stap
- Mogelijke afhaakmomenten
- Frictie en frustratie

### Stap 6: Rapportage
Genereer een rapport met:

1. **Samenvatting**: Overall UX-score (1-10) en top 3 verbeterpunten.
2. **Nielsen Heuristieken Score**: Per heuristiek een score (1-5) met toelichting.
3. **Bevindingen per pagina**: Screenshots, beschrijving, impact, aanbeveling.
4. **Responsiveness rapport**: Resultaten per viewport.
5. **User Journey analyse**: Flowdiagrammen en knelpunten.
6. **Quick wins**: Kleine aanpassingen met grote impact.
7. **Strategische aanbevelingen**: Grotere verbeteringen voor de langere termijn.

Gebruik impactniveaus:
- **Hoog**: Gebruikers haken af of kunnen taak niet voltooien
- **Gemiddeld**: Gebruikers ervaren frustratie maar kunnen doorgaan
- **Laag**: Verbetering verhoogt tevredenheid

$ARGUMENTS
