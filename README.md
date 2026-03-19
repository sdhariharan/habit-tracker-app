# ◈ FLUX — Dynamic Habit & Task Tracker

A real-time, mobile-first habit and task tracker with glassmorphism UI, Firebase Firestore backend, and Chart.js visualizations.

---

## 📁 File Structure

```
/project
  /frontend
    index.html      ← App shell + modals
    style.css       ← Dark glassmorphism theme
    app.js          ← Firebase logic + charts + UI
  /backend
    server.js       ← Express static server
    firebase.js     ← Admin SDK (optional, server-side)
  package.json
  .gitignore
  README.md
```

---

## 🔥 Step 1 — Firebase Setup

### 1.1 Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → name it (e.g. `flux-tracker`) → Create
3. Disable Google Analytics if you don't need it

### 1.2 Enable Firestore
1. In your project, go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development) → Select region → Done

### 1.3 Enable Anonymous Authentication
1. Go to **Build → Authentication → Sign-in method**
2. Enable **Anonymous** → Save

### 1.4 Register a Web App
1. Go to **Project Overview → Add app → Web (</> icon)**
2. Give it a name (e.g. `flux-web`)
3. Copy the `firebaseConfig` object shown

### 1.5 Paste Config into app.js
Open `frontend/app.js` and replace the placeholder config:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### 1.6 Set Firestore Security Rules
In **Firestore → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

This ensures each user can only access their own tasks.

---

## 🚀 Step 2 — Run Locally

### 2.1 Install Node.js
Download from [https://nodejs.org](https://nodejs.org) (v18+)

### 2.2 Install dependencies
```bash
cd project
npm install
```

### 2.3 Start the server
```bash
npm start
```

Or for auto-restart on file changes (development):
```bash
npm run dev
```

### 2.4 Open in browser
```
http://localhost:3000
```

Works on mobile too — find your local IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux) and open `http://YOUR_IP:3000` on your phone (must be on same WiFi).

---

## 📱 Features

| Feature | Description |
|---|---|
| Add Task | Tap the **+** button, type your task, press Enter or Add |
| Complete Task | Tap any task to toggle completion |
| Delete Task | Hover/long-press → tap **✕** |
| Daily Stats | See added/done count + circular progress ring |
| Filter | All / Pending / Done filters |
| Monthly Chart | Line chart — last 30 days completion consistency |
| Yearly Chart | Bar chart — month-by-month performance |
| Streak | 🔥 counter for consecutive active days |
| Real-time | Changes sync instantly across devices |
| Anonymous Auth | Each browser gets isolated data automatically |

---

## 🔒 Security Notes

- Never commit `serviceAccountKey.json` to Git
- Set Firestore Rules before going to production (see Step 1.6)
- For production, use environment variables for secrets

---

## 🌐 Deployment (Optional)

### Deploy to Render.com (free)
1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variable: `PORT=10000`

### Deploy frontend only to Netlify (free)
1. Drag `/frontend` folder to [netlify.com/drop](https://netlify.com/drop)
2. Done — no backend needed since Firebase handles everything

---

## 🎨 Customization

- **Accent color**: Change `--accent: #ffb900` in `style.css`
- **Font**: Swap Syne/DM Sans imports in `index.html`
- **Chart colors**: Edit `CHART_DEFAULTS` object in `app.js`
