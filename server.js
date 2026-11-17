const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(['/server.js', '/package.json', '/package-lock.json', '/database'], (req, res) => {
  res.status(403).send('Acceso denegado');
});
app.use(express.static(__dirname));

const dbConfig = {
  user: 'sa',                 
  password: 'pepelepew1.', 
  server: 'localhost',
  database: 'PetThinksDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

app.post('/api/register', async (req, res) => {
  const { nombre, correo, contrasena, mascota } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('Nombre', sql.VarChar(100), nombre)
      .input('Correo', sql.VarChar(120), correo)
      .input('Contrasena', sql.VarChar(255), hashPassword(contrasena))
      .input('Mascota_Preferida', sql.VarChar(20), mascota)
      .execute('sp_RegistrarUsuario');

    res.json({ ok: true, user: result.recordset[0] });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { correo, contrasena } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('Correo', sql.VarChar(120), correo)
      .input('Contrasena', sql.VarChar(255), hashPassword(contrasena))
      .execute('sp_LoginUsuario');

    if (result.recordset.length === 0) {
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
    }

    const user = result.recordset[0];
    const favs = await pool.request()
      .input('Usuario_ID', sql.Int, user.Usuario_ID)
      .query('SELECT Articulo_ID, Titulo_Ficha FROM FichasFavoritas WHERE Usuario_ID = @Usuario_ID');

    user.favoritos = favs.recordset;
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.put('/api/user/pet', async (req, res) => {
  const { usuarioId, mascota } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('Usuario_ID', sql.Int, usuarioId)
      .input('Mascota_Preferida', sql.VarChar(20), mascota)
      .execute('sp_ActualizarMascota');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/quiz/score', async (req, res) => {
  const { usuarioId, preguntaId, esCorrecta, puntos } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('Usuario_ID', sql.Int, usuarioId)
      .input('Pregunta_ID', sql.Int, preguntaId)
      .input('Es_Correcta', sql.Bit, esCorrecta ? 1 : 0)
      .input('Puntos', sql.Int, puntos)
      .execute('sp_RegistrarRespuestaQuiz');

    res.json({ ok: true, stats: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/favorites/toggle', async (req, res) => {
  const { usuarioId, articuloId, tituloFicha } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('Usuario_ID', sql.Int, usuarioId)
      .input('Articulo_ID', sql.VarChar(20), articuloId)
      .input('Titulo_Ficha', sql.VarChar(150), tituloFicha)
      .execute('sp_ToggleFavorito');

    res.json({ ok: true, estado: result.recordset[0].Estado });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/reports/view', async (req, res) => {
  const { usuarioId, articuloId } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('Usuario_ID', sql.Int, usuarioId || null)
      .input('Articulo_ID', sql.VarChar(20), articuloId)
      .query('INSERT INTO Reportes (Usuario_ID, Articulo_ID, Total_Consultas) VALUES (@Usuario_ID, @Articulo_ID, 1)');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

const os = require('os');
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  const ipActual = getLocalIP();
  console.log('Servidor PetThinks encendido');
  console.log(`PC:        http://localhost:${PORT}`);
  console.log(`Teléfono:    http://${ipActual}:${PORT}`);
});