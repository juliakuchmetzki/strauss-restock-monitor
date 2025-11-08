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

    // Verfügbarkeit prüfen - verschiedene Selektoren
    let isAvailable = false;
    let statusText = 'Unbekannt';

    // Methode 1: Nach "In den Warenkorb" Button suchen
    const addToCartButton = $('button[data-add-to-cart], .add-to-cart, button:contains("In den Warenkorb")');
    if (addToCartButton.length > 0 && !addToCartButton.is(':disabled')) {
      isAvailable = true;
      statusText = 'Verfügbar';
    }

    // Methode 2: Nach Verfügbarkeitstext suchen
    const availabilityText = $('.availability, .product-availability, [data-availability]').text().toLowerCase();
    if (availabilityText.includes('verfügbar') && !availabilityText.includes('nicht') && !availabilityText.includes('ausverkauft')) {
      isAvailable = true;
      statusText = 'Verfügbar';
    }

    // Methode 3: Nach "Nicht verfügbar" oder "Ausverkauft" suchen
    if (availabilityText.includes('nicht verfügbar') ||
        availabilityText.includes('ausverkauft') ||
        availabilityText.includes('nicht lieferbar')) {
      isAvailable = false;
      statusText = 'Nicht verfügbar';
    }

    // Methode 4: Nach Stock-Status im JSON-LD suchen
    const jsonLdScript = $('script[type="application/ld+json"]').html();
    if (jsonLdScript) {
      try {
        const jsonData = JSON.parse(jsonLdScript);
        if (jsonData.offers && jsonData.offers.availability) {
          const availability = jsonData.offers.availability.toLowerCase();
          isAvailable = availability.includes('instock');
          statusText = isAvailable ? 'Verfügbar' : 'Nicht verfügbar';
        }
      } catch (e) {
        // JSON parsing fehlgeschlagen, ignorieren
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
