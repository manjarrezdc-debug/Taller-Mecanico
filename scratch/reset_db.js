const path = require('path');
const dbPath = path.join(__dirname, '..', 'src', 'db.js');
const db = require(dbPath);

// Delete all records from tables except usuarios. Cascades will clean dependent records.
db.serialize(() => {
  db.run('DELETE FROM vehiculos', (err) => {
    if (err) console.error('Error deleting vehiculos:', err);
    else console.log('Deleted all vehiculos (cascades will remove related records).');
  });
  // Optionally clean remaining tables directly (in case cascade disabled)
  db.run('DELETE FROM recepcion_inventario', (err) => {
    if (err) console.error('Error deleting recepcion_inventario:', err);
    else console.log('Deleted recepcion_inventario.');
  });
  db.run('DELETE FROM fotografias', (err) => {
    if (err) console.error('Error deleting fotografias:', err);
    else console.log('Deleted fotografias.');
  });
  db.run('DELETE FROM ordenes_historial', (err) => {
    if (err) console.error('Error deleting ordenes_historial:', err);
    else console.log('Deleted ordenes_historial.');
  });
});

db.close();
