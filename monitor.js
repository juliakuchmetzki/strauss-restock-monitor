require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

// Konfiguration
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CHECK_INTERVAL = (process.env.CHECK_INTERVAL_MINUTES || 5) * 60 * 1000; // in Millisekunden
const PRODUCT_URL = process.env.PRODUCT_URL || 'https://www.strauss.com/de/de/handwerkzeuge/e-s-adventskalender-edition-7-7903200-5576500-0.html';

// Status speichern
let previousStatus = null;
let checkCount = 0;

// Discord Benachrichtigung senden
async function sendDiscordNotification(title, description, color, fields = []) {
  if (!DISCORD_WEBHOOK_URL) {
    console.error('❌ Discord Webhook URL nicht konfiguriert!');
    return;
  }

  const embed = {
    title: title,
    description: description,
    color: color,
    fields: fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Strauss Restock Monitor'
    }
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      embeds: [embed]
    });
    console.log('✅ Discord Benachrichtigung gesendet');
  } catch (error) {
    console.error('❌ Fehler beim Senden der Discord Benachrichtigung:', error.message);
  }
}

// Produkt-Verfügbarkeit prüfen
async function checkProductAvailability() {
  checkCount++;
  console.log(`\n🔍 Überprüfung #${checkCount} - ${new Date().toLocaleString('de-DE')}`);

  try {
    // Webseite abrufen
    const response = await axios.get(PRODUCT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
      },
      timeout: 30000
    });

    // HTML parsen
    const $ = cheerio.load(response.data);

    // Verfügbarkeit prüfen - Strauss.com spezifische Erkennung
    let isAvailable = false;
    let statusText = 'Unbekannt';

    // Gesamten Seiteninhalt als Text für Suche vorbereiten
    const pageText = $('body').text().toLowerCase();
    const pageHtml = response.data.toLowerCase();

    // Methode 1: Nach spezifischen Strauss.com Texten suchen
    // "Nicht lieferbar" = Produkt ist ausverkauft
    if (pageText.includes('nicht lieferbar') || pageHtml.includes('nicht lieferbar')) {
      isAvailable = false;
      statusText = 'Nicht lieferbar';
    }

    // "Die Variante ist leider ausverkauft"
    if (pageText.includes('ausverkauft') || pageHtml.includes('articlenoavailable')) {
      isAvailable = false;
      statusText = 'Ausverkauft';
    }

    // Methode 2: availabilityState im JavaScript-Code suchen
    // availabilityState: 0 = nicht verfügbar, 1 = verfügbar
    const availabilityStateMatch = pageHtml.match(/"availabilitystate"\s*:\s*(\d+)/i);
    if (availabilityStateMatch) {
      const state = parseInt(availabilityStateMatch[1]);
      if (state === 0) {
        isAvailable = false;
        statusText = 'Nicht verfügbar (State: 0)';
      } else if (state === 1 || state > 0) {
        isAvailable = true;
        statusText = 'Verfügbar (State: ' + state + ')';
      }
    }

    // Methode 3: Positive Indikatoren (überschreiben nur wenn eindeutig verfügbar)
    // "In den Warenkorb" Button der nicht disabled ist
    const addToCartButton = $('button:contains("In den Warenkorb"), button:contains("Hinzufügen")');
    if (addToCartButton.length > 0) {
      const buttonHtml = addToCartButton.html();
      const buttonDisabled = addToCartButton.attr('disabled') || addToCartButton.hasClass('disabled');

      // Nur als verfügbar markieren wenn Button existiert UND nicht disabled ist
      if (!buttonDisabled && !pageText.includes('nicht lieferbar') && !pageText.includes('ausverkauft')) {
        isAvailable = true;
        statusText = 'Verfügbar';
      }
    }

    // Methode 4: "Lieferbar" oder "Auf Lager" als positive Indikatoren
    if ((pageText.includes('lieferbar') && !pageText.includes('nicht lieferbar')) ||
        pageText.includes('auf lager') ||
        pageText.includes('sofort verfügbar')) {
      // Nur wenn KEINE negativen Indikatoren vorhanden
      if (!pageText.includes('nicht lieferbar') && !pageText.includes('ausverkauft')) {
        isAvailable = true;
        statusText = 'Verfügbar';
      }
    }

    // Produktname extrahieren
    const productName = $('h1, .product-name, .product-title').first().text().trim() || 'E+S Adventskalender Edition 7';

    console.log(`📦 Produkt: ${productName}`);
    console.log(`📊 Status: ${statusText}`);
    console.log(`🔗 URL: ${PRODUCT_URL}`);

    // Status-Änderung prüfen
    if (previousStatus !== null && previousStatus !== isAvailable) {
      if (isAvailable) {
        // RESTOCK! 🎉
        await sendDiscordNotification(
          '🎉 RESTOCK ALERT! 🎉',
          `**${productName}** ist jetzt wieder verfügbar!`,
          3066993, // Grün
          [
            {
              name: '🔗 Link',
              value: `[Jetzt kaufen!](${PRODUCT_URL})`,
              inline: false
            },
            {
              name: '⏰ Zeitpunkt',
              value: new Date().toLocaleString('de-DE'),
              inline: true
            }
          ]
        );
      } else {
        // Wieder ausverkauft
        await sendDiscordNotification(
          '😢 Produkt nicht mehr verfügbar',
          `**${productName}** ist jetzt ausverkauft.`,
          15158332, // Rot
          [
            {
              name: '⏰ Zeitpunkt',
              value: new Date().toLocaleString('de-DE'),
              inline: true
            }
          ]
        );
      }
    } else if (previousStatus === null) {
      // Erste Überprüfung
      const initialColor = isAvailable ? 3066993 : 15844367; // Grün oder Orange
      await sendDiscordNotification(
        '🤖 Monitor gestartet',
        `Überwache jetzt **${productName}**`,
        initialColor,
        [
          {
            name: '📊 Aktueller Status',
            value: statusText,
            inline: true
          },
          {
            name: '⏰ Intervall',
            value: `Alle ${process.env.CHECK_INTERVAL_MINUTES || 5} Minuten`,
            inline: true
          },
          {
            name: '🔗 Link',
            value: `[Zur Produktseite](${PRODUCT_URL})`,
            inline: false
          }
        ]
      );
    }

    previousStatus = isAvailable;

  } catch (error) {
    console.error('❌ Fehler beim Überprüfen der Verfügbarkeit:', error.message);

    if (checkCount % 10 === 0) { // Nur jede 10. Fehlermeldung senden
      await sendDiscordNotification(
        '⚠️ Fehler beim Überwachen',
        `Es gab einen Fehler beim Abrufen der Produktseite.`,
        15105570, // Orange
        [
          {
            name: '❌ Fehler',
            value: error.message,
            inline: false
          }
        ]
      );
    }
  }
}

// Test-Modus
if (process.argv.includes('--test')) {
  console.log('🧪 Test-Modus aktiviert');
  console.log('📋 Konfiguration:');
  console.log(`   - Discord Webhook: ${DISCORD_WEBHOOK_URL ? '✅ Konfiguriert' : '❌ Nicht konfiguriert'}`);
  console.log(`   - Intervall: ${process.env.CHECK_INTERVAL_MINUTES || 5} Minuten`);
  console.log(`   - URL: ${PRODUCT_URL}`);
  console.log('\n🔍 Führe Test-Überprüfung durch...\n');

  checkProductAvailability().then(() => {
    console.log('\n✅ Test abgeschlossen');
    process.exit(0);
  });
} else {
  // Normaler Modus
  console.log('🚀 Discord Restock Monitor gestartet');
  console.log('📋 Konfiguration:');
  console.log(`   - Produkt: E+S Adventskalender Edition 7`);
  console.log(`   - Intervall: ${process.env.CHECK_INTERVAL_MINUTES || 5} Minuten`);
  console.log(`   - URL: ${PRODUCT_URL}`);
  console.log('\n👀 Überwachung läuft...\n');

  // Erste Überprüfung sofort
  checkProductAvailability();

  // Regelmäßige Überprüfung
  setInterval(checkProductAvailability, CHECK_INTERVAL);
}

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Monitor wird beendet...');
  await sendDiscordNotification(
    '🛑 Monitor gestoppt',
    'Der Restock Monitor wurde beendet.',
    15158332, // Rot
    [
      {
        name: '📊 Überprüfungen',
        value: `${checkCount} Überprüfungen durchgeführt`,
        inline: true
      }
    ]
  );
  process.exit(0);
});
