const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/Emir/Desktop/Taller Mecanico/database.sqlite');
db.run(`INSERT INTO ordenes_historial (vehiculo_id, descripcion_reparacion, diagnostico, costo, mecanico_asignado, estado_orden, fecha_entrega) VALUES (1, 'Reparación prueba', 'Diagnóstico completado', 100, 'Mecánico 1', 'Finalizada', '2026-06-01')`, function(err) {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Registro insertado');
  }
  db.close();
});
