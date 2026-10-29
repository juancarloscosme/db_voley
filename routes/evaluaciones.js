const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Crear evaluación
router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { jugador_id, saque, recepcion, ataque, bloqueo, defensa, comentario } = req.body;
    const [result] = await pool.query(
      `INSERT INTO evaluaciones
       (jugador_id, entrenador_id, fecha, saque, recepcion, ataque, bloqueo, defensa, comentario)
       VALUES (?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?)`,
      [jugador_id, req.usuario.id, saque, recepcion, ataque, bloqueo, defensa, comentario]
    );
    const [rows] = await pool.query('SELECT * FROM evaluaciones WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ver evaluaciones de un jugador
router.get('/jugador/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM evaluaciones WHERE jugador_id = ? ORDER BY fecha DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;