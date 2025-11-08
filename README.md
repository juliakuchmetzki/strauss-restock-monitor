# Discord Restock Monitor

Ein automatischer Monitor, der die Verfügbarkeit des E+S Adventskalender Edition 7 auf Strauss.com überwacht und dich per Discord benachrichtigt, sobald das Produkt wieder verfügbar ist.

## Features

- Automatische Überwachung der Produktverfügbarkeit
- Discord-Benachrichtigungen bei Status-Änderungen
- Mehrere Erkennungsmethoden für maximale Zuverlässigkeit
- Konfigurierbares Überprüfungsintervall
- Test-Modus zum Überprüfen der Konfiguration

## Voraussetzungen

- Node.js (Version 14 oder höher)
- Ein Discord Server mit Webhook-Berechtigung

## Installation

1. Repository klonen oder herunterladen

2. Abhängigkeiten installieren:
```bash
npm install
```

3. Discord Webhook erstellen:
   - Öffne deinen Discord Server
   - Gehe zu Server-Einstellungen > Integrationen > Webhooks
   - Klicke auf "Neuer Webhook"
   - Wähle den Channel aus, in dem die Benachrichtigungen erscheinen sollen
   - Kopiere die Webhook-URL

4. Konfiguration erstellen:
```bash
cp .env.example .env
```

5. `.env` Datei bearbeiten und deine Discord Webhook URL eintragen:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/DEINE_WEBHOOK_ID/DEIN_WEBHOOK_TOKEN
CHECK_INTERVAL_MINUTES=5
```

## Verwendung

### Monitor starten

```bash
npm start
```

Der Monitor läuft nun kontinuierlich und überprüft alle 5 Minuten (oder dem konfigurierten Intervall) die Verfügbarkeit.

### Test-Modus

Um zu überprüfen, ob alles korrekt konfiguriert ist:

```bash
npm test
```

Dies führt eine einzelne Überprüfung durch und sendet eine Test-Benachrichtigung an Discord.

### Monitor stoppen

Drücke `Ctrl+C` im Terminal. Der Monitor sendet eine finale Benachrichtigung an Discord, bevor er sich beendet.

## Benachrichtigungen

Der Monitor sendet Discord-Benachrichtigungen in folgenden Fällen:

- **Monitor gestartet**: Beim ersten Start mit aktuellem Produktstatus
- **Restock Alert**: Wenn das Produkt wieder verfügbar wird
- **Ausverkauft**: Wenn das Produkt nicht mehr verfügbar ist
- **Fehler**: Bei wiederholten Fehlern beim Abrufen der Seite
- **Monitor gestoppt**: Wenn der Monitor beendet wird

## Konfiguration

Die Konfiguration erfolgt über die `.env` Datei:

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `DISCORD_WEBHOOK_URL` | Deine Discord Webhook URL | - |
| `CHECK_INTERVAL_MINUTES` | Überprüfungsintervall in Minuten | 5 |
| `PRODUCT_URL` | URL des zu überwachenden Produkts | Strauss Adventskalender |

## Funktionsweise

Der Monitor verwendet mehrere Methoden, um die Verfügbarkeit zu erkennen:

1. Prüfung auf "In den Warenkorb" Button
2. Analyse des Verfügbarkeitstextes
3. Suche nach "Nicht verfügbar" oder "Ausverkauft" Meldungen
4. Auswertung von strukturierten Daten (JSON-LD)

Dies gewährleistet maximale Zuverlässigkeit bei der Erkennung von Restocks.

## Hinweise

- Der Monitor muss kontinuierlich laufen, um Änderungen zu erkennen
- Bei Server-Betrieb kann PM2 oder eine ähnliche Process-Manager verwendet werden
- Empfohlenes Intervall: 5-15 Minuten (um nicht als Bot erkannt zu werden)
- Bei zu häufigen Anfragen könnte die IP temporär blockiert werden

## Dauerhafter Betrieb (Optional)

Für dauerhaften Betrieb auf einem Server:

```bash
# PM2 installieren
npm install -g pm2

# Monitor starten
pm2 start monitor.js --name "restock-monitor"

# Auto-Start bei System-Neustart
pm2 startup
pm2 save
```

## Troubleshooting

**Problem**: Keine Discord-Benachrichtigungen

- Überprüfe, ob die Webhook-URL korrekt ist
- Teste mit `npm test`
- Stelle sicher, dass der Bot Berechtigung hat, in den Channel zu schreiben

**Problem**: Falsche Verfügbarkeitserkennung

- Die Webseite könnte ihre Struktur geändert haben
- Führe einen Test durch: `npm test`
- Überprüfe die Konsolen-Ausgabe für Details

**Problem**: Fehler beim Abrufen der Seite

- Netzwerkverbindung überprüfen
- Firewall-Einstellungen kontrollieren
- Eventuell VPN verwenden

## Lizenz

MIT
