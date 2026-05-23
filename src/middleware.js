const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurar que la carpeta de subidas existe
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware de Autenticación
function requireAuth(req, res, next) {
  if (req.session && req.session.usuarioId) {
    return next();
  }
  
  // Si es una petición de API, responder con JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }
  
  // De lo contrario, redirigir o permitir el flujo de SPA (manejado en frontend)
  next();
}

// Validación de Número de Serie del Motor (VIN - 17 caracteres alfanuméricos)
function validateVin(req, res, next) {
  const vin = req.body.numero_serie_motor;
  
  if (!vin) {
    return res.status(400).json({ error: 'El Número de Serie del Motor es obligatorio.' });
  }
  
  // Expresión regular: alfanumérico y exactamente 17 caracteres
  const vinRegex = /^[A-Za-z0-9]{17}$/;
  if (!vinRegex.test(vin)) {
    return res.status(400).json({ error: 'El Número de Serie del Motor debe ser alfanumérico y de exactamente 17 caracteres (formato VIN).' });
  }
  
  next();
}

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'vehiculo-' + uniqueSuffix + ext);
  }
});

// Filtro de archivos para permitir solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG y WEBP.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB por imagen
  }
});

module.exports = {
  requireAuth,
  validateVin,
  upload
};
