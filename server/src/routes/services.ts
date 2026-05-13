import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, AuthRequest } from '../auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO services (id, name, description, price, category, image, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, description, price, category || null, image || '', new Date().toISOString()]
    );
    res.json({ id, name, description, price, category, image: image || '', created_at: new Date().toISOString() });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    await pool.query(
      'UPDATE services SET name=$1, description=$2, price=$3, category=$4, image=$5 WHERE id=$6',
      [name, description, price, category || null, image || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
