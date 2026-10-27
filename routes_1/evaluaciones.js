const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { jugador_id, saque, recepcion, ataque, bloqueo, defensa, comentario } = req.body;
    const result = await pool.query(
      `INSERT INTO evaluaciones
       (jugador_id, entrenador_id, fecha, saque, recepcion, ataque, bloqueo, defensa, comentario)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [jugador_id, req.usuario.id, saque, recepcion, ataque, bloqueo, defensa, comentario]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jugador/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM evaluaciones WHERE jugador_id=$1 ORDER BY fecha DESC',
    [req.params.id]
  );
  res.json(result.rows);
});

module.exports = router;