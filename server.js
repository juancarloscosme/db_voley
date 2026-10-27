const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(require('cors')());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/clases', require('./routes/clases'));
app.use('/api/evaluaciones', require('./routes/evaluaciones'));

// Ruta raíz → sirve el login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏐 Servidor Vóley activo en puerto ${PORT}`);
});