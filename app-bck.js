const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const BASE_DIR = path.join(__dirname, 'data', 'clients');

// 🔐 Middleware de vérification licence + client
app.use((req, res, next) => {
  const client = req.headers['x-client-id'];
  const licence = req.headers['x-licence-key'];

  if (!client || !licence) return res.status(401).json({ error: 'Client ou licence manquants' });

  const licencePath = path.join(BASE_DIR, client, 'licence.json');
  if (!fs.existsSync(licencePath)) return res.status(403).json({ error: 'Client inconnu' });

  const data = fs.readJSONSync(licencePath);
  if (data.key !== licence) return res.status(403).json({ error: 'Licence invalide' });

  req.client = client;
  req.clientPath = path.join(BASE_DIR, client);
  next();
});

// 📅 PLANNING PAR MAISON
app.get('/api/planning/:maison', (req, res) => {
  const file = path.join(req.clientPath, `planning-${req.params.maison}.json`);
  if (!fs.existsSync(file)) return res.json([]);
  res.json(fs.readJSONSync(file));
});

app.post('/api/planning/:maison', (req, res) => {
  const file = path.join(req.clientPath, `planning-${req.params.maison}.json`);
  fs.writeJSONSync(file, req.body, { spaces: 2 });
  res.json({ success: true });
});

// 🏠 MAISONS
app.get('/api/maisons', (req, res) => {
  const file = path.join(req.clientPath, 'maisons.json');
  if (!fs.existsSync(file)) return res.json([]);
  res.json(fs.readJSONSync(file));
});

app.post('/api/maisons', (req, res) => {
  const file = path.join(req.clientPath, 'maisons.json');
  fs.writeJSONSync(file, req.body, { spaces: 2 });
  res.json({ success: true });
});

app.delete('/api/maisons/:id', (req, res) => {
  const file = path.join(req.clientPath, 'maisons.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Fichier non trouvé' });
  let maisons = fs.readJSONSync(file);
  maisons = maisons.filter(m => m.id !== req.params.id);
  fs.writeJSONSync(file, maisons, { spaces: 2 });
  res.json({ success: true });
});

// 👷 EMPLOYÉS
app.get('/api/employes', (req, res) => {
  const file = path.join(req.clientPath, 'employes.json');
  if (!fs.existsSync(file)) return res.json([]);
  res.json(fs.readJSONSync(file));
});

app.post('/api/employes', (req, res) => {
  const file = path.join(req.clientPath, 'employes.json');
  fs.writeJSONSync(file, req.body, { spaces: 2 });
  res.json({ success: true });
});

// 🔄 ORDRE DES TÂCHES
app.get('/api/ordre-taches', (req, res) => {
  const file = path.join(req.clientPath, 'ordre-taches.json');
  const date = req.query.date;
  if (!fs.existsSync(file)) return res.json({});
  const all = fs.readJSONSync(file);
  res.json(all[date] || {});
});

app.post('/api/sauver-ordre-taches', (req, res) => {
  const file = path.join(req.clientPath, 'ordre-taches.json');
  const { date, employe, ordre } = req.body;
  const all = fs.existsSync(file) ? fs.readJSONSync(file) : {};
  all[date] = all[date] || {};
  all[date][employe] = ordre;
  fs.writeJSONSync(file, all, { spaces: 2 });
  res.json({ success: true });
});

// ✅ DÉMARRAGE
app.listen(PORT, () => {
  console.log(`✅ Serveur API prêt sur http://localhost:${PORT}`);
});
