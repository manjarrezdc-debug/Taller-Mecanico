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
  // Procesamos la subida de fotos e inventario firmado
  upload.fields([
    { name: 'fotos', maxCount: 10 },
    { name: 'formato_firmado', maxCount: 1 }
  ])(req, res, async function (err) {
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

      // Obtener ruta del formato firmado si se subió
      let formatoFirmadoRuta = null;
      if (req.files && req.files['formato_firmado'] && req.files['formato_firmado'].length > 0) {
        formatoFirmadoRuta = '/uploads/' + req.files['formato_firmado'][0].filename;
      }

      // 2. Insertar Inventario (incluyendo formato firmado)
      const fechaIngreso = new Date().toISOString();
      await dbRun(
        `INSERT INTO recepcion_inventario (vehiculo_id, nivel_combustible, estado_espejos, estado_antena, estado_stereo, estado_cristal, estado_copas, notas_estado_general, fecha_ingreso, formato_firmado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehiculoId, nivel_combustible, estado_espejos, estado_antena, estado_stereo, estado_cristal, estado_copas, notas_estado_general, fechaIngreso, formatoFirmadoRuta]
      );

      // 3. Insertar Fotografías
      const fotosArr = req.files && req.files['fotos'] ? req.files['fotos'] : [];
      if (fotosArr.length > 0) {
        for (const file of fotosArr) {
          const relativePath = '/uploads/' + file.filename;
          await dbRun(
            `INSERT INTO fotografias (vehiculo_id, ruta_archivo) VALUES (?, ?)`,
            [vehiculoId, relativePath]
          );
        }
      }

      res.status(201).json({ success: true, message: 'Vehículo registrado correctamente.', vehiculoId });
    } catch (error) {
      // Si hay error en base de datos, eliminamos todos los archivos subidos para no dejar basura
      cleanupUploadedFiles(req.files);
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'La placa o el Número de Serie de Motor (VIN) ya se encuentran registrados.' });
      }
      res.status(500).json({ error: 'Error del servidor al registrar el vehículo: ' + error.message });
    }
  });
});

// 3.5. Subir formato de recepción firmado a un vehículo ya registrado (Carga posterior)
app.post('/api/vehiculos/:id/formato-firmado', requireAuth, (req, res) => {
  const vehiculoId = req.params.id;
  
  upload.single('formato_firmado')(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha seleccionado ningún archivo.' });
    }

    const relativePath = '/uploads/' + req.file.filename;

    try {
      // Verificar que el vehículo existe
      const vehiculo = await dbGet('SELECT id FROM vehiculos WHERE id = ?', [vehiculoId]);
      if (!vehiculo) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Vehículo no encontrado.' });
      }

      // Obtener el formato firmado anterior para borrarlo físicamente
      const inventario = await dbGet('SELECT formato_firmado FROM recepcion_inventario WHERE vehiculo_id = ?', [vehiculoId]);
      if (inventario && inventario.formato_firmado) {
        const oldPath = path.join(__dirname, '..', 'public', inventario.formato_firmado);
        if (fs.existsSync(oldPath)) {
          fs.unlink(oldPath, (unlinkErr) => {
            if (unlinkErr) console.error('Error al borrar formato firmado antiguo:', oldPath, unlinkErr);
          });
        }
      }

      // Actualizar en base de datos
      await dbRun(
        'UPDATE recepcion_inventario SET formato_firmado = ? WHERE vehiculo_id = ?',
        [relativePath, vehiculoId]
      );

      res.json({ success: true, message: 'Formato firmado subido correctamente.', ruta: relativePath });
    } catch (error) {
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Error al borrar archivo huérfano:', req.file.path, unlinkErr);
        });
      }
      res.status(500).json({ error: 'Error del servidor al guardar el formato firmado.' });
    }
  });
});

// Función de limpieza de archivos en caso de error (sostiene arreglos u objetos de Multer fields)
function cleanupUploadedFiles(files) {
  if (!files) return;
  
  let fileList = [];
  if (Array.isArray(files)) {
    fileList = files;
  } else if (typeof files === 'object') {
    Object.keys(files).forEach(field => {
      if (Array.isArray(files[field])) {
        fileList = fileList.concat(files[field]);
      }
    });
  }
  
  if (fileList.length > 0) {
    fileList.forEach(file => {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error al borrar archivo huérfano:', file.path, unlinkErr);
      });
    });
  }
}

// 4. Crear nueva orden de reparación
app.post('/api/vehiculos/:id/ordenes', requireAuth, async (req, res) => {
  const vehiculoId = req.params.id;
  const { descripcion_reparacion, diagnostico, costo, mecanico_asignado, estado_orden, fecha_entrega } = req.body;

  if (!descripcion_reparacion) {
    return res.status(400).json({ error: 'La descripción de la reparación es obligatoria.' });
  }

  try {
    const vehiculo = await dbGet('SELECT id FROM vehiculos WHERE id = ?', [vehiculoId]);
    if (!vehiculo) {
      return res.status(404).json({ error: 'Vehículo no encontrado.' });
    }

    // Validar costo si se envía
    let costoValor = 0;
    if (costo !== undefined && costo !== null && costo !== '') {
      const parsed = parseFloat(costo);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'El costo debe ser un número válido.' });
      }
      costoValor = parsed;
    }

    // Validar y asignar valores por defecto
    const estado = estado_orden && ['Abierta', 'Finalizada'].includes(estado_orden) ? estado_orden : 'Abierta';
    const fecha = fecha_entrega ? fecha_entrega : null;
    await dbRun(
      `INSERT INTO ordenes_historial (vehiculo_id, descripcion_reparacion, diagnostico, costo, mecanico_asignado, estado_orden, fecha_entrega)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vehiculoId, descripcion_reparacion, diagnostico || null, costoValor, mecanico_asignado, estado, fecha]
    );

    res.status(201).json({ success: true, message: 'Orden creada correctamente.' });
  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({ error: 'Error interno al crear la orden de reparación.', details: error.message });
  }
});

// 5. Modificar estado u orden de reparación
app.put('/api/ordenes/:id', requireAuth, async (req, res) => {
  const ordenId = req.params.id;
  const { estado_orden, diagnostico } = req.body;

  if (!estado_orden || !['Abierta', 'Finalizada'].includes(estado_orden)) {
    return res.status(400).json({ error: 'Estado de orden inválido. Debe ser Abierta o Finalizada.' });
  }
  // Si se intenta finalizar, el diagnóstico es obligatorio
  if (estado_orden === 'Finalizada' && (!diagnostico || diagnostico.trim() === '')) {
    return res.status(400).json({ error: 'Diagnóstico obligatorio al finalizar la orden.' });
  }

  try {
    const result = await dbRun(
      'UPDATE ordenes_historial SET estado_orden = ?, diagnostico = COALESCE(?, diagnostico) WHERE id = ?',
      [estado_orden, diagnostico, ordenId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada.' });
    }

    res.json({ success: true, message: 'Orden actualizada correctamente.' });
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
