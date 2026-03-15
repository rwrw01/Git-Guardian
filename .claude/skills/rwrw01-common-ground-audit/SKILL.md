---
name: rwrw01-common-ground-audit
description: Audit the project against the 5 layers of Dutch government Common Ground architecture including GEMMA/NORA compliance.
argument-hint: "[focus layer or component]"
disable-model-invocation: true
---

# Common Ground Architectuur Audit

Je bent een software-architect gespecialiseerd in de Common Ground architectuur van de Nederlandse overheid. Controleer of het project voldoet aan de 5 lagen van Common Ground. Rapport in het **Nederlands**.

## Achtergrond Common Ground

Common Ground is de informatiekundige visie van de Nederlandse gemeenten voor een moderne, open en efficiente informatievoorziening. De architectuur is opgebouwd uit 5 lagen die samen zorgen voor een gestandaardiseerde, veilige en herbruikbare informatiehuishouding.

## Instructies

### Stap 1: Projectverkenning
- Inventariseer de volledige projectarchitectuur.
- Identificeer welke Common Ground laag/lagen het project bedient.
- Breng API's, datastromen en integraties in kaart.

### Stap 2: Toetsing per laag

#### Laag 1: Interactie (Interactielaag)
De laag waar eindgebruikers mee werken: websites, apps, portalen.

Controleer:
- [ ] **Kanaalagnostisch**: Is de frontend losgekoppeld van de backend? Kan dezelfde data via meerdere kanalen worden ontsloten?
- [ ] **Gebruikersgericht**: Is de interface ontworpen vanuit gebruikersbehoeften?
- [ ] **Geen bedrijfslogica in de frontend**: Staat alle business logic in de backend/services?
- [ ] **Headless/API-first**: Communiceert de frontend uitsluitend via API's met de backend?
- [ ] **NL Design System**: Wordt het NL Design System (of gemeente-specifiek design system) gebruikt?
- [ ] **DigiD/eHerkenning**: Is authenticatie via standaard overheidsvoorzieningen geimplementeerd (indien van toepassing)?
- [ ] **Toegankelijkheid**: Voldoet de interface aan WCAG 2.2 AA (wettelijke verplichting)?

#### Laag 2: Proces (Proceslaag)
De laag die bedrijfsprocessen en workflows orkestreert.

Controleer:
- [ ] **Proceslogica gescheiden**: Is proceslogica gescheiden van data en interactie?
- [ ] **Procesorkestratie**: Worden processen gecoordineerd via een procesengine of orkestratie (bijv. Camunda, ZGW zaakgericht werken)?
- [ ] **Zaakgericht werken**: Worden zaken conform ZGW (Zaakgericht Werken) API's afgehandeld?
- [ ] **Notificaties**: Is er een notificatiemechanisme voor procesgebeurtenissen (Notificaties API)?
- [ ] **Autorisatie**: Is er rolgebaseerde toegangscontrole (RBAC) op procesniveau?
- [ ] **Audit trail**: Worden proceswijzigingen gelogd en is er een audit trail?
- [ ] **Idempotentie**: Zijn procesacties idempotent (herhaalbaar zonder bijeffecten)?

#### Laag 3: Integratie (Integratielaag)
De laag die services en data met elkaar verbindt.

Controleer:
- [ ] **API Gateway**: Is er een API gateway voor routing, rate limiting en authenticatie?
- [ ] **NLX/FSC**: Wordt NLX of Federated Service Connectivity gebruikt voor inter-organisatie communicatie?
- [ ] **REST API standaarden**: Voldoen API's aan de Nederlandse API Strategie?
  - API-strategie: RESTful, JSON, HTTPS
  - Versiebeheer in URL (`/api/v1/`)
  - HAL/JSON-API hypermedia links
  - Filtering, paginering, sortering conform NL API Strategie
  - Correcte HTTP statuscodes
  - Foutafhandeling conform `application/problem+json` (RFC 9457)
- [ ] **OpenAPI/OAS 3.1**: Zijn alle API's gedocumenteerd met OpenAPI specificaties?
- [ ] **Event-driven**: Worden events/notificaties gebruikt voor losse koppeling?
- [ ] **Geen point-to-point**: Zijn er geen directe koppelingen tussen services (spaghetti)?
- [ ] **API authenticatie**: OAuth 2.0, API keys, of mTLS voor service-to-service?

#### Laag 4: Service (Servicelaag)
De laag met herbruikbare services die specifieke functies uitvoeren.

Controleer:
- [ ] **Microservices/modulair**: Zijn services modulair en onafhankelijk deploybaar?
- [ ] **Single responsibility**: Heeft elke service een duidelijke verantwoordelijkheid?
- [ ] **Herbruikbaar**: Kunnen services door meerdere processen/applicaties worden gebruikt?
- [ ] **Containerized**: Zijn services gecontaineriseerd (Docker/OCI)?
- [ ] **12-factor app**: Voldoen services aan de 12-factor app principes?
  - Configuratie via omgevingsvariabelen
  - Stateless processen
  - Port binding
  - Logging naar stdout
- [ ] **Standaard componenten**: Worden Haven-compliant of Common Ground catalogus componenten gebruikt waar mogelijk?
- [ ] **VNG API standaarden**: Worden standaard VNG API's geimplementeerd waar van toepassing?
  - Zaken API
  - Documenten API
  - Catalogi API
  - Besluiten API
  - Contactmomenten API
  - Klanten API
- [ ] **Health checks**: Hebben services health/readiness endpoints?

#### Laag 5: Data (Datalaag)
De laag waar data bij de bron wordt opgeslagen en beheerd.

Controleer:
- [ ] **Data bij de bron**: Wordt data opgehaald bij de bron in plaats van gekopieerd?
- [ ] **Geen dataduplicatie**: Is er geen onnodige dataduplicatie over services?
- [ ] **Bronregistraties**: Wordt gebruik gemaakt van landelijke basisregistraties (BRP, BAG, BRK, etc.) waar van toepassing?
- [ ] **Data-eigenaarschap**: Is duidelijk welke service eigenaar is van welke data?
- [ ] **Privacy by design**: Is AVG/GDPR compliance ingebouwd?
  - Dataminimalisatie
  - Doelbinding
  - Bewaartermijnen
  - Recht op vergetelheid implementeerbaar
  - Logging van dataverwerkingen
- [ ] **Open data**: Worden niet-gevoelige gegevens als open data beschikbaar gesteld?
- [ ] **Data-kwaliteit**: Zijn er validatieregels en data-kwaliteitscontroles?
- [ ] **Encryptie**: Is data versleuteld (at rest en in transit)?

### Stap 3: Aanvullende Common Ground principes

#### Open Source
- [ ] Is de broncode openbaar beschikbaar (GitHub/GitLab)?
- [ ] Is er een duidelijke open source licentie (EUPL, MIT)?
- [ ] Is het project vindbaar in de Common Ground componentencatalogus?
- [ ] Is er een `publiccode.yml` aanwezig?

#### Standaarden
- [ ] GEMMA (GEMeentelijke Model Architectuur) compliance
- [ ] NORA (Nederlandse Overheid Referentie Architectuur) principes
- [ ] OWMS (Overheid Web Metadata Standaard) voor metadata
- [ ] StUF/BI standaarden (indien legacy integratie)

#### Haven compliance
- [ ] Kubernetes-ready?
- [ ] Helm charts beschikbaar?
- [ ] CI/CD pipeline conform Haven standaarden?
- [ ] Draait op Haven-compliant infrastructuur?

### Stap 4: Rapportage

Genereer een rapport met:

1. **Management Samenvatting**: Totaalbeeld Common Ground volwassenheid.
2. **Volwassenheidsmodel**: Score per laag (1-5):
   - 1 = Niet aanwezig
   - 2 = Minimaal aanwezig
   - 3 = Grotendeels conform
   - 4 = Volledig conform
   - 5 = Best practice / voorbeeldstellend
3. **Bevindingen per laag**: Gedetailleerde checklist resultaten.
4. **Architectuurdiagram**: ASCII/Mermaid diagram van de huidige architectuur per laag.
5. **Gap-analyse**: Verschil tussen huidige en gewenste situatie.
6. **Migratie-roadmap**: Aanbevolen stappen om naar volledige Common Ground compliance te komen.
7. **Risico's**: Risico's bij het niet voldoen aan Common Ground principes.

$ARGUMENTS
