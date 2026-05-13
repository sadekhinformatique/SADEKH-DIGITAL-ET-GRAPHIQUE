import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, AuthRequest } from '../auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = $1', ['global']);
    if (result.rows.length === 0) {
      return res.json({
        id: 'global',
        shop_name: 'SADEKH DIGITAL ET GRAPHIQUE',
        whatsapp_number: '221770000000',
        description: "L'expertise créative au service de votre réussite commerciale.",
        email: 'contact@sadekh.com',
        address: 'Dakar, Sénégal',
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { shop_name, logo, description, phone_number, whatsapp_number, email, address, facebook, instagram, tiktok, youtube, website } = req.body;
    await pool.query(
      `INSERT INTO settings (id, shop_name, logo, description, phone_number, whatsapp_number, email, address, facebook, instagram, tiktok, youtube, website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         shop_name = EXCLUDED.shop_name,
         logo = EXCLUDED.logo,
         description = EXCLUDED.description,
         phone_number = EXCLUDED.phone_number,
         whatsapp_number = EXCLUDED.whatsapp_number,
         email = EXCLUDED.email,
         address = EXCLUDED.address,
         facebook = EXCLUDED.facebook,
         instagram = EXCLUDED.instagram,
         tiktok = EXCLUDED.tiktok,
         youtube = EXCLUDED.youtube,
         website = EXCLUDED.website`,
      ['global', shop_name, logo, description, phone_number, whatsapp_number, email, address, facebook, instagram, tiktok, youtube, website]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
