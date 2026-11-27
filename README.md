# Hjem — vægpanel til Homey Pro

Et fuldskærms-kontrolpanel til en iPad på væggen. Det taler direkte med din Homey Pro over Homeys Web API og har ingen server, ingen build og ingen afhængigheder.

**Indhold:** ur og dato · klima og ventilation (Komfovent, temperatur, fugt, CO₂) · lys pr. rum med lysdæmper · Sonos (afspil/pause, skip, lydstyrke, flere højttalere) · stemninger (moods) · flows, der kan startes · dæmpet skærm om natten.

Prøv det uden Homey: åbn `index.html?demo`.

---

## 1. Opret en API-nøgle i Homey

1. Gå til **my.homey.app**, åbn **Indstillinger → API Keys**, og tryk **New API Key**.
2. Kald den fx `Vægpanel`, og giv den kun de rettigheder, panelet skal bruge:
   - Devices (læse + styre)
   - Zones (læse)
   - Flows (læse + starte)
   - Moods (læse + aktivere)
3. Kopiér nøglen med det samme. Homey viser den kun én gang.

Du kan altid slette nøglen igen. Så mister panelet adgangen med det samme.

## 2. Læg det på GitHub Pages

```bash
git init && git add . && git commit -m "Hjem vægpanel"
gh repo create homey-panel --public --source=. --push
```

Gå derefter til repoet på GitHub, åbn **Settings → Pages**, vælg *Deploy from a branch*, sæt branch til `main` og mappe til `/ (root)`, og tryk Save.

Efter et minuts tid ligger panelet på `https://mgbundgaard.github.io/homey-panel/`.

> Selve koden indeholder ingen nøgler. Nøglen indtastes på iPad'en og gemmes kun dér (i browserens lokale lager), så repoet kan godt være offentligt.

## 3. Sæt iPad'en op

1. Åbn adressen i **Safari** på iPad'en.
2. Tryk på Del-knappen, vælg **Føj til hjemmeskærm**, og åbn panelet fra det nye ikon "Hjem". Så kører det i fuld skærm.
3. Tryk ⚙ og udfyld:
   - **Homey-adresse:** Homeys IP-adresse, fx `192.168.1.50`. Panelet laver den selv om til den sikre adresse `https://192-168-1-50.homey.homeylocal.com`. Find IP'en i Homey-appen under Indstillinger → Generelt.
   - **API-nøgle:** nøglen fra trin 1.
4. Tryk **Test forbindelse** og derefter **Gem**.
5. Under *Hvad skal vises?* kan du selv vælge enheder, moods og flows. Lader du det stå tomt, vælger panelet automatisk.

**Tips til vægmontering**
- Indstillinger → Skærm og lysstyrke → **Autolås: Aldrig**, så skærmen bliver tændt.
- Indstillinger → Tilgængelighed → **Guidet adgang**, hvis panelet skal være låst til appen.
- Giv Homey en fast IP-adresse i din router. Så holder adressen, når routeren genstarter.

## Hvordan det virker

| Del | Kald |
|---|---|
| Enheder (hvert 4. sek.) | `GET /api/manager/devices/device/` |
| Styring | `PUT /api/manager/devices/device/:id/capability/:cap` |
| Rum | `GET /api/manager/zones/zone/` |
| Moods | `GET /api/manager/moods/mood/` · `POST …/mood/:id/set` |
| Flows | `GET /api/manager/flow/flow/` + `advancedflow` · `POST …/:id/trigger` |

Alle kald sendes med headeren `Authorization: Bearer <API-nøgle>`.

- **Klima:** Komfovent-enheden vises som et stort kort. Panelet bygger selv knapper ud fra enhedens egenskaber: valglister bliver til knapper, ønsket temperatur får +/−, og tal-værdier får en skyder. Det virker derfor med det, din Komfovent-app udstiller, uden at noget er kodet fast.
- **Flows:** Kun flows, der kan startes manuelt, vises. Det er dem, der har kortet *"Dette flow er startet"*.

## Fejlfinding

- **"Kan ikke nå Homey"**: Tjek, at iPad'en er på samme Wi-Fi som Homey, og at IP-adressen er rigtig. Prøv `https://<ip-med-bindestreger>.homey.homeylocal.com/api/manager/devices/device/` direkte i Safari. Svarer den med *401*, er forbindelsen i orden.
- **"Homey afviste API-nøglen"**: Nøglen er forkert, slettet eller mangler en rettighed.
- **Uden for hjemmet:** Brug adressen `https://<homey-id>.connect.athom.com` i stedet.
- **Enhed vises ikke:** Vælg den manuelt under ⚙ → *Hvad skal vises?*.

## Filer

```
index.html            layout
style.css             design (mørkt tema, store trykflader)
app.js                logik, API-kald, indstillinger
demo.js               falske data til ?demo
manifest.webmanifest  fuldskærm på hjemmeskærmen
icons/                app-ikoner
```
