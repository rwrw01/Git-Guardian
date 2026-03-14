---
name: rwrw01-documentation
description: Generate complete user and admin documentation in Dutch for the current project.
argument-hint: "[scope: user|admin|both]"
disable-model-invocation: true
---

# Documentatie Genereren (Nederlands)

Je bent een technisch schrijver die documentatie schrijft in het **Nederlands**. Genereer documentatie die bruikbaar is voor zowel **gebruikers** als **beheerders**. De documentatie moet helder, compleet en praktisch zijn.

## Instructies

### Stap 1: Projectanalyse
- Lees de volledige projectstructuur en broncode.
- Identificeer het type applicatie (webapp, API, CLI, library, etc.).
- Bepaal de doelgroep(en): eindgebruikers, beheerders, ontwikkelaars.
- Inventariseer bestaande documentatie.

### Stap 2: Gebruikersdocumentatie

Schrijf documentatie vanuit het perspectief van de eindgebruiker. Gebruik eenvoudige taal, vermijd technisch jargon.

#### Structuur gebruikersdocumentatie:

**1. Introductie**
- Wat doet de applicatie? (in 2-3 zinnen)
- Voor wie is het bedoeld?
- Wat zijn de belangrijkste functies?

**2. Aan de slag**
- Hoe krijg je toegang? (URL, inloggen, registreren)
- Eerste stappen na inloggen
- Overzicht van de interface (beschrijf de hoofdonderdelen)

**3. Functies en handleidingen**
Per kernfunctie een handleiding met:
- Wat kun je ermee?
- Stapsgewijze instructies (genummerd)
- Screenshots of beschrijvingen van wat je ziet
- Tips en aandachtspunten
- Veelgemaakte fouten en hoe je ze oplost

**4. Veelgestelde vragen (FAQ)**
- Verzamel logische vragen op basis van de functionaliteit
- Geef duidelijke, korte antwoorden

**5. Problemen oplossen**
- Veelvoorkomende foutmeldingen en wat ze betekenen
- Wat te doen als iets niet werkt
- Contactgegevens voor ondersteuning (als beschikbaar)

### Stap 3: Beheerdocumentatie

Schrijf documentatie vanuit het perspectief van een systeembeheerder of DevOps engineer.

#### Structuur beheerdocumentatie:

**1. Architectuuroverzicht**
- Systeemarchitectuur (componenten en hun relaties)
- Gebruikte technologieen en versies
- Infrastructuurvereisten (CPU, geheugen, opslag)
- Netwerkvereisten (poorten, domeinen, certificaten)

**2. Installatie en configuratie**
- Systeemvereisten (OS, runtime, dependencies)
- Stapsgewijze installatie-instructies
- Alle configuratieopties met uitleg:
  - Omgevingsvariabelen (naam, beschrijving, type, standaardwaarde, verplicht/optioneel)
  - Configuratiebestanden
  - Feature flags
- Database setup en migraties
- Externe koppelingen configureren

**3. Deployment**
- Deployment strategieen (Docker, Kubernetes, bare metal)
- CI/CD pipeline uitleg
- Omgevingen (OTAP: Ontwikkeling, Test, Acceptatie, Productie)
- Rollback procedures
- Blue-green of canary deployment (indien van toepassing)

**4. Beheer en onderhoud**
- Dagelijks beheer: wat moet je controleren?
- Monitoring: welke metrics zijn belangrijk?
- Logging: waar staan logs, hoe lees je ze?
- Backup en restore procedures
- Database onderhoud
- SSL/TLS certificaat vernieuwing
- Dependency updates: hoe en wanneer?

**5. Beveiliging**
- Beveiligingsmaatregelen die zijn getroffen
- Hoe secrets worden beheerd
- Gebruikers- en rechtenbeheer
- Netwerkconfiguratie en firewallregels
- Audit logging

**6. Schalen**
- Horizontaal vs. verticaal schalen
- Load balancing configuratie
- Caching strategie
- Database schaling

**7. Troubleshooting voor beheerders**
- Veelvoorkomende problemen en oplossingen
- Health check endpoints
- Diagnostische commando's
- Wanneer escaleren en naar wie?

**8. Disaster recovery**
- RTO en RPO (indien gedefinieerd)
- Recovery procedures
- Contactpersonen bij calamiteiten

### Stap 4: Schrijfrichtlijnen

Houd je aan deze richtlijnen:
- **Taal**: Nederlands, tenzij technische termen geen gangbare Nederlandse vertaling hebben.
- **Stijl**: Actief, direct, in de u-vorm of je-vorm (consistent kiezen).
- **Structuur**: Korte alinea's, opsommingen, genummerde stappen.
- **Voorbeelden**: Geef concrete voorbeelden bij configuratie en commando's.
- **Versionering**: Vermeld bij welke versie van de software de documentatie hoort.
- **Formaat**: Markdown, zodat het gemakkelijk te renderen is op GitHub, GitLab, of in documentatiesystemen.

### Stap 5: Output

Genereer de volgende bestanden:

1. `docs/gebruikershandleiding.md` - Complete gebruikersdocumentatie
2. `docs/beheerhandleiding.md` - Complete beheerdocumentatie
3. `docs/CHANGELOG.md` - Wijzigingslogboek (als er versiehistorie is)

Als er al een `docs/` directory bestaat, pas de structuur aan op wat er al is.

Meld aan het einde welke bestanden zijn aangemaakt of bijgewerkt.

$ARGUMENTS
