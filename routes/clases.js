const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Listar clases
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.nombre AS entrenador
       FROM clases c
       LEFT JOIN usuarios u ON c.entrenador_id = u.id
       ORDER BY c.dia_semana, c.hora_inicio`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear clase
router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { nombre, categoria, dia_semana, hora_inicio, hora_fin, cancha } = req.body;
    const [result] = await pool.query(
      `INSERT INTO clases (nombre, categoria, entrenador_id, dia_semana, hora_inicio, hora_fin, cancha)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, categoria, req.usuario.id, dia_semana, hora_inicio, hora_fin, cancha]
    );
    const [rows] = await pool.query('SELECT * FROM clases WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar asistencia
router.post('/:clase_id/asistencia', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { jugador_id, presente, observacion } = req.body;
    const [result] = await pool.query(
      `INSERT INTO asistencias (clase_id, jugador_id, fecha, presente, observacion)
       VALUES (?, ?, CURRENT_DATE, ?, ?)`,
      [req.params.clase_id, jugador_id, presente, observacion]
    );
    const [rows] = await pool.query('SELECT * FROM asistencias WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ver asistencia de una clase
router.get('/:clase_id/asistencia', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, u.nombre AS jugador
       FROM asistencias a
       JOIN jugadores j ON a.jugador_id = j.id
       JOIN usuarios u ON j.usuario_id = u.id
       WHERE a.clase_id = ?
       ORDER BY a.fecha DESC`,
      [req.params.clase_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar clase
router.delete('/:id', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    await pool.query('DELETE FROM clases WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Clase eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar clase (Editar)
router.put('/:id', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { nombre, categoria, dia_semana, hora_inicio, hora_fin, cancha } = req.body;
    await pool.query(
      `UPDATE clases SET nombre=?, categoria=?, dia_semana=?, hora_inicio=?, hora_fin=?, cancha=? WHERE id=?`,
      [nombre, categoria, dia_semana, hora_inicio, hora_fin, cancha, req.params.id]
    );
    res.json({ mensaje: 'Clase actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;