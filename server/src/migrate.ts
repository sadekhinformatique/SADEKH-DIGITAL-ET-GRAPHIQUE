import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import pool from './db.js';
import bcrypt from 'bcryptjs';

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('Creating tables...');
    await client.query(`

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price NUMERIC(12,0) NOT NULL,
        category TEXT REFERENCES categories(id) ON DELETE SET NULL,
        image TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT DEFAULT '',
        total NUMERIC(12,0) NOT NULL,
        status TEXT NOT NULL DEFAULT 'En attente',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        "order" TEXT REFERENCES orders(id) ON DELETE CASCADE,
        service TEXT REFERENCES services(id) ON DELETE SET NULL,
        service_name TEXT DEFAULT '',
        quantity INTEGER NOT NULL,
        price NUMERIC(12,0) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'global',
        shop_name TEXT NOT NULL DEFAULT 'SADEKH DIGITAL ET GRAPHIQUE',
        logo TEXT DEFAULT '',
        description TEXT DEFAULT '',
        phone_number TEXT DEFAULT '',
        whatsapp_number TEXT DEFAULT '221770000000',
        email TEXT DEFAULT 'contact@sadekh.com',
        address TEXT DEFAULT 'Dakar, Sénégal',
        facebook TEXT DEFAULT '',
        instagram TEXT DEFAULT '',
        tiktok TEXT DEFAULT '',
        youtube TEXT DEFAULT '',
        website TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_default_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

    `);
    console.log('Tables created.');

    console.log('Seeding default admin...');
    const adminEmail = process.env.ADMIN_EMAIL || 'djahfarsadekh2015@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    const hash = await bcrypt.hash(adminPassword, 10);

    await client.query(
      `INSERT INTO admin_users (email, password_hash, is_default_admin)
       VALUES ($1, $2, true)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, hash]
    );
    console.log(`Admin user seeded: ${adminEmail}`);

    console.log('Seeding default settings...');
    await client.query(
      `INSERT INTO settings (id, shop_name, whatsapp_number, description, email, address)
       VALUES ('global', 'SADEKH DIGITAL ET GRAPHIQUE', '221770000000', $1, 'contact@sadekh.com', 'Dakar, Sénégal')
       ON CONFLICT (id) DO NOTHING`,
      ["L'expertise créative au service de votre réussite commerciale."]
    );

    console.log('Seeding default categories...');
    const cats = [
      { id: 'cat1', name: 'Identité Visuelle & Graphisme' },
      { id: 'cat2', name: 'Solutions Digitales & E-commerce' },
      { id: 'cat3', name: 'Stratégie de Vente & Conseil' }
    ];
    for (const cat of cats) {
      await client.query(
        'INSERT INTO categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [cat.id, cat.name]
      );
    }

    console.log('Seeding default services...');
    const services = [
      { name: 'Création Logo Professionnel', price: 25000, category: 'cat1', description: 'Un logo unique qui reflète l\'identité de votre marque.' },
      { name: 'Création Site Web Vitrine', price: 150000, category: 'cat2', description: 'Un site web moderne et responsive pour présenter votre activité.' },
      { name: 'Optimisation Boutique Shopify', price: 75000, category: 'cat2', description: 'Améliorez vos conversions avec une boutique optimisée.' },
      { name: 'Tunnel de Vente Complet', price: 100000, category: 'cat3', description: 'Un système automatisé pour transformer vos prospects en clients.' }
    ];
    for (const s of services) {
      const id = crypto.randomUUID();
      await client.query(
        'INSERT INTO services (id, name, description, price, category, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
        [id, s.name, s.description, s.price, s.category, new Date().toISOString()]
      );
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

migrate();
