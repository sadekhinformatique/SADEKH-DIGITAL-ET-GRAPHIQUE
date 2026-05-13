import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, AuthRequest } from '../auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO categories (id, name, description) VALUES ($1, $2, $3)', [id, name, description || '']);
    res.json({ id, name, description: description || '' });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    await pool.query('UPDATE categories SET name = $1, description = $2 WHERE id = $3', [name, description || '', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
