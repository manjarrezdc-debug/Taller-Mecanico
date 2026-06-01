const db = require('../src/db');

function clearTables() {
  const tables = ['vehiculos', 'recepcion_inventario', 'ordenes_historial', 'fotografias'];
  db.serialize(() => {
    tables.forEach(table => {
      db.run(`DELETE FROM ${table};`, err => {
        if (err) console.error(`Error cleaning ${table}:`, err.message);
        else console.log(`All records removed from ${table}`);
      });
    });
  });
}

clearTables();
