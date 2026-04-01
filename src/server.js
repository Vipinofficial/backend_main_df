import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3100,http://localhost:3200,http://localhost:3300,http://localhost:3400,http://localhost:3500,http://localhost:3600,http://localhost:3700')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const authJwtSecret = process.env.AUTH_JWT_SECRET || 'change-me-in-production';
const authCookieName = process.env.AUTH_COOKIE_NAME || 'sso_token';
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;
const authCookieSecure = process.env.AUTH_COOKIE_SECURE === 'true';
const authCookieSameSite = process.env.AUTH_COOKIE_SAMESITE || (authCookieSecure ? 'none' : 'lax');
const authCookieMaxAgeMs = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);
const authTokenTtl = process.env.AUTH_TOKEN_TTL || '7d';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

function setAuthCookie(response, user) {
  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
    },
    authJwtSecret,
    { expiresIn: authTokenTtl },
  );

  response.cookie(authCookieName, token, {
    httpOnly: true,
    secure: authCookieSecure,
    sameSite: authCookieSameSite,
    domain: authCookieDomain,
    maxAge: authCookieMaxAgeMs,
    path: '/',
  });
}

function clearAuthCookie(response) {
  response.clearCookie(authCookieName, {
    httpOnly: true,
    secure: authCookieSecure,
    sameSite: authCookieSameSite,
    domain: authCookieDomain,
    path: '/',
  });
}

function readAuthUser(request) {
  const token = request.cookies?.[authCookieName];

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, authJwtSecret);
    if (typeof payload !== 'object' || !payload?.sub) {
      return null;
    }

    return {
      id: payload.sub,
      name: String(payload.name || ''),
      email: String(payload.email || ''),
    };
  } catch {
    return null;
  }
}

function formatUser(mongoUser) {
  if (!mongoUser) return null;
  return {
    id: mongoUser._id.toString(),
    name: mongoUser.name,
    email: mongoUser.email,
  };
}

app.get('/api/health', async (_req, res) => {
  const db = await getDb();
  const userCount = await db.collection('users').countDocuments();
  res.json({ ok: true, userCount });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDb();
  const existingUser = await db.collection('users').findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection('users').insertOne({
    name: String(name).trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    created_at: new Date(),
  });

  return res.status(201).json({ message: 'Account created successfully.' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDb();
  const user = await db.collection('users').findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isValid = await bcrypt.compare(String(password), user.password_hash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const sessionUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };

  setAuthCookie(res, sessionUser);

  return res.json({
    message: 'Login successful.',
    user: sessionUser,
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = readAuthUser(req);

  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  res.json({ user });
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out.' });
});

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
