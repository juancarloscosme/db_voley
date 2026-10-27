const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Listar clases (todos)
router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, u.nombre AS entrenador
     FROM clases c LEFT JOIN usuarios u ON c.entrenador_id=u.id
     ORDER BY c.dia_semana, c.hora_inicio`
  );
  res.json(result.rows);
});

// Crear clase
router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { nombre, categoria, dia_semana, hora_inicio, hora_fin, cancha } = req.body;
    const result = await pool.query(
      `INSERT INTO clases (nombre, categoria, entrenador_id, dia_semana, hora_inicio, hora_fin, cancha)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, categoria, req.usuario.id, dia_semana, hora_inicio, hora_fin, cancha]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar asistencia
router.post('/:clase_id/asistencia', permitirRoles('admin', 'entrenador'), async (req, res) => {
  const { jugador_id, presente, observacion } = req.body;
  const result = await pool.query(
    `INSERT INTO asistencias (clase_id, jugador_id, fecha, presente, observacion)
     VALUES ($1,$2,CURRENT_DATE,$3,$4) RETURNING *`,
    [req.params.clase_id, jugador_id, presente, observacion]
  );
  res.json(result.rows[0]);
});

// Ver asistencia de una clase
router.get('/:clase_id/asistencia', permitirRoles('admin', 'entrenador'), async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, u.nombre AS jugador FROM asistencias a
     JOIN jugadores j ON a.jugador_id=j.id
     JOIN usuarios u ON j.usuario_id=u.id
     WHERE a.clase_id=$1 ORDER BY a.fecha DESC`,
    [req.params.clase_id]
  );
  res.json(result.rows);
});

module.exports = router;