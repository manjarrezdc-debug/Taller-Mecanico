const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { requireAuth, validateVin, upload } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Sesiones
app.use(session({
  secret: 'taller-beltran-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // false para desarrollo local
    maxAge: 24 * 60 * 60 * 1000 // 1 día
  }
}));

// Parsers para JSON y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Promesas para simplificar consultas SQLite3
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this); // Contiene lastID y changes
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Ruta para servir las imágenes subidas protegidas por autenticación
app.use('/uploads', requireAuth, express.static(path.join(__dirname, '..', 'public', 'uploads')));

// RUTAS DE AUTENTICACIÓN
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  db.get('SELECT * FROM usuarios WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor al buscar usuario.' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Iniciar sesión
    req.session.usuarioId = user.id;
    req.session.username = user.username;
    res.json({ success: true, message: 'Inicio de sesión exitoso.' });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    }
    res.json({ success: true, message: 'Sesión cerrada.' });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.usuarioId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// Endpoint para recibir errores del navegador del cliente (para depuración)
app.post('/api/client-error', (req, res) => {
  console.error('\n=== ERROR DETECTADO EN EL CLIENTE/NAVEGADOR ===');
  console.error('Mensaje:', req.body.message);
  console.error('Origen:', req.body.source);
  console.error('Línea:', req.body.lineno, 'Columna:', req.body.colno);
  console.error('Pila de llamadas (Stack):', req.body.stack);
  console.error('==============================================\n');
  res.json({ success: true });
});

// RUTAS PROTEGIDAS DE NEGOCIO (Requieren Auth)

// 1. Obtener lista de vehículos (con buscador)
app.get('/api/vehiculos', requireAuth, async (req, res) => {
  const search = req.query.search || '';
  try {
    let sql = 'SELECT * FROM vehiculos';
    let params = [];
    
    if (search.trim() !== '') {
      sql += ' WHERE placa LIKE ? OR numero_serie_motor LIKE ? OR dueno LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }
    
    const vehiculos = await dbAll(sql, params);
    res.json(vehiculos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los vehículos.' });
  }
});

// 2. Obtener detalle de un vehículo específico
app.get('/api/vehiculos/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const vehiculo = await dbGet('SELECT * FROM vehiculos WHERE id = ?', [id]);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado.' });
    }

    const inventario = await dbGet('SELECT * FROM recepcion_inventario WHERE vehiculo_id = ?', [id]);
    const fotografias = await dbAll('SELECT * FROM fotografias WHERE vehiculo_id = ?', [id]);
    const ordenes = await dbAll('SELECT * FROM ordenes_historial WHERE vehiculo_id = ? ORDER BY id DESC', [id]);

    res.json({
      vehiculo,
      inventario,
      fotografias,
      ordenes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los detalles del vehículo.' });
  }
});

// 3. Registrar vehículo + Inventario de entrada + Subida de imágenes (Multer)
app.post('/api/vehiculos', requireAuth, (req, res) => {
  // Procesamos la subida de fotos primero
  upload.array('fotos', 10)(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Ejecutar validación del VIN manualmente sobre el body ya parseado por Multer
    const vin = req.body.numero_serie_motor;
    if (!vin) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'El Número de Serie del Motor es obligatorio.' });
    }
    const vinRegex = /^[A-Za-z0-9]{17}$/;
    if (!vinRegex.test(vin)) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'El Número de Serie del Motor debe ser alfanumérico y de exactamente 17 caracteres (formato VIN).' });
    }

    // Extraer datos del body
    const {
      marca, modelo, ano, color, cilindrada, placa, dueno, telefono,
      nivel_combustible, estado_espejos, estado_antena, estado_stereo, estado_cristal, estado_copas, notas_estado_general
    } = req.body;

    try {
      // 1. Insertar Vehículo
      const vehiculoRes = await dbRun(
        `INSERT INTO vehiculos (marca, modelo, ano, color, cilindrada, placa, numero_serie_motor, dueno, telefono)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [marca, modelo, ano ? parseInt(ano) : null, color, cilindrada, placa, vin, dueno, telefono]
      );
      const vehiculoId = vehiculoRes.lastID;

      // 2. Insertar Inventario
      const fechaIngreso = new Date().toISOString();
      await dbRun(
        `INSERT INTO recepcion_inventario (vehiculo_id, nivel_combustible, estado_espejos, estado_antena, estado_stereo, estado_cristal, estado_copas, notas_estado_general, fecha_ingreso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehiculoId, nivel_combustible, estado_espejos, estado_antena, estado_stereo, estado_cristal, estado_copas, notas_estado_general, fechaIngreso]
      );

      // 3. Insertar Fotografías
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const relativePath = '/uploads/' + file.filename;
          await dbRun(
            `INSERT INTO fotografias (vehiculo_id, ruta_archivo) VALUES (?, ?)`,
            [vehiculoId, relativePath]
          );
        }
      }

      res.status(201).json({ success: true, message: 'Vehículo registrado correctamente.', vehiculoId });
    } catch (error) {
      // Si hay error en base de datos (ej: placa o VIN duplicado), eliminamos las imágenes para no dejar basura
      cleanupUploadedFiles(req.files);
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'La placa o el Número de Serie de Motor (VIN) ya se encuentran registrados.' });
      }
      res.status(500).json({ error: 'Error del servidor al registrar el vehículo: ' + error.message });
    }
  });
});

// Función de limpieza de archivos en caso de error
function cleanupUploadedFiles(files) {
  if (files && files.length > 0) {
    files.forEach(file => {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error al borrar archivo huérfano:', file.path, unlinkErr);
      });
    });
  }
}

// 4. Crear nueva orden de reparación
app.post('/api/vehiculos/:id/ordenes', requireAuth, async (req, res) => {
  const vehiculoId = req.params.id;
  const { descripcion_reparacion, costo, mecanico_asignado, estado_orden, fecha_entrega } = req.body;

  if (!descripcion_reparacion) {
    return res.status(400).json({ error: 'La descripción de la reparación es obligatoria.' });
  }

  try {
    const vehiculo = await dbGet('SELECT id FROM vehiculos WHERE id = ?', [vehiculoId]);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado.' });
    }

    await dbRun(
      `INSERT INTO ordenes_historial (vehiculo_id, descripcion_reparacion, costo, mecanico_asignado, estado_orden, fecha_entrega)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vehiculoId, descripcion_reparacion, costo ? parseFloat(costo) : 0, mecanico_asignado, estado_orden || 'Abierta', fecha_entrega]
    );

    res.status(201).json({ success: true, message: 'Orden creada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la orden de reparación.' });
  }
});

// 5. Modificar estado u orden de reparación
app.put('/api/ordenes/:id', requireAuth, async (req, res) => {
  const ordenId = req.params.id;
  const { estado_orden } = req.body;

  if (!estado_orden || !['Abierta', 'Finalizada'].includes(estado_orden)) {
    return res.status(400).json({ error: 'Estado de orden inválido. Debe ser Abierta o Finalizada.' });
  }

  try {
    const result = await dbRun(
      'UPDATE ordenes_historial SET estado_orden = ? WHERE id = ?',
      [estado_orden, ordenId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada.' });
    }

    res.json({ success: true, message: 'Estado de la orden actualizado.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la orden.' });
  }
});

// Servir archivos estáticos del frontend en general
app.use(express.static(path.join(__dirname, '..', 'public')));

// Servir el index.html para cualquier otra ruta (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de Taller Beltrán corriendo en http://localhost:${PORT}`);
});
