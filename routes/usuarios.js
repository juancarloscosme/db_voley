const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Listar usuarios (solo admin)
router.get('/', permitirRoles('admin'), async (req, res) => {
  try {
    // ELIMINAMOS EL "WHERE activo = 1" PARA QUE TRAIGA A TODOS
    const [rows] = await pool.query(
      'SELECT id, nombre, email, rol, activo, telefono, direccion, dni FROM usuarios ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar rol
router.put('/:id/rol', permitirRoles('admin'), async (req, res) => {
  try {
    const { rol } = req.body;
    await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, req.params.id]);
    const [rows] = await pool.query(
      'SELECT id, nombre, rol FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja (Desactivar) o Reactivar
router.put('/:id/estado', permitirRoles('admin'), async (req, res) => {
  try {
    const { activo } = req.body; // Recibe 1 (activo) o 0 (inactivo)
    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, req.params.id]);
    const [rows] = await pool.query(
      'SELECT id, nombre, activo FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar usuario definitivamente
router.delete('/:id', permitirRoles('admin'), async (req, res) => {
  try {
    // Gracias al ON DELETE CASCADE en tu base de datos, si es jugador 
    // también se borrarán sus pagos y asistencias.
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener lista de jugadores para el select de pagos
// Obtener lista de jugadores
// Obtener lista de jugadores (para pagos, asistencias, etc.)
router.get('/jugadores', async (req, res) => {
  try {
    // Usamos LEFT JOIN para que traiga a los jugadores aunque no tengan usuario de login
    const [rows] = await pool.query(
      `SELECT j.id, COALESCE(u.nombre, j.nombre_completo) AS nombre, j.tutor_id 
       FROM jugadores j 
       LEFT JOIN usuarios u ON j.usuario_id = u.id
       WHERE (u.activo = 1 OR u.id IS NULL)`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const bcrypt = require('bcryptjs'); // Asegúrate de tener esto al inicio del archivo

// Cambiar contraseña de un usuario
router.put('/:id/password', permitirRoles('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Asignar un apoderado (padre) a un jugador
router.put('/:id/tutor', permitirRoles('admin'), async (req, res) => {
  try {
    const { tutor_id } = req.body;
    await pool.query('UPDATE jugadores SET tutor_id = ? WHERE id = ?', [tutor_id, req.params.id]);
    res.json({ mensaje: 'Apoderado asignado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar en routes/usuarios.js
router.put('/:id/editar', permitirRoles('admin'), async (req, res) => {
  try {
    const { nombre, email, telefono, direccion } = req.body;
    await pool.query(
      'UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, direccion = ? WHERE id = ?',
      [nombre, email, telefono, direccion, req.params.id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta para crear un jugador (hijo) sin usuario de login
// Crear hijo (Guardamos la fecha en 'categoria' con un separador)
// Crear hijo
// Crear hijo
router.post('/hijo', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { nombre, telefono, tutor_id, fecha_nacimiento } = req.body; 
    
    // 1. Preparamos la fecha
    const fechaFinal = fecha_nacimiento ? fecha_nacimiento.split('T')[0] : 'Sin fecha';
    
    // 2. Guardamos el nombre y la fecha juntos en el campo nombre_completo
    const nombreConFecha = `${nombre} | ${fechaFinal}`;

    const [result] = await pool.query(
      `INSERT INTO jugadores (nombre_completo, telefono, tutor_id) 
       VALUES (?, ?, ?)`,
      [nombreConFecha, telefono || null, tutor_id]
    );
    
    res.json({ mensaje: 'Hijo registrado correctamente', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener los hijos de un apoderado específico
router.get('/hijos/:tutor_id', permitirRoles('admin', 'entrenador', 'padre'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre_completo, telefono FROM jugadores WHERE tutor_id = ?',
      [req.params.tutor_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Eliminar un hijo (jugador)
router.delete('/hijos/:id', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    await pool.query('DELETE FROM jugadores WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Hijo eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar los datos de un hijo (jugador)
router.put('/hijos/:id', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { nombre_completo, telefono, fecha_nacimiento } = req.body;
    
    // MAGIA: Convertimos cualquier formato a AAAA-MM-DD
    let fechaFormateada = null;
    if (fecha_nacimiento) {
      if (fecha_nacimiento.includes('/')) {
        // Si escribe 15/05/2010, lo convertimos a 2010-05-15
        const partes = fecha_nacimiento.split('/');
        fechaFormateada = `${partes[2]}-${partes[1]}-${partes[0]}`;
      } else {
        // Si escribe 2010-05-15, lo dejamos igual
        fechaFormateada = fecha_nacimiento.split('T')[0];
      }
    }

    await pool.query(
      `UPDATE jugadores SET nombre_completo = ?, telefono = ?, fecha_nacimiento = ? WHERE id = ?`,
      [nombre_completo, telefono || null, fechaFormateada, req.params.id]
    );
    res.json({ mensaje: 'Hijo actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Obtener TODOS los hijos con sus datos (para cumpleaños)
router.get('/todos-hijos', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.id, j.nombre_completo, j.telefono, j.posicion, u.nombre AS nombre_padre, u.telefono AS tel_padre 
       FROM jugadores j 
       LEFT JOIN usuarios u ON j.tutor_id = u.id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;