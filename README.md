# Admin — Life With Yash

Standalone private admin dashboard for the **Life With Yash** personal website.

## Architecture

```
Browser
  │
  ▼
admin-life-withyash/frontend  (React + Vite)
  │
  ▼
admin-life-withyash/backend   (Node + Express)
  │
  ▼
MongoDB Atlas
```

The admin app connects to the **same MongoDB database** as the public website, using the same collection names and document shapes. It does **not** call the backend in `life-withyash`.

The original `yashbhoomkar/life-withyash` repository is not modified by this project.

## What it manages

The dashboard reads and writes:

- Section names
- Spotify playlists
- Movie dialogues
- Car/gallery photos stored as MongoDB binary data
- Visitor messages
- Website visit counter

The public site can continue using its existing backend. Changes made here are immediately visible to the public site because both applications use the same MongoDB database.

## Security

The MongoDB connection string is used **only by the admin backend**.

Never put `MONGODB_URI` or `ADMIN_PASSWORD_HASH` in the frontend environment.

Admin login uses the same scrypt password-hash format and HMAC-signed bearer-token approach as the existing website. To use the same credentials, copy the corresponding values from the existing backend environment into the new admin backend environment.

## Local setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Set these values in `backend/.env`:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=personalwebsite
ADMIN_USERNAME=ybhoomkar
ADMIN_PASSWORD_HASH=scrypt:...
ADMIN_TOKEN_SECRET=replace-with-a-long-random-secret
ADMIN_CORS_ORIGIN=http://localhost:5173
PORT=5002
```

Generate a password hash:

```bash
npm run hash-password -- "your-admin-password"
```

Copy the printed `scrypt:...` value to `ADMIN_PASSWORD_HASH`.

Start the API:

```bash
npm run dev
```

Health check:

```
http://localhost:5002/api/health
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open:

```
http://localhost:5173
```

For a separately deployed frontend, set `VITE_API_BASE_URL` to the public URL of the admin backend.

## Deployment

Deploy the two directories independently:

**Backend:** deploy `backend` as a Node/Express service and set the backend environment variables from `backend/.env.example`.

**Frontend:** deploy `frontend` as a Vite static site and set `VITE_API_BASE_URL` to the backend service URL.

For the backend CORS setting, replace the local origin with the deployed admin frontend origin.

## MongoDB collections

The admin backend intentionally uses the collection shapes already present in `life-withyash`:

- `sections`
- `playlists`
- `dialogues`
- `visitorMessages`
- `carPhotos`
- `visitCounters`

No migration is required.

## Operational notes

Photo uploads are resized in the browser to an optimized full image (max 2400px on the longest side) and thumbnail (max 640px), then stored in the existing `CarPhoto` document format.

The admin API does not seed, delete, or recreate the database. It only creates/updates/deletes records explicitly requested by the dashboard.

## Project structure

```
admin-life-withyash/
├── backend/
│   ├── scripts/
│   │   └── hash-password.js
│   ├── src/
│   │   ├── models.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   └── package.json
└── README.md
```
