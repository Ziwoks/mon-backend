const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ical = require('node-ical');

// 📁 Dossier de sortie pour les fichiers planning
const outputDir = path.join(__dirname, 'data');
const dbPath = path.join(outputDir, 'db.json');

// 🔧 Fonction pour formater la durée en "Xj Yh"
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}j ${hours}h`;
}

// 🔄 Fonction principale de traitement
async function processICS(maison) {
  if (!maison.icsUrl) {
    console.log(`⚠️  Pas d'URL ICS pour la maison : ${maison.nom}`);
    return;
  }

  try {
    console.log(`⏬ Téléchargement de l'ICS pour la maison : ${maison.nom}`);
    const response = await axios.get(maison.icsUrl);
    const events = Object.values(ical.parseICS(response.data))
      .filter(e => e.type === 'VEVENT')
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    const planning = [];

    for (let i = 0; i < events.length - 1; i++) {
      const rawEnd = new Date(events[i].end);
      const depart = new Date(rawEnd);
      depart.setDate(depart.getDate());
      depart.setHours(10, 0, 0, 0);

      const rawStart = new Date(events[i + 1].start);
      const arrivee = new Date(rawStart);
      arrivee.setHours(17, 0, 0, 0);

      const durationMs = arrivee - depart;

      if (durationMs > 0) {
        const dateStr = depart.toISOString().split('T')[0];

        planning.push({
		  id: `${maison.nom}-${dateStr}-${i}`,
          title: '🧼 Ménage',
          maison: maison.nom,
          date: dateStr,
          time: '10:00',
          duration: formatDuration(durationMs),
          color: maison.color || '#999999',
          tempsMenage: maison.tempsMenage !== undefined ? maison.tempsMenage : 0
        });
      }
    }

    const outputFile = path.join(outputDir, `planning-${maison.nom}.json`);
    let existingEvents = [];
if (fs.existsSync(outputFile)) {
  existingEvents = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
}

// Création d’un dictionnaire des anciens événements par ID
const existingMap = new Map();
existingEvents.forEach(ev => {
  existingMap.set(ev.id, ev);
});

// Fusion des données
const updatedPlanning = planning.map(newEv => {
  const existing = existingMap.get(newEv.id);
  if (existing) {
    return {
      ...newEv,
      done: existing.done || false,
      employe: existing.employe || "",
    };
  } else {
    return {
      ...newEv,
      done: false,
      employe: "",
    };
  }
});


fs.writeFileSync(outputFile, JSON.stringify(updatedPlanning, null, 2), 'utf-8');
    console.log(`✅ Planning généré pour : ${maison.nom}`);
  } catch (err) {
    console.error(`❌ Erreur pour ${maison.nom} : ${err.message}`);
  }
}

// 🔁 Exécution pour chaque maison
async function syncAll() {
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    for (const maison of db.maisons) {
      await processICS(maison);
    }
  } catch (err) {
    console.error('❌ Erreur de lecture du fichier db.json :', err.message);
  }
}

// ▶️ Exécution immédiate au lancement
syncAll();

// ⏱️ Répéter toutes les 30 minutes
setInterval(syncAll, 30 * 60 * 1000);
