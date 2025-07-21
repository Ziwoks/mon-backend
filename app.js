const express = require('express');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const multer = require('multer');
const { parseICSFile } = require('./parser');
const syncAll = require('./sync');

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

const adapter = new FileSync('data/db.json');
const db = low(adapter);

// Initialisation DB
db.defaults({ maisons: [] }).write();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/views', express.static(path.join(__dirname, 'views')));

// 📍 Routes simples
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/maisons.html'));
});
app.get('/import', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/import.html'));
});
app.get('/planning', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/planning.html'));
});
app.get('/employes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/employes.html'));
});
app.get('/test', (req, res) => {
  res.send("✅ Route /test OK !");
});


// ✅ Création d'une maison
app.post('/maison', (req, res) => {
  const { nom, adresse, telephone, couleur, icsUrl, tempsMenage } = req.body;
  db.get('maisons')
    .push({ nom, adresse, telephone, color: couleur, icsUrl, tempsMenage: parseInt(tempsMenage) || 0 })
    .write();
  res.redirect('/');
});

// ✅ Création via fetch
app.post('/api/maisons', (req, res) => {
  const { nom, adresse, telephone, couleur, icsUrl, tempsMenage } = req.body;
  db.get('maisons')
    .push({ nom, adresse, telephone, color: couleur, icsUrl, tempsMenage: parseInt(tempsMenage) || 0 })
    .write();
  res.status(200).json({ message: "Maison ajoutée avec succès" });
});

// ✅ Mise à jour ou création si inexistante
app.post('/update-maison', (req, res) => {
  const { nom, adresse, telephone, couleur, icsUrl, tempsMenage } = req.body;

  const maisonExistante = db.get('maisons').find({ nom }).value();

  if (maisonExistante) {
    db.get('maisons')
      .find({ nom })
      .assign({ adresse, telephone, color: couleur, icsUrl, tempsMenage: parseInt(tempsMenage) || 0 })
      .write();
  } else {
    db.get('maisons')
      .push({ nom, adresse, telephone, color: couleur, icsUrl, tempsMenage: parseInt(tempsMenage) || 0 })
      .write();
  }

  res.redirect('/');
});

// ✅ Liste JSON des maisons
app.get('/api/maisons', (req, res) => {
  const maisons = db.get('maisons').value();
  res.json(maisons);
});

// ✅ Planning d’un jour donné
app.get('/api/planning/:date', (req, res) => {
  const date = req.params.date;
  const dataDir = path.join(__dirname, 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('planning-'));

  let allEvents = [];
  files.forEach(file => {
    const events = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    const filtered = events.filter(ev => ev.date === date);
    allEvents.push(...filtered);
  });

  res.json(allEvents);
});

// ✅ Import de fichiers ICS
app.post('/upload', upload.any(), (req, res) => {
  const files = req.files;
  const associations = req.body.maison;

  if (!files || !Array.isArray(files)) {
    return res.send('Aucun fichier ICS reçu.');
  }

  const maisons = db.get('maisons').value();

  files.forEach((file, index) => {
    const nomMaison = Array.isArray(associations) ? associations[index] : associations;
    const maisonData = maisons.find(m => m.nom === nomMaison) || {};
    const tasks = parseICSFile(file.path, nomMaison, maisonData);

    const outputFile = `data/planning-${nomMaison}.json`;
    let allTasks = [];

    if (fs.existsSync(outputFile)) {
      allTasks = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    }

    allTasks = [...allTasks, ...tasks];
    fs.writeFileSync(outputFile, JSON.stringify(allTasks, null, 2));
  });

  res.redirect('/import');
});

// ✅ Lancement de la synchronisation automatique
setInterval(() => {
  console.log("⏳ Lancement de la synchronisation automatique des ICS...");
  syncAll();
}, 30 * 60 * 1000);
// ✅ Route pour sauvegarder l'ordre des tâches par employé
app.post('/api/sauver-ordre-taches', (req, res) => {
  const { date, employe, ordre } = req.body;

  const ordrePath = path.join(__dirname, 'data', 'ordre-taches.json');

  let data = {};
if (fs.existsSync(ordrePath)) {
  data = JSON.parse(fs.readFileSync(ordrePath, 'utf8'));
}

if (!data[date]) {
  data[date] = {};
}
data[date][employe] = ordre;

fs.writeFileSync(ordrePath, JSON.stringify(data, null, 2));
res.sendStatus(200);

});

// ✅ Route pour lire l’ordre des tâches enregistré
app.get('/api/ordre-taches', (req, res) => {
  const ordrePath = path.join(__dirname, 'data', 'ordre-taches.json');
  const date = req.query.date;

  if (!fs.existsSync(ordrePath)) return res.json({});

  const data = JSON.parse(fs.readFileSync(ordrePath, 'utf8'));
  res.json(data[date] || {});
});

// ✅ Suppression d'une maison
app.post('/api/supprimer-maison', (req, res) => {
  const { nom } = req.body;

  const maison = db.get('maisons').find({ nom }).value();

  if (!maison) {
    return res.status(404).json({ message: "Maison non trouvée." });
  }

  db.get('maisons').remove({ nom }).write();

  res.status(200).json({ message: "Maison supprimée avec succès." });
});
// ✅ Lancement du serveur
app.listen(port, () => {
  console.log(`🟢 Serveur démarré sur http://localhost:${port}`);
});

app.post('/api/assigner-employe', (req, res) => {
  const { id, employe } = req.body;
  const dataDir = path.join(__dirname, 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('planning-'));
  let found = false;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const index = events.findIndex(ev => ev.id === id);
    if (index !== -1) {
      events[index].employe = employe;
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
      found = true;
      break;
    }
  }

  if (found) {
    res.status(200).json({ message: "Employé assigné avec succès." });
  } else {
    res.status(404).json({ error: "Événement non trouvé." });
  }
});

app.post('/api/assigner-couleur', (req, res) => {
  const { id, etat } = req.body;
  const dataDir = path.join(__dirname, 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('planning-'));
  let found = false;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const index = events.findIndex(ev => ev.id === id);
    if (index !== -1) {
      events[index].done = etat;
      fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
      found = true;
      break;
    }
  }

  if (found) {
    res.status(200).json({ message: "État de la case sauvegardé." });
  } else {
    res.status(404).json({ error: "Événement non trouvé." });
  }
});
