# GAMAX-CM – Site e-commerce (Stripe)

Projet complet prêt à l'emploi : frontend (HTML/CSS/JS) + backend Node.js (Express) + paiement Stripe Checkout.

## 🚀 Démarrage rapide (local)

1) Installer les dépendances :
```bash
npm install
```

2) Copier `.env.example` en `.env` et renseigner vos clés :
```bash
cp .env.example .env
```
- `STRIPE_SECRET_KEY` (clé secrète)
- `STRIPE_PUBLISHABLE_KEY` (clé publique)
- `STRIPE_WEBHOOK_SECRET` (facultatif pour tester le webhook)
- `FRONTEND_BASE_URL` (par défaut `http://localhost:5500`)

3) Lancer un serveur statique pour le frontend (par ex. VSCode Live Server ou):
```bash
npx http-server public -p 5500
```

4) Lancer le backend :
```bash
npm run dev
```

5) Ouvrir `http://localhost:5500` puis cliquer sur **Payer**.

## 🔌 Webhook (optionnel, recommandé)
Pour tester la confirmation commande côté serveur :
```bash
stripe login
stripe listen --forward-to localhost:3000/webhook
```
Copiez le `Signing secret` dans `STRIPE_WEBHOOK_SECRET`.

## 📁 Structure
```
gamax-cm-site/
├── data/
│   └── products.json
├── public/
│   ├── assets/
│   │   └── logo.png   (remplacer par votre logo)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── success.html
│   └── cancel.html
├── .env.example
├── package.json
├── server.js
├── render.yaml
├── Dockerfile
├── netlify.toml
├── vercel.json
└── README.md
```

## 🔒 Sécurité
- Ne jamais exposer `STRIPE_SECRET_KEY` côté client.
- Activer HTTPS et un domaine pour la prod.
- Configurer les origines CORS autorisées.

## ☁️ Déploiement (Render + Netlify)
- Backend : Render (Web Service). Variables : `STRIPE_*`, `FRONTEND_BASE_URL`, `PORT=3000`.
- Frontend : Netlify. Éditez `public/config.json` avec l'URL de l'API.
