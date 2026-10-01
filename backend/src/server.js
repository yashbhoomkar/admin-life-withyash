import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { CarPhoto, Dialogue, Playlist, Section, VisitorMessage, VisitCounter } from './models.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5002);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'personalwebsite';
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

const configuredOrigins = (process.env.ADMIN_CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by the admin API.'));
  },
}));
app.use(express.json({ limit: '100kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 2, fields: 12 },
});

const loginAttempts = new Map();

const encode = (value) => Buffer.from(value).toString('base64url');

function signToken(payload) {
  const body = encode(JSON.stringify(payload));
  const secret = process.env.ADMIN_TOKEN_SECRET;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

function verifyToken(token) {
  if (!token || !process.env.ADMIN_TOKEN_SECRET || !process.env.ADMIN_USERNAME) return false;

  const [body, signature] = token.split('.');
  if (!body || !signature) return false;

  const expected = createHmac('sha256', process.env.ADMIN_TOKEN_SECRET).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.username === process.env.ADMIN_USERNAME && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(request, response, next) {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) return response.status(401).json({ error: 'Unauthorized.' });
  return next();
}

function slugify(value, fallback) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

function serializePhoto(photo) {
  return {
    slug: photo.slug,
    name: photo.name,
    order: photo.order,
    thumbnailWidth: photo.thumbnail?.width,
    thumbnailHeight: photo.thumbnail?.height,
    fullWidth: photo.full?.width,
    fullHeight: photo.full?.height,
    thumbnailUrl: `/api/media/${encodeURIComponent(photo.slug)}/thumbnail`,
    fullUrl: `/api/media/${encodeURIComponent(photo.slug)}/full`,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
  };
}

function serializeContent({ playlists, dialogues, photos, sections }) {
  return {
    playlists: playlists.map(({ slug, title, embedUrl, order, createdAt, updatedAt }) => ({ slug, title, embedUrl, order, createdAt, updatedAt })),
    dialogues: dialogues.map(({ _id, text, order, createdAt, updatedAt }) => ({
      id: _id.toString(), text, order, createdAt, updatedAt,
    })),
    photos: photos.map(serializePhoto),
    sections,
  };
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'connecting',
    database: databaseName,
  });
});

app.post('/api/admin/login', (request, response) => {
  const now = Date.now();
  const ip = request.ip;
  const attempts = (loginAttempts.get(ip) || []).filter((time) => now - time < 15 * 60 * 1000);

  if (attempts.length >= 5) {
    return response.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const username = typeof request.body?.username === 'string' ? request.body.username : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const [scheme, salt, hash] = (process.env.ADMIN_PASSWORD_HASH || '').split(':');

  let valid = false;
  if (scheme === 'scrypt' && salt && hash && process.env.ADMIN_USERNAME && process.env.ADMIN_TOKEN_SECRET) {
    const expected = Buffer.from(hash, 'hex');
    const derived = scryptSync(password, salt, expected.length);
    valid = username === process.env.ADMIN_USERNAME
      && derived.length === expected.length
      && timingSafeEqual(derived, expected);
  }

  if (!valid) {
    attempts.push(now);
    loginAttempts.set(ip, attempts);
    return response.status(401).json({ error: 'Invalid username or password.' });
  }

  loginAttempts.delete(ip);
  return response.json({
    token: signToken({
      username,
      exp: now + 12 * 60 * 60 * 1000,
    }),
  });
});

app.get('/api/admin/dashboard', requireAdmin, async (_request, response, next) => {
  try {
    const [playlists, dialogues, photos, sections, messages, visitorCounter] = await Promise.all([
      Playlist.find().sort({ order: 1 }).lean(),
      Dialogue.find().sort({ order: 1 }).lean(),
      CarPhoto.find().sort({ order: 1 }).select('slug name order thumbnail full createdAt updatedAt').lean(),
      Section.find().sort({ order: 1 }).lean(),
      VisitorMessage.find().sort({ createdAt: -1 }).limit(100).lean(),
      VisitCounter.findOne({ key: 'website' }).select('count').lean(),
    ]);

    return response.json({
      stats: {
        visits: visitorCounter?.count || 0,
        messages: await VisitorMessage.countDocuments(),
        playlists: playlists.length,
        dialogues: dialogues.length,
        photos: photos.length,
        sections: sections.length,
      },
      content: serializeContent({ playlists, dialogues, photos, sections }),
      messages: messages.map(({ _id, name, message, createdAt }) => ({
        id: _id.toString(), name: name || '', message, createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/messages', requireAdmin, async (_request, response, next) => {
  try {
    const messages = await VisitorMessage.find().sort({ createdAt: -1 }).limit(200).lean();
    return response.json(messages.map(({ _id, name, message, createdAt }) => ({
      id: _id.toString(), name: name || '', message, createdAt,
    })));
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/sections', requireAdmin, async (request, response, next) => {
  try {
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    if (!title || title.length > 60) {
      return response.status(400).json({ error: 'Section name must be 1 to 60 characters.' });
    }

    const key = slugify(title, '');
    if (!key) return response.status(400).json({ error: 'Use a section name with letters or numbers.' });
    if (await Section.exists({ key })) return response.status(409).json({ error: 'A section with that name already exists.' });

    const last = await Section.findOne().sort({ order: -1 }).select('order').lean();
    const section = await Section.create({
      key,
      title,
      order: Number(last?.order ?? -1) + 1,
    });

    return response.status(201).json(section.toObject());
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/admin/sections/:key', requireAdmin, async (request, response, next) => {
  try {
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    if (!title || title.length > 60) {
      return response.status(400).json({ error: 'Section title must be 1 to 60 characters.' });
    }

    const section = await Section.findOneAndUpdate(
      { key: request.params.key },
      { title },
      { returnDocument: 'after', runValidators: true },
    );

    if (!section) return response.sendStatus(404);
    return response.json(section.toObject());
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/playlists', requireAdmin, async (request, response, next) => {
  try {
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    const rawUrl = typeof request.body?.url === 'string' ? request.body.url.trim() : '';

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return response.status(400).json({ error: 'Enter a valid Spotify playlist URL.' });
    }

    const match = parsed.hostname === 'open.spotify.com'
      && parsed.pathname.match(/^\/(?:embed\/)?playlist\/([A-Za-z0-9]+)\/?$/);

    if (!match || !title || title.length > 100) {
      return response.status(400).json({ error: 'Enter a Spotify playlist URL and a title.' });
    }

    const slug = slugify(title, `playlist-${Date.now()}`);
    if (await Playlist.exists({ slug })) {
      return response.status(409).json({ error: 'A playlist with that title already exists.' });
    }

    const playlist = await Playlist.create({
      slug,
      title,
      embedUrl: `https://open.spotify.com/embed/playlist/${match[1]}`,
      order: await Playlist.countDocuments(),
    });

    return response.status(201).json(playlist.toObject());
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/admin/playlists/:slug', requireAdmin, async (request, response, next) => {
  try {
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
    if (!title || title.length > 100) return response.status(400).json({ error: 'Playlist title must be 1 to 100 characters.' });

    const playlist = await Playlist.findOneAndUpdate(
      { slug: request.params.slug },
      { title },
      { returnDocument: 'after', runValidators: true },
    );
    if (!playlist) return response.sendStatus(404);
    return response.json(playlist.toObject());
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/admin/playlists/:slug', requireAdmin, async (request, response, next) => {
  try {
    const deleted = await Playlist.findOneAndDelete({ slug: request.params.slug });
    return deleted ? response.sendStatus(204) : response.sendStatus(404);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/dialogues', requireAdmin, async (request, response, next) => {
  try {
    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
    if (!text || text.length > 1000) return response.status(400).json({ error: 'Dialogue must be 1 to 1000 characters.' });

    const dialogue = await Dialogue.create({
      text,
      order: await Dialogue.countDocuments(),
    });

    return response.status(201).json({
      id: dialogue._id.toString(),
      text: dialogue.text,
      order: dialogue.order,
      createdAt: dialogue.createdAt,
    });
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/admin/dialogues/:id', requireAdmin, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.sendStatus(404);

    const text = typeof request.body?.text === 'string' ? request.body.text.trim() : '';
    if (!text || text.length > 1000) return response.status(400).json({ error: 'Dialogue must be 1 to 1000 characters.' });

    const dialogue = await Dialogue.findByIdAndUpdate(
      request.params.id,
      { text },
      { returnDocument: 'after', runValidators: true },
    );

    if (!dialogue) return response.sendStatus(404);
    return response.json({
      id: dialogue._id.toString(),
      text: dialogue.text,
      order: dialogue.order,
      createdAt: dialogue.createdAt,
      updatedAt: dialogue.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/admin/dialogues/:id', requireAdmin, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.sendStatus(404);
    const deleted = await Dialogue.findByIdAndDelete(request.params.id);
    return deleted ? response.sendStatus(204) : response.sendStatus(404);
  } catch (error) {
    return next(error);
  }
});

app.post(
  '/api/admin/photos',
  requireAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (request, response, next) => {
    try {
      const image = request.files?.image?.[0];
      const thumbnail = request.files?.thumbnail?.[0];
      const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';

      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
      if (
        !image
        || !thumbnail
        || !name
        || name.length > 100
        || !allowed.has(image.mimetype)
        || !allowed.has(thumbnail.mimetype)
      ) {
        return response.status(400).json({ error: 'Provide a name and JPEG, PNG, WebP, or AVIF image files.' });
      }

      const slug = slugify(name, `photo-${Date.now()}`);
      if (await CarPhoto.exists({ slug })) {
        return response.status(409).json({ error: 'A photo with that name already exists.' });
      }

      const imageWidth = Math.max(1, Math.min(20000, Number(request.body?.imageWidth) || 1));
      const imageHeight = Math.max(1, Math.min(20000, Number(request.body?.imageHeight) || 1));
      const thumbnailWidth = Math.max(1, Math.min(20000, Number(request.body?.thumbnailWidth) || 1));
      const thumbnailHeight = Math.max(1, Math.min(20000, Number(request.body?.thumbnailHeight) || 1));

      const photo = await CarPhoto.create({
        slug,
        name,
        order: await CarPhoto.countDocuments(),
        thumbnail: {
          data: thumbnail.buffer,
          contentType: thumbnail.mimetype,
          width: thumbnailWidth,
          height: thumbnailHeight,
        },
        full: {
          data: image.buffer,
          contentType: image.mimetype,
          width: imageWidth,
          height: imageHeight,
        },
      });

      return response.status(201).json(serializePhoto(photo.toObject()));
    } catch (error) {
      return next(error);
    }
  },
);

app.delete('/api/admin/photos/:slug', requireAdmin, async (request, response, next) => {
  try {
    const deleted = await CarPhoto.findOneAndDelete({ slug: request.params.slug });
    return deleted ? response.sendStatus(204) : response.sendStatus(404);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/media/:slug/:variant', async (request, response, next) => {
  try {
    if (!['thumbnail', 'full'].includes(request.params.variant)) return response.sendStatus(404);

    const projection = {
      [`${request.params.variant}.data`]: 1,
      [`${request.params.variant}.contentType`]: 1,
    };

    const photo = await CarPhoto.findOne({ slug: request.params.slug }).select(projection);
    if (!photo) return response.sendStatus(404);

    const image = photo[request.params.variant];
    if (!image?.data) return response.sendStatus(404);

    response.set('Content-Type', image.contentType);
    response.set('Cache-Control', 'public, max-age=3600');
    return response.send(image.data);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError ? 400 : 500;
  return response.status(status).json({
    error: status === 400
      ? 'Upload failed: file too large or too many files.'
      : 'Admin API error.',
  });
});

async function start() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  if (!process.env.ADMIN_PASSWORD_HASH) throw new Error('ADMIN_PASSWORD_HASH is required.');
  if (!process.env.ADMIN_TOKEN_SECRET) throw new Error('ADMIN_TOKEN_SECRET is required.');

  await mongoose.connect(mongoUri, { dbName: databaseName });
  app.listen(port, '0.0.0.0', () => {
    console.log(`Admin API listening on port ${port}`);
    console.log(`MongoDB database: ${databaseName}`);
  });
}

start().catch((error) => {
  console.error('Admin API startup failed:', error.message);
  process.exit(1);
});
