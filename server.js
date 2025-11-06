import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5500';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' });

// Sécurité + logs
app.use(helmet());
app.use(morgan('dev'));

// CORS
app.use(cors({
  origin: [FRONTEND_BASE_URL, 'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true
}));

// JSON
app.use(express.json());

// Produits
app.get('/api/products', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'products.json');
  if (!fs.existsSync(filePath)) return res.json([]);
  const data = fs.readFileSync(filePath, 'utf8');
  res.json(JSON.parse(data));
});

// Stripe Checkout
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items, success_url, cancel_url } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Panier vide' });
    }
    const line_items = items.map(i => ({
      price_data: {
        currency: 'eur',
        product_data: { name: i.name || ('Produit ' + i.id) },
        unit_amount: Math.round(Number(i.price) * 100),
      },
      quantity: Number(i.quantity) || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: success_url || (FRONTEND_BASE_URL + '/success.html'),
      cancel_url: cancel_url || (FRONTEND_BASE_URL + '/cancel.html')
    });

    res.json({ id: session.id, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur création session' });
  }
});

// Webhook (optionnel)
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur http://localhost:${PORT}`);
  console.log(`Autorise: ${FRONTEND_BASE_URL}`);
});
