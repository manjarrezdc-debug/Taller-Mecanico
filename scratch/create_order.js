const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/Emir/Desktop/Taller Mecanico/database.sqlite');

// Datos de la nueva orden
const vehiculoId = 1; // Asume que ya existe un vehículo con ID 1
const descripcion = 'Cambio de frenos';
const diagnostico = 'Desgaste de pastillas';
const costo = 150;
const mecanico = 'Juan Perez';
const estado = 'Abierta'; // Estado inicial
const fechaEntrega = '2026-07-01';

const sql = `INSERT INTO ordenes_historial 
  (vehiculo_id, descripcion_reparacion, diagnostico, costo, mecanico_asignado, estado_orden, fecha_entrega) 
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

db.run(sql, [vehiculoId, descripcion, diagnostico, costo, mecanico, estado, fechaEntrega], function (err) {
  if (err) {
    console.error('Error al insertar la orden:', err.message);
  } else {
    console.log('Orden insertada con ID:', this.lastID);
  }
  db.close();
});
