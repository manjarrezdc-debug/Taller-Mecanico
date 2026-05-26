const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Habilitar claves foráneas
    db.run('PRAGMA foreign_keys = ON;');

    // Tabla: usuarios
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );`);

    // Tabla: vehiculos
    db.run(`CREATE TABLE IF NOT EXISTS vehiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marca TEXT,
      modelo TEXT,
      ano INTEGER,
      color TEXT,
      cilindrada TEXT,
      placa TEXT UNIQUE,
      numero_serie_motor TEXT UNIQUE NOT NULL,
      dueno TEXT,
      telefono TEXT
    );`);

    // Tabla: recepcion_inventario
    db.run(`CREATE TABLE IF NOT EXISTS recepcion_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      nivel_combustible TEXT,
      estado_espejos TEXT,
      estado_antena TEXT,
      estado_stereo TEXT,
      estado_cristal TEXT,
      estado_copas TEXT,
      notas_estado_general TEXT,
      fecha_ingreso TEXT,
      formato_firmado TEXT,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE CASCADE
    );`);

    // Migración: Asegurar que existe la columna formato_firmado si la base de datos ya existía
    db.run(`ALTER TABLE recepcion_inventario ADD COLUMN formato_firmado TEXT;`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
          // Columna ya existente, no se requiere acción
        } else {
          console.error('Error al verificar migración de columna formato_firmado:', err.message);
        }
      } else {
        console.log('Migración exitosa: Columna formato_firmado agregada a recepcion_inventario.');
      }
    });

    // Tabla: ordenes_historial
    db.run(`CREATE TABLE IF NOT EXISTS ordenes_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      descripcion_reparacion TEXT,
      costo REAL,
      mecanico_asignado TEXT,
      estado_orden TEXT CHECK(estado_orden IN ('Abierta', 'Finalizada')) DEFAULT 'Abierta',
      fecha_entrega TEXT,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE CASCADE
    );`);

    // Tabla: fotografias
    db.run(`CREATE TABLE IF NOT EXISTS fotografias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      ruta_archivo TEXT,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos (id) ON DELETE CASCADE
    );`);

    // Seeding del usuario admin si no existe
    db.get('SELECT * FROM usuarios WHERE username = ?', ['admin'], (err, row) => {
      if (err) {
        console.error('Error checking for admin user:', err);
        return;
      }
      if (!row) {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync('taller2026', salt);
        db.run('INSERT INTO usuarios (username, password) VALUES (?, ?)', ['admin', hashedPassword], (err) => {
          if (err) {
            console.error('Error seeding admin user:', err);
          } else {
            console.log('Se ha creado el usuario administrador por defecto (admin / taller2026)');
          }
        });
      } else {
        console.log('El usuario administrador ya existe en la base de datos.');
      }
    });
  });
}

module.exports = db;
