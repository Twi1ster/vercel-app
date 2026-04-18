# EQ Sistemi — Vercel Deploy Təlimatı

## Addım 1 — GitHub-a yüklə

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/SENIN_USERNAME/eq-system.git
git push -u origin main
```

## Addım 2 — Vercel-də yarat

1. https://vercel.com → **New Project**
2. GitHub repo-nu seç (eq-system)
3. **Framework Preset** → `Create React App`
4. **Root Directory** → `.` (dəyişmə)
5. **Environment Variables** əlavə et:
   ```
   MONGO_URI = mongodb+srv://USER:PASS@cluster.mongodb.net/eq_system
   ```
6. **Deploy** düyməsinə bas

## Addım 3 — MongoDB Atlas ayarı

Atlas-da **Network Access** → `0.0.0.0/0` əlavə et  
(Vercel serverless function-ların IP-si dəyişkən olur)

---

## Fayl strukturu

```
vercel-app/
├── api/                    ← Serverless functions (backend)
│   ├── _db.js             ← MongoDB connection (cached)
│   ├── _models.js         ← Mongoose schemas
│   ├── eq.js              ← GET list / POST create
│   ├── eq/
│   │   ├── [id].js        ← PUT update / DELETE
│   │   ├── import.js      ← Excel import
│   │   └── export.js      ← Excel export
│   ├── bank.js
│   ├── bank/
│   │   ├── [id].js
│   │   ├── import.js
│   │   └── export.js
│   ├── stats.js
│   └── reconciliation.js
├── src/                    ← React frontend
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── pages/
│       ├── EQModule.js
│       ├── BankModule.js
│       └── Reconciliation.js
├── public/
│   └── index.html
├── package.json
└── vercel.json
```

## Local test

```bash
npm install
npm install -g vercel
vercel dev
# → http://localhost:3000
```
