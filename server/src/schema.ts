import pool from './db.js';

const createTables = async () => {
  const client = await pool.connect();
  try {
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
    console.log('Tables created successfully');
  } finally {
    client.release();
  }
};

export default createTables;
