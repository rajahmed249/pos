import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import JSZip from 'jszip';
import nodemailer from 'nodemailer';
import { getStore, nextId, saveStore, type PosStoreData } from './server/posStore.ts';
import { generateMysqlDumpSql } from './server/sqlExporter.ts';
import { parseMysqlDumpText, type SqlRow } from './server/sqlParser.ts';

const PORT = Number(process.env.PORT || 3000);
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 continuous hour of inactivity
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_COOLDOWN_MS = 45 * 1000;
const OTP_HMAC_KEY = process.env.OTP_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_NAME = 'youthit_pos_session';
const SESSIONS_FILE = path.resolve(process.cwd(), 'data/.sessions.json');
const REVOKED_SESSIONS_FILE = path.resolve(process.cwd(), 'data/.revoked-sessions.json');
const activeSessions = new Map<string, { userId: number; expiresAt: number; lastSavedAt?: number }>();
const revokedSessionJtis = new Map<string, number>();

function loadPersistedSessions(): void {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, { userId: number; expiresAt: number }>;
      const now = Date.now();
      for (const [tok, sess] of Object.entries(parsed)) {
        if (tok && sess && Number.isFinite(sess.userId) && Number.isFinite(sess.expiresAt) && sess.expiresAt > now) {
          activeSessions.set(tok, { userId: sess.userId, expiresAt: sess.expiresAt, lastSavedAt: now });
        }
      }
    }
  } catch {
    // ignore corrupt/missing session cache
  }
  try {
    if (fs.existsSync(REVOKED_SESSIONS_FILE)) {
      const raw = fs.readFileSync(REVOKED_SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      for (const [jti, exp] of Object.entries(parsed)) {
        if (jti && Number.isFinite(exp) && exp > now) {
          revokedSessionJtis.set(jti, exp);
        }
      }
    }
  } catch {
    // ignore corrupt/missing revoked cache
  }
}

function savePersistedSessions(): void {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const now = Date.now();
    const out: Record<string, { userId: number; expiresAt: number }> = {};
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.expiresAt > now) {
        out[tok] = { userId: sess.userId, expiresAt: sess.expiresAt };
        sess.lastSavedAt = now;
      } else {
        activeSessions.delete(tok);
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(out), 'utf8');
  } catch {
    // non-fatal if disk write fails
  }
}

function saveRevokedSessions(): void {
  try {
    const dir = path.dirname(REVOKED_SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const now = Date.now();
    const out: Record<string, number> = {};
    for (const [jti, exp] of revokedSessionJtis.entries()) {
      if (exp > now) {
        out[jti] = exp;
      } else {
        revokedSessionJtis.delete(jti);
      }
    }
    fs.writeFileSync(REVOKED_SESSIONS_FILE, JSON.stringify(out), 'utf8');
  } catch {
    // non-fatal
  }
}

loadPersistedSessions();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function isSecureCookieRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  return req.secure || proto.includes('https');
}

function setSessionCookie(req: Request, res: Response, token: string, expiresAt: number): void {
  const maxAgeSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    isSecureCookieRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isSecureCookieRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

const recoveryCodes = new Map<
  number,
  {
    codeHash: string;
    channel: 'email' | 'sms';
    expiresAt: number;
    sentAt: number;
    attempts: number;
    verifiedProofHash?: string;
    verifiedUntil?: number;
  }
>();

type StoreUser = PosStoreData['users'][number];
type AuthedRequest = Request & { authUser?: StoreUser };

function getPublicSettings(store: PosStoreData) {
  return {
    shop_name: store.settings.shop_name || 'YOUTH IT POS',
    shop_logo: store.settings.shop_logo || '/assets/images/logo.jpg',
    shop_favicon: store.settings.shop_favicon || '/assets/images/favicon.png',
    shop_website: store.settings.shop_website || 'www.youthit.com.bd',
  };
}

function deriveUserSessionKey(user: StoreUser): Buffer {
  const baseSecret = process.env.SESSION_SECRET || 'youthit-pos-stable-session-secret-v2';
  return crypto
    .createHash('sha256')
    .update(`${baseSecret}:${user.id}:${user.email.toLowerCase()}:${user.password_hash ?? ''}`)
    .digest();
}

function createSignedSessionToken(
  user: StoreUser,
  jti = crypto.randomBytes(12).toString('hex'),
  now = Date.now()
): { token: string; expiresAt: number; jti: string } {
  const expiresAt = now + IDLE_TIMEOUT_MS;
  const payload = { uid: user.id, iat: now, exp: expiresAt, jti };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', deriveUserSessionKey(user)).update(encoded).digest('hex');
  return { token: `yt1.${encoded}.${sig}`, expiresAt, jti };
}

function parseSignedTokenJti(token: string): { jti: string; exp: number } | null {
  if (!token.startsWith('yt1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      jti?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.jti === 'string' && Number.isFinite(Number(decoded.exp))) {
      return { jti: decoded.jti, exp: Number(decoded.exp) };
    }
  } catch {
    return null;
  }
  return null;
}

function getValidSession(
  req: Request,
  res?: Response
): { token: string; user: StoreUser; expiresAt: number } | null {
  const authHeader = String(req.headers.authorization ?? '');
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    const cookies = parseCookies(req.headers.cookie);
    token = String(cookies[SESSION_COOKIE_NAME] ?? '').trim();
  }
  if (!token) return null;

  const store = getStore();
  const now = Date.now();

  if (token.startsWith('yt1.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, encoded, sigHex] = parts;
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        uid?: unknown;
        iat?: unknown;
        exp?: unknown;
        jti?: unknown;
      };
      const uid = Number(payload.uid);
      const iat = Number(payload.iat);
      const exp = Number(payload.exp);
      const jti = String(payload.jti ?? '');
      if (!Number.isFinite(uid) || !Number.isFinite(iat) || !Number.isFinite(exp) || !jti) {
        return null;
      }
      if (now > exp) return null;
      const revokedExp = revokedSessionJtis.get(jti);
      if (revokedExp && revokedExp > now) return null;

      const user = store.users.find((u) => u.id === uid);
      if (!user || !user.is_active) return null;

      const expectedSig = crypto
        .createHmac('sha256', deriveUserSessionKey(user))
        .update(encoded)
        .digest();
      const providedSig = Buffer.from(sigHex, 'hex');
      if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
        return null;
      }

      // Slide 60-minute continuous inactivity window forward cleanly
      let activeToken = token;
      let activeExpiresAt = exp;
      if (now - iat >= 60_000) {
        const refreshed = createSignedSessionToken(user, jti, now);
        activeToken = refreshed.token;
        activeExpiresAt = refreshed.expiresAt;
        if (res) {
          res.setHeader('X-Refreshed-Token', activeToken);
          setSessionCookie(req, res, activeToken, activeExpiresAt);
        }
      }
      return { token: activeToken, user, expiresAt: activeExpiresAt };
    } catch {
      return null;
    }
  }

  const sess = activeSessions.get(token);
  if (!sess) return null;
  if (now > sess.expiresAt) {
    activeSessions.delete(token);
    savePersistedSessions();
    return null;
  }
  const user = store.users.find((u) => u.id === sess.userId);
  if (!user || !user.is_active) {
    activeSessions.delete(token);
    savePersistedSessions();
    return null;
  }
  // Sliding 1-hour idle timeout + seamless upgrade to signed token
  const upgraded = createSignedSessionToken(user, undefined, now);
  activeSessions.delete(token);
  savePersistedSessions();
  if (res) {
    res.setHeader('X-Refreshed-Token', upgraded.token);
    setSessionCookie(req, res, upgraded.token, upgraded.expiresAt);
  }
  return { token: upgraded.token, user, expiresAt: upgraded.expiresAt };
}

function hasAnyRole(user: StoreUser | undefined, roles: string[]): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return roles.includes(user.role);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hashHex, 'hex');
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function normalizePhoneDigits(phone: unknown): string {
  return String(phone ?? '').replace(/\D/g, '');
}

function sanitizeUser(u: {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  profile_image?: string | null;
  password_hash?: string;
  is_active: boolean;
  created_at: string;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    address: u.address,
    profile_image: u.profile_image || null,
    is_active: u.is_active,
    has_password: Boolean(u.password_hash),
    created_at: u.created_at,
  };
}

function sanitizeSearch(q: unknown): string {
  return String(q ?? '').trim().toLowerCase();
}

function matchesSearchTokens(fields: Array<unknown>, query: string): boolean {
  if (!query) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields
    .map((f) => String(f ?? '').toLowerCase())
    .join(' ');
  return tokens.every((t) => haystack.includes(t));
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'vendor',
  '.git',
  '.aistudio',
  'tmp',
  '.cache',
  '.vite',
]);

function isExcludedFileName(name: string): boolean {
  if (name === '.DS_Store' || name === '.sessions.json' || name === '.revoked-sessions.json') return true;
  if (/^\.env($|\.)/i.test(name) && name !== '.env.example') return true;
  if (/\.log$/i.test(name)) return true;
  return false;
}

function collectFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...collectFiles(path.join(dir, entry.name), baseDir));
    } else if (entry.isFile()) {
      if (isExcludedFileName(entry.name)) continue;
      const full = path.join(dir, entry.name);
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

function buildHostingUploadGuide(): string {
  return `# Youth IT POS — Easy Hosting & Local Setup Guide

## Included Files & Database
- \`database/youthit_pos_database.sql\` (and \`laravel/database/sql/youthits_pos.sql\`): Complete MySQL 8 / MariaDB schema + all live POS data.
- \`data/pos-store.json\`: Live JSON database used by the Node.js + React server.
- \`public/\`: Shop logos, favicon, QR code, and all uploaded product & avatar images.
- \`.env.example\`: Safe environment template (\`.env\` with fresh \`APP_KEY\` is auto-created on first run for Laravel).

---

## Option 1: cPanel Shared Hosting or Local XAMPP / Laragon (\`youthit-pos-laravel-13.zip\`)
1. **Create an empty MySQL Database** (in cPanel -> *MySQL Databases* or locally in *phpMyAdmin*).
2. **Upload & Extract** \`youthit-pos-laravel-13.zip\` into your domain folder (or \`C:\\xampp\\htdocs\\youthit-pos\` / \`C:\\laragon\\www\\youthit-pos\` locally).
3. **Install PHP Vendor Packages** (only if \`vendor/\` folder is not already present):
   \`\`\`bash
   composer install --no-dev --optimize-autoloader
   \`\`\`
4. **Open Your Site in Browser** (e.g. \`https://yourdomain.com\` or \`http://localhost/youthit-pos\`):
   - No manual \`.env\`, \`APP_KEY\`, or SQL import needed!
   - The built-in **1-Click Setup Wizard (\`/setup\`)** opens automatically, creates \`.env\` + \`APP_KEY\`, connects your MySQL database, imports \`youthits_pos.sql\`, sets your admin login password, and redirects to \`/login\`.
5. **Email & SMS Recovery (Optional)**: Update \`MAIL_*\` and \`SMS_*\` inside \`.env\`.

---

## Option 2: Node.js Hosting (VPS / cPanel Setup Node.js App) or Local PC (\`youthit-pos-full-project.zip\`)
Prebuilt \`dist/\` frontend and compiled \`server.js\` are already bundled inside the ZIP!
1. Extract \`youthit-pos-full-project.zip\`.
2. Copy \`.env.example\` to \`.env\` (optional: add \`SMTP_*\` / \`SMS_*\` settings).
3. Install runtime packages and start immediately (Node 18 / 20 / 22+):
   \`\`\`bash
   npm install --omit=dev
   npm start
   \`\`\`
   *(For cPanel Setup Node.js App, set **Application startup file** to \`server.js\`.)*
4. Open \`http://localhost:3000\` (or your domain) in the browser and sign in.
`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const uploadsDir = path.resolve(process.cwd(), 'public/uploads/avatars');
  const productUploadsDir = path.resolve(process.cwd(), 'public/uploads/products');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(productUploadsDir)) {
    fs.mkdirSync(productUploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));

  const publicRootDir = path.resolve(process.cwd(), 'public');
  const PRODUCT_NAME_IMAGE_RULES: Array<[RegExp, string]> = [
    [/ds-2ce70df0t|colorvu.*dome|hikvision.*dome/i, '/uploads/products/1778931608_ds-2ce70df0t-lpfss-01-500x500.webp'],
    [/ds-2ce12df0t|colorvu.*bullet|hikvision.*bullet/i, '/uploads/products/1778931750_Hikvision-DS-2CE12DF0T-FS.jpg'],
    [/ds-7108|hikvision.*(dvr|nvr|xvr)/i, '/uploads/products/1778932443_ds-7108hghi-m1-t-01-500x500.webp'],
    [/ptn-c6|protech.*(cat\s*6|cable|utp)/i, '/uploads/products/1778932161_ptn-c6-cca-in-wh-500x500.webp'],
    [/protech.*balun|black.*balun/i, '/uploads/products/1778932922_ProtechVideoBalun.jpg'],
    [/video\s*balu?n|split\s*joint.*balun/i, '/uploads/products/1774523205_VideoBaloon2.png'],
    [/dtech|fiber\s*optic.*hdmi|10\s*m.*hdmi|hdmi.*10\s*m/i, '/uploads/products/1775656388_DTECH10MeterFiberOpticHDMICable4K3DV2.0.jpeg'],
    [/deco|mesh\s*(wi-?fi|router)/i, '/uploads/products/1786888213_6a81c015a1644.jpg'],
    [/tp-?link|wr840|wr841|wi-?fi\s*router|wireless\s*router/i, '/uploads/products/1775156479_TPLinkRouter-YouthIT.jpg'],
    [/a4\s*tech|optical\s*mouse|wired\s*mouse|\bmouse\b/i, '/uploads/products/1774450128_Mouse-YouthIT.jpg'],
    [/projector.*(lamp|bulb)|lamp.*bulb/i, '/uploads/products/1784115645_6a5771bd2b1f6.jpg'],
    [/\bhp\b.*laptop|\blaptop\b/i, '/uploads/products/1786643697_6a7e04f104f8b.webp'],
    [/toten|rack.*(shelf|tray)|\bshelf\b|\btray\b/i, '/uploads/products/1786712765_6a7f12bd514d4.jpg'],
    [/(compact|small|4u|6u).*(rack|cabinet)|(rack|cabinet).*(4u|6u)/i, '/uploads/products/1786886944_6a81bb205ab7d.webp'],
    [/server\s*rack|network\s*(rack|cabinet)|wall\s*cabinet/i, '/uploads/products/1786712775_6a7f12c7eefe0.jpg'],
    [/onv.*(24|26).*poe|(24|26).*port.*poe/i, '/uploads/products/1786712866_6a7f13221e3cd.jpg'],
    [/onv.*gigabit.*poe|onv.*10.*1000/i, '/uploads/products/1786712826_6a7f12fa7a61f.jpg'],
    [/onv.*poe|10.*port.*poe/i, '/uploads/products/1786888040_6a81bf68722e3.jpg'],
    [/hrui.*poe|managed.*poe/i, '/uploads/products/1786887457_6a81bd213922c.jpg'],
    [/jovision.*(dvr|nvr|xvr)/i, '/uploads/products/1786712921_6a7f1359effd9.jpg'],
    [/jovision.*bullet/i, '/uploads/products/1786712947_6a7f1373e6f91.webp'],
    [/jovision.*(turret|two-?way|audio|mic)/i, '/uploads/products/1787689048_6a8df8588e59b.webp'],
    [/jovision.*dome|jovision.*camera/i, '/uploads/products/1786886564_6a81b9a493b8e.jpg'],
    [/\bmi\b.*(cat-?6|cable|305)/i, '/uploads/products/1786887301_6a81bc8550a80.jpg'],
    [/pixel|pxc-2501|1000ft.*cat/i, '/uploads/products/1786888782_6a81c24e35a8b.png'],
    [/toshiba|s300|6\s*tb|surveillance.*(hdd|hard\s*drive|disk)/i, '/uploads/products/1786887784_6a81be684747c.jpg'],
    [/zkteco|attendance|biometric|fingerprint/i, '/uploads/products/1786888313_6a81c079ebb06.webp'],
    [/keystone/i, '/uploads/products/1787336191_6a8895ffc4340.jpg'],
    [/rj-?45.*connector|modular\s*connector|rj-?45/i, '/uploads/products/1786888496_6a81c1309853e.webp'],
    [/logitech|webcam|web\s*cam/i, '/uploads/products/1787333051_6a8889bba4425.webp'],
    [/d-?link.*(faceplate|face\s*plate|wall|box)|faceplate/i, '/uploads/products/1787333152_6a888a2051d14.webp'],
    [/micro\s*sd|64\s*gb.*card|memory\s*card/i, '/uploads/products/1787335859_6a8894b34c414.jpg'],
    [/ezviz|pan.*tilt.*cam|smart.*wi-?fi.*cam/i, '/uploads/products/1787336060_6a88957c7a07e.webp'],
    [/vico|v-?15|trolley\s*speaker|portable.*speaker/i, '/uploads/products/1787676708_6a8dc824339ef.jpg'],
    [/ahuja.*(ssb|amplifier|amp)/i, '/uploads/products/1787683417_6a8de259d5253.webp'],
    [/ahuja.*(awm|wireless.*mic|microphone)/i, '/uploads/products/1787683865_6a8de419ec586.webp'],
    [/ahuja|column\s*speaker/i, '/uploads/products/1787683069_6a8de0fddd320.webp'],
    [/speaker\s*cable|audio\s*cable/i, '/uploads/products/1787683649_6a8de341673de.jpg'],
  ];

  function resolveProductImage(rawImage: unknown, productName?: unknown): string | null {
    const raw = String(rawImage ?? '').trim();
    if (raw && raw.toLowerCase() !== 'null' && raw.toLowerCase() !== 'undefined') {
      if (raw.startsWith('data:image/') || /^https?:\/\//i.test(raw)) {
        return raw;
      }
      const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
      const directCandidate = normalized.startsWith('public/') ? normalized.slice(7) : normalized;
      if (fs.existsSync(path.join(publicRootDir, directCandidate))) {
        return `/${directCandidate}`;
      }
      const base = path.posix.basename(directCandidate);
      const strippedBase = base.replace(/_[0-9a-f]{8}(\.[^.]+)$/i, '$1');
      if (fs.existsSync(path.join(productUploadsDir, base))) {
        return `/uploads/products/${base}`;
      }
      if (strippedBase !== base && fs.existsSync(path.join(productUploadsDir, strippedBase))) {
        return `/uploads/products/${strippedBase}`;
      }
      if (fs.existsSync(path.join(publicRootDir, 'assets/aistudio', base))) {
        return `/assets/aistudio/${base}`;
      }
    }

    const name = String(productName ?? '').trim();
    if (name) {
      for (const [pattern, imgPath] of PRODUCT_NAME_IMAGE_RULES) {
        if (pattern.test(name)) {
          return imgPath;
        }
      }
    }

    if (raw && raw.toLowerCase() !== 'null' && raw.toLowerCase() !== 'undefined') {
      const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
      return normalized.includes('/') ? `/${normalized}` : `/uploads/products/${normalized}`;
    }
    return null;
  }

  // Initialize store on boot so real SQL data is ready immediately
  getStore();

  // ---- Centralized API Auth & Role Enforcement ----
  const PUBLIC_API_PATHS = new Set([
    '/auth/session',
    '/auth/login',
    '/auth/request-recovery-code',
    '/auth/verify-recovery-code',
    '/auth/recover-password',
    '/auth/logout',
  ]);

  app.use('/api', (req: AuthedRequest, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    if (PUBLIC_API_PATHS.has(req.path)) {
      next();
      return;
    }

    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.status(401).json({
        error: 'Authentication required. Please sign in or re-authenticate after inactivity.',
      });
      return;
    }

    req.authUser = session.user;

    const adminOnlyPrefixes = ['/settings', '/backup', '/laravel'];
    const isAdminOnly =
      adminOnlyPrefixes.some((p) => req.path.startsWith(p)) ||
      (req.path.startsWith('/menus') && req.method !== 'GET') ||
      (req.path.startsWith('/users') && (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') && !req.path.endsWith('/avatar'));

    if (isAdminOnly && !hasAnyRole(session.user, ['admin'])) {
      res.status(403).json({ error: 'Administrator permission required for this action.' });
      return;
    }

    const managerPrefixes = [
      '/owners',
      '/cashbook',
      '/accounts',
      '/expenses',
      '/purchases',
      '/suppliers',
      '/employees',
      '/returns',
      '/damages',
      '/reports',
    ];
    const isManagerArea =
      managerPrefixes.some((p) => req.path.startsWith(p)) ||
      (req.path.startsWith('/sales/') && req.method === 'DELETE');

    if (isManagerArea && !hasAnyRole(session.user, ['admin', 'manager'])) {
      res.status(403).json({ error: 'Manager or Administrator permission required for this module.' });
      return;
    }

    next();
  });

  function buildBootstrapPayload(store: PosStoreData, authUser?: StoreUser) {
    const todayStr = new Date().toISOString().slice(0, 10);

    let todaySales = 0;
    let todayProfit = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let customerDue = 0;

    for (const sale of store.sales) {
      if (String(sale.status ?? 'completed') !== 'completed') continue;
      const rec = Number(sale.receivable ?? 0);
      const prof = Number(sale.profit ?? 0);
      const due = Number(sale.due ?? 0);
      totalRevenue += rec;
      totalProfit += prof;
      customerDue += due;
      if (String(sale.date ?? '').startsWith(todayStr)) {
        todaySales += rec;
        todayProfit += prof;
      }
    }

    let supplierDue = 0;
    for (const pur of store.purchases) {
      supplierDue += Number(pur.due ?? 0);
    }

    let totalExpenses = 0;
    for (const exp of store.expenses) {
      totalExpenses += Number(exp.amount ?? 0);
    }

    const activeProducts = store.products.filter((p) => Number(p.status ?? 1) === 1);
    let stockCostValue = 0;
    let stockRetailValue = 0;
    for (const p of activeProducts) {
      const qty = Math.max(0, Number(p.quantity ?? 0));
      stockCostValue += qty * Number(p.purchase_price ?? 0);
      stockRetailValue += qty * Number(p.selling_price ?? 0);
    }

    const lowStock = activeProducts
      .filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5))
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 10)
      .map((p) => ({
        ...p,
        image: resolveProductImage(p.image, p.name),
      }));

    const recentSales = [...store.sales]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .slice(0, 10);

    // Monthly revenue trend (last 6 months in dataset)
    const monthTotals: Record<string, { month: string; revenue: number; profit: number; count: number }> = {};
    for (const s of store.sales) {
      if (String(s.status ?? 'completed') !== 'completed') continue;
      const m = String(s.date ?? '').slice(0, 7);
      if (!m) continue;
      if (!monthTotals[m]) {
        monthTotals[m] = { month: m, revenue: 0, profit: 0, count: 0 };
      }
      monthTotals[m].revenue += Number(s.receivable ?? 0);
      monthTotals[m].profit += Number(s.profit ?? 0);
      monthTotals[m].count += 1;
    }
    const monthlyTrend = Object.values(monthTotals)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    return {
      settings: store.settings,
      menus: [...store.menus].sort((a, b) => a.sort_order - b.sort_order),
      users: hasAnyRole(authUser, ['admin'])
        ? store.users.map(sanitizeUser)
        : authUser
          ? [sanitizeUser(authUser)]
          : [],
      categories: store.categories,
      brands: store.brands,
      units: store.units,
      warranties: store.warranties,
      bankAccounts: store.bank_accounts,
      expenseCategories: store.expense_categories,
      metrics: {
        todaySales,
        todayProfit,
        totalRevenue,
        totalProfit,
        customerDue,
        supplierDue,
        totalExpenses,
        productCount: activeProducts.length,
        customerCount: store.customers.length,
        supplierCount: store.suppliers.length,
        saleCount: store.sales.length,
        purchaseCount: store.purchases.length,
        stockCostValue,
        stockRetailValue,
      },
      lowStock,
      recentSales,
      monthlyTrend,
    };
  }

  // ---- Bootstrap & Dashboard ----
  app.get('/api/bootstrap', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    res.json(buildBootstrapPayload(store, req.authUser));
  });

  // ---- Products ----
  app.get('/api/products', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
    const lowStockOnly = req.query.low_stock === '1';
    const includeInactive = req.query.include_inactive === '1';
    const fetchAll = req.query.all === '1';
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll
      ? Math.max(1, store.products.length)
      : Math.min(10000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));

    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const brandMap = new Map(store.brands.map((b) => [Number(b.id), String(b.name ?? '')]));
    const unitMap = new Map(store.units.map((u) => [Number(u.id), String(u.name ?? '')]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.duration ?? w.name ?? '')]));

    let items = includeInactive
      ? [...store.products]
      : store.products.filter((p) => Number(p.status ?? 1) === 1);
    if (q) {
      items = items.filter((p) => {
        const catName = catMap.get(Number(p.category_id)) ?? '';
        const brandName = brandMap.get(Number(p.brand_id)) ?? '';
        const wName = String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || '');
        return matchesSearchTokens(
          [p.name, p.sku, p.barcode, catName, brandName, wName, p.selling_price],
          q
        );
      });
    }
    if (categoryId) items = items.filter((p) => Number(p.category_id) === categoryId);
    if (brandId) items = items.filter((p) => Number(p.brand_id) === brandId);
    if (lowStockOnly) items = items.filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));

    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    const sliced = (fetchAll ? items : items.slice((page - 1) * limit, page * limit)).map((p) => ({
      ...p,
      image: resolveProductImage(p.image, p.name),
      warranty: String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || 'No Warranty'),
      category_name: catMap.get(Number(p.category_id)) ?? 'Uncategorized',
      brand_name: brandMap.get(Number(p.brand_id)) ?? 'No Brand',
      unit_name: unitMap.get(Number(p.unit_id)) ?? 'PC',
    }));

    res.json({ items: sliced, total, page, limit });
  });

  function saveProductImageFromDataUrl(dataUrl: unknown): string | null {
    const raw = String(dataUrl ?? '');
    if (!raw) return null;
    const match = raw.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return null;
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength > 2 * 1024 * 1024) return null;
    const fileName = `prod-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
    fs.writeFileSync(path.join(productUploadsDir, fileName), buffer);
    return `/uploads/products/${fileName}`;
  }

  app.post('/api/products', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    const purchasePrice = Number(body.purchase_price ?? 0);
    const sellingPrice = Number(body.selling_price ?? 0);
    const rawQty = Number(body.quantity ?? 0);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      res.status(400).json({ error: 'Purchase price and selling price must be 0 or greater.' });
      return;
    }
    if (!Number.isFinite(rawQty) || rawQty < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative.' });
      return;
    }
    const qty = Math.round(rawQty);
    const warrantyId = body.warranty_id ? Number(body.warranty_id) : null;
    const matchedWarranty = warrantyId
      ? store.warranties.find((w) => Number(w.id) === warrantyId)
      : null;
    const warrantyText =
      String(body.warranty ?? '').trim() ||
      String(matchedWarranty?.duration ?? matchedWarranty?.name ?? 'No Warranty');
    const savedImagePath = saveProductImageFromDataUrl(body.image_data);
    const rawWarrantyMonths = Number(body.warranty_months ?? 0);
    const rawAlertQty = Number(body.alert_quantity ?? 5);
    const newProduct = {
      id: nextId(store.products),
      name: String(body.name).trim(),
      sku: String(body.sku ?? '').trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category_id: body.category_id ? Number(body.category_id) : null,
      brand_id: body.brand_id ? Number(body.brand_id) : null,
      warranty_id: warrantyId,
      unit_id: body.unit_id ? Number(body.unit_id) : (Number(store.units[0]?.id ?? 4)),
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      warranty_months: Number.isFinite(rawWarrantyMonths) && rawWarrantyMonths >= 0 ? Math.round(rawWarrantyMonths) : 0,
      quantity: qty,
      stock_quantity: qty,
      alert_quantity: Number.isFinite(rawAlertQty) && rawAlertQty >= 0 ? Math.round(rawAlertQty) : 5,
      description: String(body.description ?? ''),
      barcode: String(body.barcode ?? ''),
      image: savedImagePath,
      status: 1,
      warranty: warrantyText,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.products.unshift(newProduct);
    saveStore(store);
    res.status(201).json(newProduct);
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        res.status(400).json({ error: 'Product name cannot be empty.' });
        return;
      }
      product.name = String(body.name).trim();
    }
    if (body.purchase_price !== undefined) {
      const pp = Number(body.purchase_price);
      if (!Number.isFinite(pp) || pp < 0) {
        res.status(400).json({ error: 'Purchase price cannot be negative.' });
        return;
      }
      product.purchase_price = pp;
    }
    if (body.selling_price !== undefined) {
      const sp = Number(body.selling_price);
      if (!Number.isFinite(sp) || sp < 0) {
        res.status(400).json({ error: 'Selling price cannot be negative.' });
        return;
      }
      product.selling_price = sp;
    }
    if (body.quantity !== undefined) {
      const parsedQ = Number(body.quantity);
      if (!Number.isFinite(parsedQ) || parsedQ < 0) {
        res.status(400).json({ error: 'Quantity must be 0 or greater.' });
        return;
      }
      const q = Math.round(parsedQ);
      product.quantity = q;
      product.stock_quantity = q;
    }
    if (body.sku !== undefined) product.sku = String(body.sku).trim();
    if (body.barcode !== undefined) product.barcode = String(body.barcode).trim();
    if (body.description !== undefined) product.description = String(body.description);
    if (body.category_id !== undefined) product.category_id = body.category_id ? Number(body.category_id) : null;
    if (body.brand_id !== undefined) product.brand_id = body.brand_id ? Number(body.brand_id) : null;
    if (body.unit_id !== undefined) product.unit_id = body.unit_id ? Number(body.unit_id) : null;
    if (body.warranty_id !== undefined) {
      const wId = body.warranty_id ? Number(body.warranty_id) : null;
      product.warranty_id = wId;
      const matchedW = wId ? store.warranties.find((w) => Number(w.id) === wId) : null;
      if (matchedW) {
        product.warranty = String(matchedW.duration ?? matchedW.name ?? 'No Warranty');
      } else if (body.warranty === undefined) {
        product.warranty = 'No Warranty';
      }
    }
    if (body.warranty !== undefined) product.warranty = String(body.warranty || 'No Warranty');
    if (body.alert_quantity !== undefined) {
      const parsedAlert = Number(body.alert_quantity);
      if (!Number.isFinite(parsedAlert) || parsedAlert < 0) {
        res.status(400).json({ error: 'Alert quantity must be 0 or greater.' });
        return;
      }
      product.alert_quantity = Math.round(parsedAlert);
    }
    if (body.image_data) {
      const savedPath = saveProductImageFromDataUrl(body.image_data);
      if (savedPath) product.image = savedPath;
    } else if (body.remove_image) {
      product.image = null;
    }
    saveStore(store);
    res.json(product);
  });

  app.post('/api/products/:id/adjust', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const rawQty = Number(req.body?.new_quantity ?? req.body?.quantity);
    if (!Number.isFinite(rawQty) || rawQty < 0) {
      res.status(400).json({ error: 'Valid non-negative stock quantity is required.' });
      return;
    }
    const newQty = Math.round(rawQty);
    const oldQty = Number(product.quantity ?? 0);
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: id,
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: newQty - oldQty,
      reason: String(req.body?.reason ?? '').trim() || 'Manual Stock Adjustment',
      created_by: req.authUser?.id ?? 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    saveStore(store);
    res.json(product);
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    product.status = 0;
    saveStore(store);
    res.json({ ok: true });
  });

  app.patch('/api/products/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    product.status = Number(product.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(product);
  });

  // ---- Catalog (Categories, Brands, Units, Warranties) ----
  app.post('/api/catalog/:kind', (req: Request, res: Response) => {
    const store = getStore();
    const kind = req.params.kind;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (kind === 'categories') {
      const row = { id: nextId(store.categories), name, description: String(req.body?.description ?? ''), status: 1, created_at: now };
      store.categories.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'brands') {
      const row = { id: nextId(store.brands), name, status: 1, created_at: now };
      store.brands.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'units') {
      const row = { id: nextId(store.units), name, description: String(req.body?.description ?? ''), status: 1, created_at: now };
      store.units.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'warranties') {
      const row = { id: nextId(store.warranties), name, duration: String(req.body?.duration ?? name), status: 1, created_at: now };
      store.warranties.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    res.status(400).json({ error: 'Unknown catalog type.' });
  });

  app.delete('/api/catalog/:kind/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const kind = req.params.kind;
    if (kind === 'categories') store.categories = store.categories.filter((r) => Number(r.id) !== id);
    else if (kind === 'brands') store.brands = store.brands.filter((r) => Number(r.id) !== id);
    else if (kind === 'units') store.units = store.units.filter((r) => Number(r.id) !== id);
    else if (kind === 'warranties') store.warranties = store.warranties.filter((r) => Number(r.id) !== id);
    else {
      res.status(400).json({ error: 'Unknown catalog type.' });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Sales & POS Checkout ----
  app.get('/api/sales', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const paymentStatus = String(req.query.payment_status ?? '');
    const fetchAll = req.query.all === '1';
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 10);
    const limit = fetchAll
      ? Math.max(1, store.sales.length)
      : Math.min(5000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));

    const custPhoneMap = new Map(store.customers.map((c) => [Number(c.id), String(c.phone ?? '')]));
    const custNameMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? '')]));
    const productNameMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? '')]));
    const saleItemsMap = new Map<number, Array<{ product_name: string; quantity: number }>>();
    for (const it of store.sale_items) {
      const sid = Number(it.sale_id);
      const arr = saleItemsMap.get(sid) ?? [];
      const resolvedName = String(it.product_name || productNameMap.get(Number(it.product_id)) || 'Product');
      arr.push({
        product_name: resolvedName,
        quantity: Number(it.quantity ?? 1),
      });
      saleItemsMap.set(sid, arr);
    }

    let items: Array<Record<string, unknown>> = store.sales.map((s) => {
      const sid = Number(s.id);
      const cid = Number(s.customer_id ?? 0);
      const prods = saleItemsMap.get(sid) ?? [];
      return {
        ...s,
        customer_name: String(s.customer_name || (cid ? custNameMap.get(cid) : '') || 'Walk-in Customer'),
        customer_phone: cid ? (custPhoneMap.get(cid) ?? '') : '',
        products: prods,
      };
    });

    if (q) {
      items = items.filter((s) => {
        const prods = (s.products as Array<{ product_name: string }>) ?? [];
        return matchesSearchTokens(
          [s.invoice_no, s.customer_name, s.customer_phone, ...prods.map((p) => p.product_name)],
          q
        );
      });
    }
    if (paymentStatus) {
      items = items.filter((s) => String(s.payment_status ?? '') === paymentStatus);
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit,
    });
  });

  app.get('/api/sales/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const productMap = new Map(store.products.map((p) => [Number(p.id), p]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.name || w.duration || '')]));

    const items = store.sale_items
      .filter((it) => Number(it.sale_id) === id)
      .map((it) => {
        const prod = it.product_id ? productMap.get(Number(it.product_id)) : undefined;
        const resolvedCat =
          it.category_name ||
          (prod?.category_id ? catMap.get(Number(prod.category_id)) : '') ||
          'Electronics';
        const resolvedWarranty =
          String(
            it.warranty ||
            it.warranty_name ||
            prod?.warranty ||
            (prod?.warranty_id ? warrantyMap.get(Number(prod.warranty_id)) : '') ||
            ''
          );
        return {
          ...it,
          product_name: String(it.product_name || prod?.name || 'Product'),
          category_name: String(resolvedCat),
          warranty: resolvedWarranty,
          serial_no: it.serial_no || it.serial_number || null,
        };
      });

    const payments = store.payments.filter((p) => Number(p.sale_id) === id);
    const customer = sale.customer_id ? store.customers.find((c) => Number(c.id) === Number(sale.customer_id)) : null;
    const customerOpening = Number(customer?.opening_balance ?? 0);
    const saleDue = Number(sale.due ?? 0);
    const otherSalesDue = sale.customer_id
      ? store.sales
          .filter((s) => Number(s.customer_id) === Number(sale.customer_id) && Number(s.id) !== id)
          .reduce((sum, s) => sum + Number(s.due ?? 0), 0)
      : 0;
    const previous_due = Math.max(Math.max(0, customerOpening - saleDue), otherSalesDue);

    const creatorId = Number(sale.created_by ?? sale.user_id ?? 1);
    const creator = store.users.find((u) => Number(u.id) === creatorId);
    const sold_by = String(creator?.name ?? 'Youth IT');

    res.json({
      sale: {
        ...sale,
        customer_name: String(sale.customer_name || customer?.name || 'Walk-in Customer'),
        customer_phone: String(customer?.phone ?? sale.customer_phone ?? ''),
        customer_address: String(customer?.address ?? ''),
        previous_due,
        sold_by,
      },
      items,
      payments,
      customer,
    });
  });

  app.post('/api/sales', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (itemsInput.length === 0) {
      res.status(400).json({ error: 'At least one line item is required.' });
      return;
    }

    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const rawAccId = Number(body.account_id);
    const accountId = Number.isFinite(rawAccId) && rawAccId > 0 ? rawAccId : Number(store.bank_accounts[0]?.id ?? 0);
    const account = (accountId ? store.bank_accounts.find((a) => Number(a.id) === accountId) : undefined) ?? store.bank_accounts[0];
    const customerId = body.customer_id ? Number(body.customer_id) : null;
    const customer = customerId ? store.customers.find((c) => Number(c.id) === customerId) : null;

    let subtotal = 0;
    let totalCost = 0;
    const prepared: Array<{
      product: (typeof store.products)[number];
      qty: number;
      price: number;
      lineTotal: number;
      lineCost: number;
      serialNo: string;
      warranty: string;
    }> = [];

    const requestedQtyMap = new Map<number, number>();
    for (const raw of itemsInput) {
      const product = store.products.find((p) => Number(p.id) === Number(raw.product_id));
      if (!product) {
        res.status(400).json({ error: `Product #${raw.product_id} not found.` });
        return;
      }
      const qty = Math.round(Number(raw.quantity ?? 0));
      if (!Number.isFinite(qty) || qty < 1) {
        res.status(400).json({ error: `Invalid quantity for "${product.name}". Quantity must be at least 1.` });
        return;
      }
      const price = Number(raw.price ?? product.selling_price ?? 0);
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: `Invalid unit price for "${product.name}".` });
        return;
      }
      const cumulativeQty = (requestedQtyMap.get(Number(product.id)) ?? 0) + qty;
      const availableStock = Number(product.quantity ?? 0);
      if (cumulativeQty > availableStock) {
        res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${cumulativeQty}.`,
        });
        return;
      }
      requestedQtyMap.set(Number(product.id), cumulativeQty);

      const lineTotal = qty * price;
      const lineCost = qty * Number(product.purchase_price ?? 0);
      subtotal += lineTotal;
      totalCost += lineCost;
      prepared.push({
        product,
        qty,
        price,
        lineTotal,
        lineCost,
        serialNo: String(raw.serial_no ?? ''),
        warranty: String(raw.warranty ?? product.warranty ?? 'No Warranty'),
      });
    }

    const discount = Number(body.discount ?? 0);
    const vat = Number(body.vat ?? 0);
    if (!Number.isFinite(discount) || discount < 0) {
      res.status(400).json({ error: 'Discount must be 0 or greater.' });
      return;
    }
    if (discount > subtotal + 0.009) {
      res.status(400).json({ error: `Discount cannot exceed Subtotal (${subtotal.toFixed(2)}).` });
      return;
    }
    if (!Number.isFinite(vat) || vat < 0) {
      res.status(400).json({ error: 'VAT / Tax must be 0 or greater.' });
      return;
    }

    const receivable = Math.max(0, subtotal - discount + vat);
    const rawPaid = body.paid !== undefined && body.paid !== '' ? Number(body.paid) : receivable;
    if (!Number.isFinite(rawPaid) || rawPaid < 0) {
      res.status(400).json({ error: 'Received amount must be 0 or greater.' });
      return;
    }
    const paid = Math.min(receivable, rawPaid);
    const due = Math.max(0, receivable - paid);
    const profit = receivable - totalCost;

    const isWalkIn =
      !customer || String(customer.name ?? '').trim().toLowerCase() === 'walk-in customer';
    if (isWalkIn && due > 0.009) {
      res.status(400).json({
        error: 'Walk-in Customer cannot have due balance! Please collect full payment or select a registered customer.',
      });
      return;
    }

    const saleId = nextId(store.sales);
    const nowIso = new Date().toISOString();
    const dateStr = body.sale_date ? String(body.sale_date).slice(0, 10) : nowIso.slice(0, 10);
    const dateTimeStr = `${dateStr} ${nowIso.slice(11, 19)}`;
    const invoiceNo = `INV-${dateStr.replace(/-/g, '')}-${String(saleId).padStart(4, '0')}`;
    const paymentMethod = String(body.payment_method ?? (account ? String(account.account_name).toLowerCase() : 'cash'));
    const saleNote = String(body.note ?? '');

    const sale = {
      id: saleId,
      invoice_no: invoiceNo,
      customer_id: customer ? Number(customer.id) : null,
      customer_name: customer ? String(customer.name) : (String(body.customer_name ?? '').trim() || 'Walk-in Customer'),
      date: dateStr,
      discount,
      vat,
      receivable,
      paid,
      due,
      purchase_cost: totalCost,
      profit,
      status: 'completed',
      created_at: dateTimeStr,
      sale_date: dateTimeStr,
      subtotal,
      account_id: account ? Number(account.id) : null,
      account_name: account ? String(account.account_name) : paymentMethod,
      payment_method: paymentMethod,
      note: saleNote,
      payment_status: due <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'due'),
      created_by: req.authUser?.id ?? 1,
    };
    store.sales.unshift(sale);

    const createdItems = [];
    for (const p of prepared) {
      const sItem = {
        id: nextId(store.sale_items),
        product_id: Number(p.product.id),
        sale_id: saleId,
        product_name: String(p.product.name),
        category_name: catMap.get(Number(p.product.category_id)) ?? null,
        quantity: p.qty,
        price: p.price,
        total: p.lineTotal,
        purchase_cost: p.lineCost,
        serial_no: p.serialNo || null,
        warranty: p.warranty,
        buying_price: Number(p.product.purchase_price ?? 0),
        warranty_id: p.product.warranty_id ?? null,
        warranty_name: p.warranty,
      };
      store.sale_items.push(sItem);
      createdItems.push(sItem);

      const oldQty = Number(p.product.quantity ?? 0);
      const newQty = Math.max(0, oldQty - p.qty);
      p.product.quantity = newQty;
      p.product.stock_quantity = newQty;

      store.stock_movements.unshift({
        id: nextId(store.stock_movements),
        product_id: Number(p.product.id),
        old_quantity: oldQty,
        new_quantity: newQty,
        difference: -p.qty,
        reason: `POS Sale ${invoiceNo}`,
        created_by: req.authUser?.id ?? 1,
        created_at: dateTimeStr,
      });
    }

    if (paid > 0) {
      store.payments.unshift({
        id: nextId(store.payments),
        sale_id: saleId,
        customer_id: customer ? Number(customer.id) : null,
        amount: paid,
        payment_date: dateTimeStr,
        payment_method: account ? String(account.account_name).toLowerCase() : 'cash',
        reference_no: null,
        note: 'POS Checkout',
        created_by: req.authUser?.id ?? 1,
        created_at: dateTimeStr,
      });
      if (account) {
        account.balance = Number(account.balance ?? 0) + paid;
      }
    }

    saveStore(store);
    res.status(201).json({ sale, items: createdItems });
  });

  app.post('/api/sales/:id/payments', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const currentDue = Number(sale.due ?? 0);
    if (currentDue <= 0) {
      res.status(400).json({ error: 'This invoice is already fully paid.' });
      return;
    }
    const rawAmount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: 'Valid positive payment amount required.' });
      return;
    }
    if (rawAmount > currentDue + 0.01) {
      res.status(400).json({ error: `Payment amount cannot exceed current due (${currentDue.toFixed(2)}).` });
      return;
    }
    const collect = Math.min(currentDue, rawAmount);
    const rawAccId = Number(req.body?.account_id);
    const accountId =
      Number.isFinite(rawAccId) && rawAccId > 0
        ? rawAccId
        : Number(sale.account_id ?? store.bank_accounts[0]?.id ?? 0);
    const account =
      (accountId ? store.bank_accounts.find((a) => Number(a.id) === accountId) : undefined) ??
      store.bank_accounts[0];

    sale.paid = Number(sale.paid ?? 0) + collect;
    sale.due = Math.max(0, Number(sale.receivable ?? 0) - Number(sale.paid));
    sale.payment_status = Number(sale.due) <= 0 ? 'paid' : 'partial';

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const payDate = req.body?.payment_date ? String(req.body.payment_date) : now;
    const payMethod = String(req.body?.payment_method ?? (account ? String(account.account_name).toLowerCase() : 'cash'));
    store.payments.unshift({
      id: nextId(store.payments),
      sale_id: id,
      customer_id: sale.customer_id ?? null,
      amount: collect,
      payment_date: payDate,
      payment_method: payMethod,
      reference_no: req.body?.reference_no ? String(req.body.reference_no) : null,
      note: String(req.body?.note ?? 'Due collection'),
      created_by: req.authUser?.id ?? 1,
      created_at: now,
    });
    if (account) {
      account.balance = Number(account.balance ?? 0) + collect;
    }
    saveStore(store);
    res.json(sale);
  });

  app.delete('/api/sales/:id', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const idx = store.sales.findIndex((s) => Number(s.id) === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const sale = store.sales[idx];
    const items = store.sale_items.filter((it) => Number(it.sale_id) === id);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const item of items) {
      if (item.product_id) {
        const product = store.products.find((p) => Number(p.id) === Number(item.product_id));
        if (product) {
          const oldQty = Number(product.quantity ?? 0);
          const newQty = oldQty + Number(item.quantity ?? 0);
          product.quantity = newQty;
          product.stock_quantity = newQty;
          store.stock_movements.unshift({
            id: nextId(store.stock_movements),
            product_id: Number(product.id),
            old_quantity: oldQty,
            new_quantity: newQty,
            difference: Number(item.quantity ?? 0),
            reason: `Restored from deleted sale #${id}`,
            created_by: req.authUser?.id ?? 1,
            created_at: now,
          });
        }
      }
    }
    const paidAmount = Number(sale.paid ?? 0);
    if (paidAmount > 0 && sale.account_id) {
      const account = store.bank_accounts.find((a) => Number(a.id) === Number(sale.account_id));
      if (account) {
        account.balance = Math.max(0, Number(account.balance ?? 0) - paidAmount);
      }
    }
    store.sale_items = store.sale_items.filter((it) => Number(it.sale_id) !== id);
    store.payments = store.payments.filter((p) => Number(p.sale_id) !== id);
    store.sales.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Purchases ----
  app.get('/api/purchases', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? '')]));

    let items: Array<Record<string, unknown>> = store.purchases.map((p) => ({
      ...p,
      supplier_name: supMap.get(Number(p.supplier_id)) ?? 'Unknown Supplier',
    }));
    if (q) {
      items = items.filter((p) =>
        matchesSearchTokens([p.invoice_no, p.supplier_name, p.payment_method], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({ items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit });
  });

  app.post('/api/purchases', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product) {
      res.status(400).json({ error: 'Valid product is required.' });
      return;
    }
    const supplierId = Number(body.supplier_id);
    const supplier = store.suppliers.find((s) => Number(s.id) === supplierId);
    if (!supplier) {
      res.status(400).json({ error: 'Valid supplier is required.' });
      return;
    }
    const rawQty = Number(body.quantity ?? 1);
    const rawPrice = Number(body.price ?? product.purchase_price ?? 0);
    const rawDiscount = Number(body.discount ?? 0);
    const rawPaid = Number(body.paid ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isFinite(rawDiscount) || rawDiscount < 0 || !Number.isFinite(rawPaid) || rawPaid < 0) {
      res.status(400).json({ error: 'Quantity must be at least 1 and prices/amounts cannot be negative.' });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const subtotal = qty * price;
    const discount = Math.min(subtotal, rawDiscount);
    const total = Math.max(0, subtotal - discount);
    const paid = Math.min(total, rawPaid);
    const due = Math.max(0, total - paid);

    const purchaseId = nextId(store.purchases);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const invoiceNo = `PUR-${now.slice(0, 10).replace(/-/g, '')}-${String(purchaseId).padStart(4, '0')}`;
    const actorId = req.authUser?.id ?? 1;

    const purchase = {
      id: purchaseId,
      invoice_no: invoiceNo,
      supplier_id: supplierId,
      purchase_date: now,
      total_amount: total,
      paid_amount: paid,
      due_amount: due,
      discount,
      payment_method: String(body.payment_method ?? 'cash'),
      note: String(body.note ?? ''),
      status: 1,
      user_id: actorId,
      subtotal,
      total,
      paid,
      due,
      created_at: now,
    };
    store.purchases.unshift(purchase);
    store.purchase_items.push({
      id: nextId(store.purchase_items),
      purchase_id: purchaseId,
      product_id: Number(product.id),
      quantity: qty,
      price,
      warranty_months: 0,
      total: subtotal,
    });

    const oldQty = Number(product.quantity ?? 0);
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    product.purchase_price = price;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: qty,
      reason: `Purchase ${invoiceNo}`,
      created_by: actorId,
      created_at: now,
    });

    if (paid > 0) {
      store.supplier_payments.unshift({
        id: nextId(store.supplier_payments),
        purchase_id: purchaseId,
        supplier_id: supplierId,
        amount: paid,
        payment_date: now,
        payment_method: String(body.payment_method ?? 'cash'),
        reference_no: null,
        note: 'Initial purchase payment',
        created_by: actorId,
        created_at: now,
      });
    }
    saveStore(store);
    res.status(201).json(purchase);
  });

  app.post('/api/purchases/:id/payments', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const purchase = store.purchases.find((p) => Number(p.id) === id);
    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found.' });
      return;
    }
    const currentDue = Number(purchase.due ?? 0);
    if (currentDue <= 0) {
      res.status(400).json({ error: 'This purchase is already fully paid.' });
      return;
    }
    const rawPay = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawPay) || rawPay <= 0) {
      res.status(400).json({ error: 'Valid positive amount required.' });
      return;
    }
    if (rawPay > currentDue + 0.01) {
      res.status(400).json({ error: `Payment amount cannot exceed current due (${currentDue.toFixed(2)}).` });
      return;
    }
    const pay = Math.min(currentDue, rawPay);
    purchase.paid = Number(purchase.paid ?? 0) + pay;
    purchase.paid_amount = purchase.paid;
    purchase.due = Math.max(0, Number(purchase.total ?? 0) - Number(purchase.paid));
    purchase.due_amount = purchase.due;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    store.supplier_payments.unshift({
      id: nextId(store.supplier_payments),
      purchase_id: id,
      supplier_id: purchase.supplier_id ?? null,
      amount: pay,
      payment_date: now,
      payment_method: String(req.body?.payment_method ?? 'cash'),
      reference_no: null,
      note: 'Supplier due settlement',
      created_by: req.authUser?.id ?? 1,
      created_at: now,
    });
    saveStore(store);
    res.json(purchase);
  });

  // ---- Customers & Suppliers ----
  app.get('/api/customers', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const fetchAll = req.query.all === '1';
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll
      ? Math.max(1, store.customers.length)
      : Math.min(10000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));

    const totals = new Map<number, { billed: number; paid: number; due: number; invoices: number }>();
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      if (!cid) continue;
      const cur = totals.get(cid) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      cur.billed += Number(s.receivable ?? 0);
      cur.paid += Number(s.paid ?? 0);
      cur.due += Number(s.due ?? 0);
      cur.invoices += 1;
      totals.set(cid, cur);
    }

    let items: Array<Record<string, unknown>> = store.customers.map((c) => {
      const t = totals.get(Number(c.id)) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      return { ...c, ...t };
    });
    if (q) {
      items = items.filter((c) =>
        matchesSearchTokens([c.name, c.phone, c.email, c.address], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    });
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: 'Opening balance must be 0 or greater.' });
      return;
    }
    const row = {
      id: nextId(store.customers),
      name,
      email: String(req.body?.email ?? ''),
      phone: String(req.body?.phone ?? ''),
      address: String(req.body?.address ?? ''),
      city: String(req.body?.city ?? ''),
      state: '',
      zip_code: '',
      opening_balance: openingBalance,
      status: 1,
      points: 0,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.customers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  app.get('/api/suppliers', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const fetchAll = req.query.all === '1';
    const page = fetchAll ? 1 : Math.max(1, Number(req.query.page ?? 1));
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = fetchAll
      ? Math.max(1, store.suppliers.length)
      : Math.min(10000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));

    const totals = new Map<number, { purchased: number; paid: number; due: number; orders: number }>();
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      if (!sid) continue;
      const cur = totals.get(sid) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      cur.purchased += Number(p.total ?? 0);
      cur.paid += Number(p.paid ?? 0);
      cur.due += Number(p.due ?? 0);
      cur.orders += 1;
      totals.set(sid, cur);
    }

    let items: Array<Record<string, unknown>> = store.suppliers.map((s) => {
      const t = totals.get(Number(s.id)) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      return { ...s, ...t };
    });
    if (q) {
      items = items.filter((s) =>
        matchesSearchTokens([s.name, s.phone, s.email, s.address], q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({
      items: fetchAll ? items : items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    });
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: 'Opening balance must be 0 or greater.' });
      return;
    }
    const row = {
      id: nextId(store.suppliers),
      name,
      email: String(req.body?.email ?? ''),
      phone: String(req.body?.phone ?? ''),
      address: String(req.body?.address ?? ''),
      city: '',
      state: '',
      zip_code: '',
      opening_balance: openingBalance,
      status: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.suppliers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Estimates ----
  app.get('/api/estimates', (_req: Request, res: Response) => {
    const store = getStore();
    res.json({ items: [...store.estimates].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)) });
  });

  app.post('/api/estimates', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product || !String(body.customer_name ?? '').trim()) {
      res.status(400).json({ error: 'Customer name and product are required.' });
      return;
    }
    const rawQty = Number(body.quantity ?? 1);
    const rawPrice = Number(body.price ?? product.selling_price ?? 0);
    const rawDiscount = Number(body.discount ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0 || !Number.isFinite(rawDiscount) || rawDiscount < 0) {
      res.status(400).json({ error: 'Valid positive quantity and non-negative price/discount are required.' });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const subtotal = qty * price;
    const discount = Math.min(subtotal, rawDiscount);
    const total = Math.max(0, subtotal - discount);
    const estId = nextId(store.estimates);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const est = {
      id: estId,
      estimate_no: `EST-${now.slice(0, 10).replace(/-/g, '')}-${String(estId).padStart(4, '0')}`,
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      customer_name: String(body.customer_name).trim(),
      customer_phone: String(body.customer_phone ?? ''),
      subtotal,
      discount,
      total,
      status: 'pending',
      valid_until: String(body.valid_until ?? ''),
      notes: String(body.notes ?? ''),
      product_name: String(product.name),
      quantity: qty,
      created_at: now,
    };
    store.estimates.unshift(est);
    saveStore(store);
    res.status(201).json(est);
  });

  app.patch('/api/estimates/:id', (req: Request, res: Response) => {
    const store = getStore();
    const est = store.estimates.find((e) => Number(e.id) === Number(req.params.id));
    if (!est) {
      res.status(404).json({ error: 'Estimate not found.' });
      return;
    }
    const nextStatus = String(req.body?.status ?? 'approved').trim().toLowerCase();
    if (!['pending', 'approved', 'rejected', 'converted'].includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid estimate status. Allowed: pending, approved, rejected, converted.' });
      return;
    }
    est.status = nextStatus;
    saveStore(store);
    res.json(est);
  });

  // ---- Accounts & Expenses ----
  app.get('/api/accounts', (_req: Request, res: Response) => {
    const store = getStore();
    const accMap = new Map(store.bank_accounts.map((a) => [Number(a.id), String(a.account_name ?? '')]));
    const transactions = [...store.bank_transactions]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((tx) => ({ ...tx, account_name: accMap.get(Number(tx.bank_account_id)) ?? 'Account' }));
    res.json({ accounts: store.bank_accounts, transactions });
  });

  app.post('/api/accounts/transactions', (req: Request, res: Response) => {
    const store = getStore();
    const acc = store.bank_accounts.find((a) => Number(a.id) === Number(req.body?.bank_account_id));
    if (!acc) {
      res.status(400).json({ error: 'Account not found.' });
      return;
    }
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Transaction amount must be greater than 0.' });
      return;
    }
    const type = req.body?.type === 'withdraw' ? 'withdraw' : 'deposit';
    const currentBalance = Number(acc.balance ?? 0);
    if (type === 'withdraw' && amount > currentBalance + 0.009) {
      res.status(400).json({
        error: `Insufficient balance in "${acc.account_name}" (${currentBalance.toFixed(2)} available).`,
      });
      return;
    }
    const tx = {
      id: nextId(store.bank_transactions),
      bank_account_id: Number(acc.id),
      type,
      amount,
      description: String(req.body?.description ?? ''),
      transaction_date: String(req.body?.transaction_date ?? new Date().toISOString().slice(0, 10)),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.bank_transactions.unshift(tx);
    acc.balance = type === 'deposit' ? currentBalance + amount : Math.max(0, currentBalance - amount);
    saveStore(store);
    res.status(201).json({ transaction: tx, account: acc });
  });

  app.get('/api/expenses', (_req: Request, res: Response) => {
    const store = getStore();
    res.json({
      items: [...store.expenses].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)),
      categories: store.expense_categories,
    });
  });

  app.post('/api/expenses', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const rawAmount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: 'Valid positive expense amount is required.' });
      return;
    }
    const amount = rawAmount;
    const category = String(req.body?.category ?? 'Other').trim() || 'Other';
    const exp = {
      id: nextId(store.expenses),
      category,
      description: String(req.body?.description ?? ''),
      amount,
      expense_date: String(req.body?.expense_date ?? new Date().toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });

  // ---- Returns & Damages ----
  app.get('/api/returns-damages', (_req: Request, res: Response) => {
    const store = getStore();
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? '')]));
    res.json({
      returns: store.returns.map((r) => ({ ...r, product_name: prodMap.get(Number(r.product_id)) ?? 'Product' })),
      damages: store.damages.map((d) => ({ ...d, product_name: prodMap.get(Number(d.product_id)) ?? 'Product' })),
    });
  });

  app.post('/api/returns', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const sale = store.sales.find((s) => Number(s.id) === Number(req.body?.sale_id));
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!sale || !product) {
      res.status(400).json({ error: 'Valid sale and product are required.' });
      return;
    }
    const rawQty = Number(req.body?.quantity ?? 1);
    const rawPrice = Number(req.body?.price ?? product.selling_price ?? 0);
    if (!Number.isFinite(rawQty) || rawQty < 1 || !Number.isFinite(rawPrice) || rawPrice < 0) {
      res.status(400).json({ error: 'Valid positive quantity and non-negative price are required.' });
      return;
    }
    const qty = Math.round(rawQty);
    const price = rawPrice;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const actorId = req.authUser?.id ?? 1;
    const row = {
      id: nextId(store.returns),
      sale_id: Number(sale.id),
      invoice_no: String(sale.invoice_no),
      customer_id: sale.customer_id ?? null,
      product_id: Number(product.id),
      quantity: qty,
      price,
      total_amount: qty * price,
      reason: String(req.body?.reason ?? '').trim() || 'Customer Return',
      return_date: now.slice(0, 10),
      created_by: actorId,
      created_at: now,
    };
    store.returns.unshift(row);
    const oldQty = Number(product.quantity ?? 0);
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: qty,
      reason: `Sales Return (${sale.invoice_no})`,
      created_by: actorId,
      created_at: now,
    });
    saveStore(store);
    res.status(201).json(row);
  });

  app.post('/api/damages', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!product) {
      res.status(400).json({ error: 'Valid product is required.' });
      return;
    }
    const available = Number(product.quantity ?? 0);
    const reqQty = Math.round(Number(req.body?.quantity ?? 0));
    if (!Number.isFinite(reqQty) || reqQty < 1) {
      res.status(400).json({ error: 'Damage quantity must be at least 1.' });
      return;
    }
    if (reqQty > available) {
      res.status(400).json({
        error: `Insufficient stock for damage entry on "${product.name}". Available stock: ${available}.`,
      });
      return;
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const actorId = req.authUser?.id ?? 1;
    const row = {
      id: nextId(store.damages),
      product_id: Number(product.id),
      quantity: reqQty,
      reason: String(req.body?.reason ?? '').trim() || 'Damaged item',
      loss_amount: reqQty * Number(product.purchase_price ?? 0),
      damage_date: now.slice(0, 10),
      created_by: actorId,
      created_at: now,
    };
    store.damages.unshift(row);
    const newQty = available - reqQty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: available,
      new_quantity: newQty,
      difference: -reqQty,
      reason: `Damage: ${row.reason}`,
      created_by: actorId,
      created_at: now,
    });
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Reports ----
  app.get('/api/reports', (req: Request, res: Response) => {
    const store = getStore();
    let from = String(req.query.from ?? '2026-01-01').slice(0, 10);
    let to = String(req.query.to ?? '2099-12-31').slice(0, 10);
    if (from && to && from > to) {
      [from, to] = [to, from];
    }

    const periodSales = store.sales.filter((s) => {
      const d = String(s.date ?? '');
      return d >= from && d <= to && String(s.status ?? 'completed') === 'completed';
    });

    const summary = periodSales.reduce<{
      invoiceCount: number;
      revenue: number;
      collected: number;
      due: number;
      profit: number;
    }>(
      (acc, s) => {
        acc.invoiceCount += 1;
        acc.revenue += Number(s.receivable ?? 0);
        acc.collected += Number(s.paid ?? 0);
        acc.due += Number(s.due ?? 0);
        acc.profit += Number(s.profit ?? 0);
        return acc;
      },
      { invoiceCount: 0, revenue: 0, collected: 0, due: 0, profit: 0 }
    );

    const expensesTotal = store.expenses
      .filter((e) => {
        const d = String(e.expense_date ?? '');
        return d >= from && d <= to;
      })
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    const custDuesMap = new Map<number, { id: number; name: string; phone: string; due: number }>();
    for (const c of store.customers) {
      custDuesMap.set(Number(c.id), { id: Number(c.id), name: String(c.name ?? ''), phone: String(c.phone ?? ''), due: 0 });
    }
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      const entry = custDuesMap.get(cid);
      if (entry) entry.due += Number(s.due ?? 0);
    }
    const customerDues = [...custDuesMap.values()].filter((c) => c.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);

    const supDuesMap = new Map<number, { id: number; name: string; phone: string; due: number }>();
    for (const sup of store.suppliers) {
      supDuesMap.set(Number(sup.id), { id: Number(sup.id), name: String(sup.name ?? ''), phone: String(sup.phone ?? ''), due: 0 });
    }
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      const entry = supDuesMap.get(sid);
      if (entry) entry.due += Number(p.due ?? 0);
    }
    const supplierDues = [...supDuesMap.values()].filter((s) => s.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);

    res.json({
      from,
      to,
      summary,
      expensesTotal,
      netProfit: summary.profit - expensesTotal,
      customerDues,
      supplierDues,
    });
  });

  // ---- Dynamic Menus & Settings ----
  app.get('/api/menus', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });

  app.post('/api/menus', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.title || !String(body.title).trim()) {
      res.status(400).json({ error: 'Menu title is required.' });
      return;
    }
    const rawOrder = Number(body.sort_order ?? store.menus.length + 1);
    if (!Number.isFinite(rawOrder) || rawOrder < 0) {
      res.status(400).json({ error: 'Sort order must be a valid non-negative number.' });
      return;
    }
    const menu = {
      id: nextId(store.menus),
      parent_id: null,
      title: String(body.title).trim(),
      group_label: String(body.group_label ?? 'Custom').trim() || 'Custom',
      route_key: String(body.route_key ?? 'dashboard').trim(),
      url: String(body.url ?? '/dashboard').trim(),
      icon: String(body.icon ?? 'circle').trim(),
      sort_order: Math.round(rawOrder),
      roles: Array.isArray(body.roles) && body.roles.length ? body.roles.map(String) : ['admin', 'manager', 'staff'],
      is_active: body.is_active !== false,
    };
    store.menus.push(menu);
    saveStore(store);
    res.status(201).json(menu);
  });

  app.put('/api/menus/:id', (req: Request, res: Response) => {
    const store = getStore();
    const menu = store.menus.find((m) => m.id === Number(req.params.id));
    if (!menu) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.title !== undefined) {
      if (!String(body.title).trim()) {
        res.status(400).json({ error: 'Menu title cannot be empty.' });
        return;
      }
      menu.title = String(body.title).trim();
    }
    if (body.group_label !== undefined) menu.group_label = String(body.group_label).trim();
    if (body.route_key !== undefined) menu.route_key = String(body.route_key).trim();
    if (body.icon !== undefined) menu.icon = String(body.icon).trim();
    if (body.sort_order !== undefined) {
      const parsedOrder = Number(body.sort_order);
      if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
        res.status(400).json({ error: 'Sort order must be a valid non-negative number.' });
        return;
      }
      menu.sort_order = Math.round(parsedOrder);
    }
    if (body.is_active !== undefined) menu.is_active = Boolean(body.is_active);
    if (Array.isArray(body.roles)) menu.roles = body.roles.map(String);
    saveStore(store);
    res.json(menu);
  });

  app.post('/api/menus/reorder', (req: Request, res: Response) => {
    const store = getStore();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    ids.forEach((id: number, idx: number) => {
      const m = store.menus.find((item) => item.id === id);
      if (m) m.sort_order = idx + 1;
    });
    saveStore(store);
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });

  app.delete('/api/menus/:id', (req: Request, res: Response) => {
    const store = getStore();
    const target = store.menus.find((m) => m.id === Number(req.params.id));
    if (!target) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }
    if (target.route_key === 'menus' || target.route_key === 'settings' || target.route_key === 'dashboard') {
      res.status(400).json({ error: 'Core system navigation items cannot be deleted. You can disable them instead.' });
      return;
    }
    store.menus = store.menus.filter((m) => m.id !== target.id);
    saveStore(store);
    res.json({ ok: true });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const store = getStore();
    if (req.body?.tax_rate !== undefined) {
      const parsedTax = Number(req.body.tax_rate);
      if (!Number.isFinite(parsedTax) || parsedTax < 0) {
        res.status(400).json({ error: 'Tax rate must be 0 or greater.' });
        return;
      }
    }
    const allowed = [
      'shop_name', 'shop_address', 'shop_phone', 'shop_email', 'shop_website',
      'shop_logo', 'shop_favicon', 'shop_qr',
      'currency', 'tax_rate', 'invoice_footer', 'sidebar_theme', 'primary_color', 'layout_mode',
    ];
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        store.settings[key] = String(req.body[key]);
      }
    }
    saveStore(store);
    res.json(store.settings);
  });

  // ---- Auth & Password Recovery ----
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const store = getStore();
    const publicSettings = getPublicSettings(store);
    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.json({
        authenticated: false,
        setupRequired: !store.users.some((u) => Boolean(u.password_hash)),
        settings: publicSettings,
      });
      return;
    }
    setSessionCookie(req, res, session.token, session.expiresAt);
    res.json({
      authenticated: true,
      setupRequired: false,
      token: session.token,
      user: sanitizeUser(session.user),
      expiresAt: session.expiresAt,
      settings: publicSettings,
      bootstrap: buildBootstrapPayload(store, session.user),
    });
  });

  app.post('/api/auth/keepalive', (req: Request, res: Response) => {
    const session = getValidSession(req, res);
    if (!session) {
      clearSessionCookie(req, res);
      res.status(401).json({ error: 'Session expired after 60 minutes of inactivity.' });
      return;
    }
    setSessionCookie(req, res, session.token, session.expiresAt);
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const store = getStore();
    const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password) {
      res.status(400).json({ error: 'Email or username and password are required.' });
      return;
    }

    const user = store.users.find(
      (u) => u.email.toLowerCase() === identifier || u.name.toLowerCase() === identifier
    );
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. Only registered dashboard accounts can sign in.' });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ error: 'This account is currently disabled. Contact the Super Admin.' });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({
        error: 'Password is not configured for this account. Use Forgot password? with your registered phone number to set or recover your password.',
      });
      return;
    }

    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({
        error: 'Incorrect password. Please enter your authentic password or use Forgot password? to recover it.',
      });
      return;
    }

    const { token, expiresAt } = createSignedSessionToken(user);
    setSessionCookie(req, res, token, expiresAt);

    res.json({
      token,
      expiresAt,
      user: sanitizeUser(user),
      bootstrap: buildBootstrapPayload(store, user),
    });
  });

  function findUserByEmailOrPhone(store: PosStoreData, rawIdentifier: string): StoreUser | undefined {
    const clean = rawIdentifier.trim().toLowerCase();
    const digits = normalizePhoneDigits(rawIdentifier);
    const tail = (d: string) => (d.length >= 8 ? d.slice(-10) : d);
    return store.users.find((u) => {
      if (u.email.toLowerCase() === clean || u.name.toLowerCase() === clean) return true;
      if (digits.length >= 6) {
        const uDigits = normalizePhoneDigits(u.phone);
        if (uDigits.length >= 6 && tail(uDigits) === tail(digits)) return true;
        const shopDigits = normalizePhoneDigits(store.settings.shop_phone);
        if (['super_admin', 'admin'].includes(u.role) && shopDigits.length >= 6 && tail(shopDigits) === tail(digits)) {
          return true;
        }
      }
      return false;
    });
  }

  function hashRecoveryCode(userId: number, code: string): string {
    return crypto.createHmac('sha256', OTP_HMAC_KEY).update(`${userId}:${code}`).digest('hex');
  }

  function isSafeExternalWebhookUrl(rawUrl: string): URL | null {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  app.post('/api/auth/request-recovery-code', async (req: Request, res: Response) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
    const requestedChannel = String(req.body?.channel ?? '').trim().toLowerCase();
    if (!rawIdentifier) {
      res.status(400).json({ error: 'Please enter your registered email address or mobile number.' });
      return;
    }

    const channel: 'email' | 'sms' =
      requestedChannel === 'sms' || requestedChannel === 'email'
        ? (requestedChannel as 'email' | 'sms')
        : rawIdentifier.includes('@')
          ? 'email'
          : 'sms';

    const cleanEnvVal = (raw: string | undefined, fallback = '') => {
      const trimmed = (raw ?? '').trim();
      if (!trimmed) return fallback;
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1).trim();
      }
      return trimmed;
    };

    const rawSmtpHost = cleanEnvVal(process.env.SMTP_HOST, 'mail.youthit.com.bd');
    const smtpHost =
      rawSmtpHost
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split(':')[0]
        .trim() || 'mail.youthit.com.bd';
    const parsedPort = Number(cleanEnvVal(process.env.SMTP_PORT, '465'));
    const smtpPort = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 465;
    const rawSmtpUser = cleanEnvVal(process.env.SMTP_USER, 'info@youthit.com.bd');
    const shopEmailFallback = (store.settings.shop_email || 'info@youthit.com.bd').trim();
    const smtpUser =
      rawSmtpUser.toLowerCase() === smtpHost.toLowerCase() && shopEmailFallback.includes('@')
        ? shopEmailFallback
        : rawSmtpUser;
    const rawSmtpPass = process.env.SMTP_PASS || '';
    const cleanedSmtpPass = cleanEnvVal(rawSmtpPass, '');
    const smtpPass = rawSmtpPass || cleanedSmtpPass;
    const rawSmtpFrom = cleanEnvVal(process.env.SMTP_FROM, smtpUser) || smtpUser;
    const smtpFrom = rawSmtpFrom.includes('@') ? rawSmtpFrom : smtpUser;

    if (channel === 'email') {
      if (!smtpHost || !smtpUser || !smtpPass) {
        res.status(422).json({
          error: `Email password (SMTP_PASS) for ${smtpUser} (${smtpHost}:${smtpPort}) is not configured in Settings -> Secrets yet. Add SMTP_PASS in Secrets to send verification emails.`,
        });
        return;
      }
    } else {
      const safeSmsUrl = process.env.SMS_GATEWAY_URL
        ? isSafeExternalWebhookUrl(cleanEnvVal(process.env.SMS_GATEWAY_URL))
        : null;
      if (!safeSmsUrl) {
        res.status(422).json({
          error:
            'SMS delivery is not configured in Settings -> Secrets (SMS_GATEWAY_URL, SMS_API_KEY). Configure an SMS gateway or switch to Email once configured.',
        });
        return;
      }
    }

    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.json({
        ok: true,
        channel,
        message: `If an active account matches that ${channel === 'email' ? 'email' : 'mobile number'}, a 6-digit verification code has been sent.`,
      });
      return;
    }

    const existing = recoveryCodes.get(user.id);
    if (existing && Date.now() - existing.sentAt < OTP_COOLDOWN_MS && Date.now() < existing.expiresAt) {
      res.status(429).json({ error: 'Please wait a moment before requesting another verification code.' });
      return;
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashRecoveryCode(user.id, code);
    const shopName = store.settings.shop_name || 'Youth IT POS';

    try {
      if (channel === 'email') {
        if (!user.email) {
          res.status(400).json({ error: 'No email address is registered for this account.' });
          return;
        }
        const sendWithPass = async (passCandidate: string) => {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            requireTLS: smtpPort === 587,
            auth: {
              user: smtpUser,
              pass: passCandidate,
            },
            connectionTimeout: 8_000,
            greetingTimeout: 8_000,
            socketTimeout: 10_000,
          });
          await transporter.sendMail({
            from: `${shopName} <${smtpFrom}>`,
            to: user.email,
            subject: `${shopName} — Password Recovery Verification Code`,
            text: `Hello ${user.name},\n\nYour 6-digit password recovery verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`,
          });
        };

        try {
          await sendWithPass(rawSmtpPass);
        } catch (smtpErr) {
          const errCode = (smtpErr as { code?: string } | null)?.code;
          if (errCode === 'EAUTH' && cleanedSmtpPass && cleanedSmtpPass !== rawSmtpPass) {
            await sendWithPass(cleanedSmtpPass);
          } else {
            throw smtpErr;
          }
        }
      } else {
        const fallbackShopPhone = ['super_admin', 'admin'].includes(user.role)
          ? store.settings.shop_phone || ''
          : '';
        const targetPhone = String(user.phone || fallbackShopPhone).trim();
        if (!targetPhone) {
          res.status(400).json({
            error: 'No mobile number is registered for this account. Please try Email recovery instead.',
          });
          return;
        }
        const smsUrl = isSafeExternalWebhookUrl(cleanEnvVal(process.env.SMS_GATEWAY_URL))!;
        const smsSenderId = cleanEnvVal(
          process.env.SMS_SENDER_ID ||
            smsUrl.searchParams.get('senderid') ||
            smsUrl.searchParams.get('sender_id') ||
            smsUrl.searchParams.get('SenderId') ||
            ''
        );
        const rawDigits = normalizePhoneDigits(targetPhone);
        const bd13 = rawDigits.startsWith('8801')
          ? rawDigits
          : rawDigits.startsWith('01') && rawDigits.length === 11
            ? `88${rawDigits}`
            : targetPhone.replace(/^\+/, '');
        const bd11 = rawDigits.startsWith('8801') && rawDigits.length === 13
          ? rawDigits.slice(2)
          : bd13;

        const rawApiKeySecret = cleanEnvVal(
          process.env.SMS_API_KEY ||
            smsUrl.searchParams.get('api_key') ||
            smsUrl.searchParams.get('apikey') ||
            smsUrl.searchParams.get('ApiKey') ||
            smsUrl.searchParams.get('Apikey') ||
            smsUrl.searchParams.get('token') ||
            ''
        );
        let smsApiKey = rawApiKeySecret;
        let smsClientId = cleanEnvVal(
          process.env.SMS_CLIENT_ID ||
            smsUrl.searchParams.get('ClientId') ||
            smsUrl.searchParams.get('client_id') ||
            smsUrl.searchParams.get('clientId') ||
            ''
        );
        const smsUsername = cleanEnvVal(
          process.env.SMS_USERNAME ||
            smsUrl.searchParams.get('UserName') ||
            smsUrl.searchParams.get('username') ||
            ''
        );
        const smsSecretKey = cleanEnvVal(
          process.env.SMS_SECRET_KEY ||
            smsUrl.searchParams.get('secretkey') ||
            smsUrl.searchParams.get('SecretKey') ||
            smsUrl.searchParams.get('api_secret') ||
            ''
        );
        if (!smsClientId && rawApiKeySecret.includes('|')) {
          const [cid, keyPart] = rawApiKeySecret.split('|', 2);
          if (cid && keyPart) {
            smsClientId = cid.trim();
            smsApiKey = keyPart.trim();
          }
        }

        const redactSecrets = (txt: string) => {
          let safe = txt.replaceAll(code, '******');
          if (smsApiKey) safe = safe.replaceAll(smsApiKey, '***');
          if (smsClientId) safe = safe.replaceAll(smsClientId, '***');
          if (smsUsername) safe = safe.replaceAll(smsUsername, '***');
          if (smsSecretKey) safe = safe.replaceAll(smsSecretKey, '***');
          if (smtpPass) safe = safe.replaceAll(smtpPass, '***');
          return safe.trim().slice(0, 160);
        };

        const dispatchSms = async (phoneValue: string, mode: 'json' | 'form' | 'get'): Promise<void> => {
          const smsMsg = `${shopName} recovery code: ${code} (valid 10 min).`;
          const baseParams: Record<string, string> = {
            to: phoneValue,
            number: phoneValue,
            numbers: phoneValue,
            MobileNumber: phoneValue,
            MobileNumbers: phoneValue,
            msisdn: phoneValue,
            type: 'text',
            TransactionType: 'T',
            message: smsMsg,
            Message: smsMsg,
            msg: smsMsg,
            sms: smsMsg,
          };
          if (smsApiKey) {
            baseParams.api_key = smsApiKey;
            baseParams.apikey = smsApiKey;
            baseParams.ApiKey = smsApiKey;
            baseParams.Apikey = smsApiKey;
            baseParams.api_token = smsApiKey;
            baseParams.token = smsApiKey;
          }
          if (smsClientId) {
            baseParams.ClientId = smsClientId;
            baseParams.client_id = smsClientId;
            if (!smsUsername) {
              baseParams.UserName = smsClientId;
            }
          }
          if (smsUsername) {
            baseParams.UserName = smsUsername;
            baseParams.username = smsUsername;
          }
          if (smsSecretKey) {
            baseParams.secretkey = smsSecretKey;
            baseParams.SecretKey = smsSecretKey;
            baseParams.api_secret = smsSecretKey;
          }
          if (smsSenderId) {
            baseParams.senderid = smsSenderId;
            baseParams.sender_id = smsSenderId;
            baseParams.SenderId = smsSenderId;
            baseParams.SenderName = smsSenderId;
            baseParams.sender = smsSenderId;
            baseParams.sid = smsSenderId;
          }
          const reqUrl = new URL(smsUrl.toString());
          if (mode === 'get') {
            for (const [k, v] of Object.entries(baseParams)) {
              if (!reqUrl.searchParams.has(k)) {
                reqUrl.searchParams.set(k, v);
              }
            }
          }
          const smsRes = await fetch(reqUrl.toString(), {
            method: mode === 'get' ? 'GET' : 'POST',
            headers:
              mode === 'get'
                ? {}
                : {
                    'Content-Type':
                      mode === 'form'
                        ? 'application/x-www-form-urlencoded'
                        : 'application/json',
                  },
            body:
              mode === 'get'
                ? undefined
                : mode === 'form'
                  ? new URLSearchParams(baseParams).toString()
                  : JSON.stringify(baseParams),
            signal: AbortSignal.timeout(8_000),
          });
          const rawSmsText = await smsRes.text();
          const trimmedSms = rawSmsText.trim();
          const smsContentType = (smsRes.headers.get('content-type') || '').toLowerCase();
          if (
            smsContentType.includes('text/html') ||
            trimmedSms.startsWith('<!doctype') ||
            trimmedSms.startsWith('<!DOCTYPE') ||
            trimmedSms.startsWith('<html')
          ) {
            throw new Error(
              'SMS_GATEWAY_URL returned an HTML page instead of an SMS API response. Please enter your actual SMS provider API endpoint in Settings -> Secrets.'
            );
          }
          if (!smsRes.ok) {
            throw new Error(
              `SMS gateway rejected request (HTTP ${smsRes.status}): ${redactSecrets(trimmedSms) || 'Check SMS_GATEWAY_URL and SMS_API_KEY.'}`
            );
          }
          if (trimmedSms) {
            let parsedSms: Record<string, unknown> | null = null;
            try {
              const parsed = JSON.parse(trimmedSms);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsedSms = parsed as Record<string, unknown>;
              } else if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
                parsedSms = parsed[0] as Record<string, unknown>;
              }
            } catch {
              parsedSms = null;
            }

            if (parsedSms) {
              const rawCode =
                parsedSms.response_code ??
                parsedSms.status_code ??
                parsedSms.statusCode ??
                parsedSms.StatusCode ??
                parsedSms.error_code ??
                parsedSms.errorCode ??
                parsedSms.ErrorCode ??
                parsedSms.code;
              const numCode = rawCode !== undefined && rawCode !== null && rawCode !== '' ? Number(rawCode) : NaN;
              const statusStr = String(parsedSms.status ?? parsedSms.Status ?? parsedSms.result ?? '').toLowerCase();
              const errField =
                parsedSms.error_message ??
                parsedSms.errorMessage ??
                parsedSms.ErrorMessage ??
                parsedSms.ErrorDescription ??
                parsedSms.error ??
                parsedSms.Error ??
                parsedSms.errors;
              const hasExplicitError =
                Boolean(errField) &&
                !['0', 'none', 'null', 'false', 'ok', 'success'].includes(String(errField).toLowerCase());
              const badStatus =
                parsedSms.ok === false ||
                parsedSms.success === false ||
                parsedSms.success === 'false' ||
                statusStr === 'false' ||
                statusStr === '0' ||
                /error|fail|reject|invalid|denied/.test(statusStr);
              const badNumericCode =
                Number.isFinite(numCode) &&
                ![0, 200, 201, 202, 1101].includes(numCode) &&
                (numCode >= 300 || numCode < 0 || numCode === 1 || numCode === 2);

              if (hasExplicitError || badStatus || badNumericCode) {
                const detail = String(
                  errField || parsedSms.message || parsedSms.Message || trimmedSms
                );
                const statusFlags = `SMS_API_KEY=${smsApiKey ? 'set' : 'missing'}, SMS_CLIENT_ID=${smsClientId ? 'set' : 'missing'}, SMS_USERNAME=${smsUsername ? 'set' : 'missing'}, SMS_SECRET_KEY=${smsSecretKey ? 'set' : 'missing'}, SMS_SENDER_ID=${smsSenderId ? 'set' : 'missing'}`;
                const extraHint = /sender\s*id/i.test(detail)
                  ? ' — Add SMS_SENDER_ID in Settings -> Secrets.'
                  : /credential|apikey|clientid|username|secret/i.test(detail)
                    ? ` — Secrets detected: [${statusFlags}]. Add/verify the required credential in Settings -> Secrets.`
                    : '';
                throw new Error(`SMS gateway error: ${redactSecrets(detail)}${extraHint}`);
              }

              const msgText = String(parsedSms.message ?? parsedSms.Message ?? '');
              if (/missing|required|invalid|not\s+found|unauthoriz|fail|error/i.test(msgText)) {
                throw new Error(`SMS gateway error: ${redactSecrets(msgText)}`);
              }
            } else {
              if (/error|fail|invalid|denied|missing|required|balance|sender|not\s+found|unauthoriz|expired|wrong/i.test(trimmedSms)) {
                throw new Error(`SMS gateway error: ${redactSecrets(trimmedSms)}`);
              }
              if (!/\b(ok|success|sent|queued|accepted|submitted|delivered|200|202|1101)\b/i.test(trimmedSms)) {
                throw new Error(`SMS gateway response did not confirm delivery: ${redactSecrets(trimmedSms)}`);
              }
            }
          }
        };

        const smsAttempts: Array<[string, 'form' | 'get' | 'json']> = [
          [bd13, 'form'],
          [bd13, 'get'],
          [bd13, 'json'],
          ...(bd11 !== bd13
            ? ([
                [bd11, 'form'],
                [bd11, 'get'],
                [bd11, 'json'],
              ] as Array<[string, 'form' | 'get' | 'json']>)
            : []),
        ];
        let lastSmsErr: unknown = null;
        let specificApiErr: unknown = null;
        let smsDelivered = false;
        for (const [phoneCandidate, mode] of smsAttempts) {
          try {
            await dispatchSms(phoneCandidate, mode);
            smsDelivered = true;
            break;
          } catch (attemptErr) {
            lastSmsErr = attemptErr;
            const m = attemptErr instanceof Error ? attemptErr.message : '';
            if (m.startsWith('SMS gateway error:')) {
              specificApiErr = attemptErr;
            }
            if (
              !/invalid|missing|required|blank|credential|method|unsupported|media\s*type|http 400|http 401|http 403|http 404|http 405|http 406|http 415|http 422|did not confirm/i.test(
                m
              )
            ) {
              throw attemptErr;
            }
          }
        }
        if (!smsDelivered) {
          throw specificApiErr ?? lastSmsErr;
        }
      }

      recoveryCodes.set(user.id, {
        codeHash,
        channel,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        sentAt: Date.now(),
        attempts: 0,
      });

      res.json({
        ok: true,
        channel,
        message: `A 6-digit verification code has been sent to your registered ${channel === 'email' ? 'email' : 'mobile number'}.`,
      });
    } catch (err) {
      const codeHint = (err as { code?: string } | null)?.code;
      const errMsg = err instanceof Error ? err.message : '';
      const redact = (txt: string) => {
        let s = txt.replaceAll(code, '******');
        if (smtpPass) s = s.replaceAll(smtpPass, '***');
        if (cleanedSmtpPass) s = s.replaceAll(cleanedSmtpPass, '***');
        if (process.env.SMS_API_KEY) s = s.replaceAll(process.env.SMS_API_KEY, '***');
        if (process.env.SMS_CLIENT_ID) s = s.replaceAll(process.env.SMS_CLIENT_ID, '***');
        if (process.env.SMS_USERNAME) s = s.replaceAll(process.env.SMS_USERNAME, '***');
        if (process.env.SMS_SECRET_KEY) s = s.replaceAll(process.env.SMS_SECRET_KEY, '***');
        return s.trim().slice(0, 220);
      };
      const reason =
        codeHint === 'EAUTH'
          ? `SMTP authentication failed for ${smtpUser} on ${smtpHost}:${smtpPort}. Please verify SMTP_USER and SMTP_PASS in Settings -> Secrets (enter plain values without surrounding quotes).`
          : codeHint === 'ETIMEDOUT' || codeHint === 'ECONNREFUSED' || codeHint === 'ESOCKET'
            ? `Could not connect to mail server (${smtpHost}:${smtpPort}). Please verify SMTP_HOST and SMTP_PORT in Settings -> Secrets.`
            : errMsg.startsWith('SMS')
              ? errMsg
              : `Email delivery failed (${codeHint || 'SMTP'}): ${redact(errMsg) || 'Please verify SMTP credentials in Settings -> Secrets.'}`;
      res.status(422).json({ error: reason });
    }
  });

  app.post('/api/auth/verify-recovery-code', (req: Request, res: Response) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
    const code = String(req.body?.code ?? '').trim();

    if (!rawIdentifier || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Account email/mobile and 6-digit verification code are required.' });
      return;
    }

    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    const entry = recoveryCodes.get(user.id);
    if (!entry || Date.now() > entry.expiresAt || entry.attempts >= 5) {
      recoveryCodes.delete(user.id);
      res.status(401).json({ error: 'Verification code is invalid or expired. Please request a new code.' });
      return;
    }

    const candidateHash = hashRecoveryCode(user.id, code);
    const validCode = crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(entry.codeHash, 'hex')
    );

    if (!validCode) {
      entry.attempts += 1;
      if (entry.attempts >= 5) recoveryCodes.delete(user.id);
      res.status(401).json({ error: 'Incorrect verification code. Please check your email/SMS and try again.' });
      return;
    }

    const resetProof = crypto.randomBytes(32).toString('hex');
    entry.verifiedProofHash = crypto.createHash('sha256').update(resetProof).digest('hex');
    entry.verifiedUntil = Date.now() + OTP_EXPIRY_MS;
    entry.attempts = 0;

    res.json({
      ok: true,
      reset_proof: resetProof,
      message: 'Verification code matched! Please enter your new password.',
    });
  });

  app.post('/api/auth/recover-password', (req: Request, res: Response) => {
    const store = getStore();
    const rawIdentifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
    const code = String(req.body?.code ?? '').trim();
    const resetProof = String(req.body?.reset_proof ?? '').trim();
    const newPassword = String(req.body?.new_password ?? '');

    if (!rawIdentifier || (!/^\d{6}$/.test(code) && !resetProof) || !newPassword) {
      res.status(400).json({ error: 'Verification is required before setting a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = findUserByEmailOrPhone(store, rawIdentifier);
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid or expired verification session.' });
      return;
    }

    const entry = recoveryCodes.get(user.id);
    if (!entry || Date.now() > entry.expiresAt || entry.attempts >= 5) {
      recoveryCodes.delete(user.id);
      res.status(401).json({ error: 'Verification code is invalid or expired. Please request a new code.' });
      return;
    }

    let verified = false;
    if (resetProof && entry.verifiedProofHash && entry.verifiedUntil && Date.now() <= entry.verifiedUntil) {
      const candidateProofHash = crypto.createHash('sha256').update(resetProof).digest('hex');
      verified = crypto.timingSafeEqual(
        Buffer.from(candidateProofHash, 'hex'),
        Buffer.from(entry.verifiedProofHash, 'hex')
      );
    } else if (/^\d{6}$/.test(code)) {
      const candidateHash = hashRecoveryCode(user.id, code);
      verified = crypto.timingSafeEqual(
        Buffer.from(candidateHash, 'hex'),
        Buffer.from(entry.codeHash, 'hex')
      );
    }

    if (!verified) {
      entry.attempts += 1;
      if (entry.attempts >= 5) recoveryCodes.delete(user.id);
      res.status(401).json({ error: 'Verification code did not match. Please verify your code first.' });
      return;
    }

    recoveryCodes.delete(user.id);
    user.password_hash = hashPassword(newPassword);
    saveStore(store);

    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === user.id) activeSessions.delete(tok);
    }
    savePersistedSessions();

    res.json({
      ok: true,
      message: 'Verification code confirmed and password updated. Please sign in with your new password.',
    });
  });

  app.post('/api/auth/change-password', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    const userId = Number(req.body?.user_id ?? authUser?.id ?? 0);
    const currentPassword = String(req.body?.current_password ?? '');
    const newPassword = String(req.body?.new_password ?? '');

    if (!authUser || (authUser.id !== userId && !hasAnyRole(authUser, ['admin']))) {
      res.status(403).json({ error: 'You do not have permission to change this password.' });
      return;
    }
    if (!userId || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if (user.role === 'super_admin' && authUser.role !== 'super_admin') {
      res.status(403).json({ error: 'Only the Super Admin can change the Super Admin password.' });
      return;
    }
    if (user.password_hash && authUser.id === user.id && !verifyPassword(currentPassword, user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    user.password_hash = hashPassword(newPassword);
    saveStore(store);
    res.json({ ok: true, user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const tokens: string[] = [];
    const authHeader = String(req.headers.authorization ?? '');
    if (authHeader.startsWith('Bearer ')) {
      tokens.push(authHeader.slice(7).trim());
    }
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      tokens.push(cookies[SESSION_COOKIE_NAME]);
    }
    let revokedAny = false;
    for (const tok of tokens) {
      if (!tok) continue;
      activeSessions.delete(tok);
      const parsed = parseSignedTokenJti(tok);
      if (parsed) {
        revokedSessionJtis.set(parsed.jti, parsed.exp);
        revokedAny = true;
      }
    }
    savePersistedSessions();
    if (revokedAny) saveRevokedSessions();
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // ---- Users (never expose password hashes) ----
  app.get('/api/users', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    if (!hasAnyRole(authUser, ['admin'])) {
      res.json(authUser ? [sanitizeUser(authUser)] : []);
      return;
    }
    res.json(store.users.map(sanitizeUser));
  });

  app.post('/api/users', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const { name, email, role, phone, address, password } = req.body ?? {};
    const cleanName = String(name ?? '').trim();
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      res.status(400).json({ error: 'Name and email are required.' });
      return;
    }
    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const cleanPassword = String(password ?? '');
    if (!cleanPassword || cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password is required (at least 6 characters) when adding a user.' });
      return;
    }
    const requestedRole = String(role ?? 'staff');
    const assignedRole = ['admin', 'manager', 'staff'].includes(requestedRole) ? requestedRole : 'staff';
    const user = {
      id: nextId(store.users),
      name: cleanName,
      email: cleanEmail,
      role: assignedRole,
      phone: String(phone ?? '').trim(),
      address: String(address ?? '').trim(),
      password_hash: hashPassword(cleanPassword),
      is_active: true,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.users.push(user);
    saveStore(store);
    res.status(201).json(sanitizeUser(user));
  });

  app.put('/api/users/:id', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (!authUser || (authUser.id !== user.id && !hasAnyRole(authUser, ['admin']))) {
      res.status(403).json({ error: 'You do not have permission to edit this user.' });
      return;
    }
    if (user.role === 'super_admin' && authUser.role !== 'super_admin') {
      res.status(403).json({ error: 'Only the Super Admin can modify the Super Admin account.' });
      return;
    }

    const body = req.body ?? {};
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) {
        res.status(400).json({ error: 'Name cannot be empty.' });
        return;
      }
      user.name = n;
    }
    if (body.email !== undefined) {
      const e = String(body.email).trim().toLowerCase();
      if (!e) {
        res.status(400).json({ error: 'Email cannot be empty.' });
        return;
      }
      if (store.users.some((u) => u.id !== user.id && u.email.toLowerCase() === e)) {
        res.status(409).json({ error: 'Another user already uses this email.' });
        return;
      }
      user.email = e;
    }
    if (body.phone !== undefined) user.phone = String(body.phone).trim();
    if (body.address !== undefined) user.address = String(body.address).trim();
    if (body.profile_image === null || body.profile_image === '') {
      user.profile_image = null;
    } else if (
      typeof body.profile_image === 'string' &&
      (body.profile_image.startsWith('/uploads/') || body.profile_image.startsWith('/assets/'))
    ) {
      user.profile_image = body.profile_image;
    }
    if (body.role !== undefined && hasAnyRole(authUser, ['admin'])) {
      if (user.id === 1 || user.role === 'super_admin') {
        user.role = 'super_admin';
      } else if (['admin', 'manager', 'staff'].includes(String(body.role))) {
        user.role = String(body.role);
      }
    }
    if (body.password !== undefined && String(body.password) !== '') {
      const p = String(body.password);
      if (p.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }
      user.password_hash = hashPassword(p);
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === user.id && authUser.id !== user.id) activeSessions.delete(tok);
      }
      savePersistedSessions();
    }
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.post('/api/users/:id/avatar', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (!authUser || (authUser.id !== user.id && !hasAnyRole(authUser, ['admin']))) {
      res.status(403).json({ error: 'You do not have permission to update this profile photo.' });
      return;
    }
    const dataUrl = String(req.body?.image_data ?? '');
    if (!dataUrl) {
      user.profile_image = null;
      saveStore(store);
      res.json(sanitizeUser(user));
      return;
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({ error: 'Please upload a valid PNG, JPG, or WEBP image.' });
      return;
    }
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Profile image must be under 2MB.' });
      return;
    }
    const fileName = `user-${user.id}-${Date.now()}.${ext}`;
    const targetPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(targetPath, buffer);
    user.profile_image = `/uploads/avatars/${fileName}`;
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.patch('/api/users/:id/toggle', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (user.id === 1 || user.role === 'super_admin' || user.id === authUser?.id) {
      res.status(400).json({ error: 'Super Admin or currently signed-in account cannot be disabled.' });
      return;
    }
    user.is_active = !user.is_active;
    if (!user.is_active) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === user.id) activeSessions.delete(tok);
      }
      savePersistedSessions();
    }
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.delete('/api/users/:id', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const authUser = req.authUser;
    const targetId = Number(req.params.id);
    const targetUser = store.users.find((u) => u.id === targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (targetId === 1 || targetUser.role === 'super_admin' || targetId === authUser?.id) {
      res.status(400).json({ error: 'Super Admin or currently signed-in account cannot be deleted.' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== targetId);
    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === targetId) activeSessions.delete(tok);
    }
    savePersistedSessions();
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Owners ----
  app.get('/api/owners', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.owners].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });

  app.post('/api/owners', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    const sharePercent = Number(req.body?.share_percent ?? 0);
    if (!name) {
      res.status(400).json({ error: 'Owner name is required.' });
      return;
    }
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      res.status(400).json({ error: 'Share percentage must be between 0 and 100.' });
      return;
    }
    const owner = {
      id: nextId(store.owners),
      name,
      phone: String(req.body?.phone ?? '').trim(),
      email: String(req.body?.email ?? '').trim(),
      address: String(req.body?.address ?? '').trim(),
      share_percent: sharePercent,
      is_active: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.owners.unshift(owner);
    saveStore(store);
    res.status(201).json(owner);
  });

  app.patch('/api/owners/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const owner = store.owners.find((o) => Number(o.id) === Number(req.params.id));
    if (!owner) {
      res.status(404).json({ error: 'Owner not found.' });
      return;
    }
    owner.is_active = Number(owner.is_active) === 1 ? 0 : 1;
    saveStore(store);
    res.json(owner);
  });

  app.delete('/api/owners/:id', (req: Request, res: Response) => {
    const store = getStore();
    store.owners = store.owners.filter((o) => Number(o.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Bank Account Creation ----
  app.post('/api/accounts', (req: Request, res: Response) => {
    const store = getStore();
    const accountName = String(req.body?.account_name ?? '').trim();
    const bankName = String(req.body?.bank_name ?? '').trim();
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!accountName) {
      res.status(400).json({ error: 'Account name is required.' });
      return;
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: 'Opening balance cannot be negative.' });
      return;
    }
    const acc = {
      id: nextId(store.bank_accounts),
      bank_name: bankName || accountName,
      account_name: accountName,
      branch: String(req.body?.branch ?? '').trim() || null,
      opening_balance: openingBalance,
      balance: openingBalance,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.bank_accounts.push(acc);
    saveStore(store);
    res.status(201).json(acc);
  });

  // ---- Cash Book ----
  app.get('/api/cashbook', (_req: Request, res: Response) => {
    const store = getStore();
    const rows = [...store.cash_transactions].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      if (String(r.type) === 'in') totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    res.json({
      items: rows,
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
    });
  });

  app.post('/api/cashbook', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Cash transaction amount must be greater than 0.' });
      return;
    }
    let totalIn = 0;
    let totalOut = 0;
    for (const r of store.cash_transactions) {
      if (String(r.type) === 'in') totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    const currentCash = totalIn - totalOut;
    if (type === 'out' && amount > currentCash + 0.009) {
      res.status(400).json({ error: `Insufficient cash book balance (${currentCash.toFixed(2)} available).` });
      return;
    }
    const row = {
      id: nextId(store.cash_transactions),
      type,
      amount,
      description: String(req.body?.description ?? '').trim(),
      transaction_date: String(req.body?.transaction_date ?? new Date().toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.cash_transactions.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Stock & Movements ----
  app.get('/api/stock', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const filter = String(req.query.filter ?? 'all');
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const brandMap = new Map(store.brands.map((b) => [Number(b.id), String(b.name ?? '')]));
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? 'Product')]));

    let products: Array<Record<string, unknown>> = store.products
      .filter((p) => Number(p.status ?? 1) === 1)
      .map((p) => ({
        ...p,
        image: resolveProductImage(p.image, p.name),
        category_name: catMap.get(Number(p.category_id)) ?? 'Uncategorized',
        brand_name: brandMap.get(Number(p.brand_id)) ?? 'No Brand',
        quantity: Number(p.stock_quantity ?? p.quantity ?? 0),
      }));

    if (q) {
      products = products.filter((p) =>
        matchesSearchTokens([p.name, p.sku, p.barcode, p.category_name, p.brand_name], q)
      );
    }
    if (filter === 'low') {
      products = products.filter((p) => Number(p.quantity ?? 0) > 0 && Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));
    } else if (filter === 'out') {
      products = products.filter((p) => Number(p.quantity ?? 0) <= 0);
    }

    const movements = [...store.stock_movements]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .slice(0, 80)
      .map((m) => ({
        ...m,
        product_name: prodMap.get(Number(m.product_id)) ?? 'Product',
      }));

    res.json({ products, movements });
  });

  // ---- Payments (Customer Collections + Supplier Payments) ----
  app.get('/api/payments', (_req: Request, res: Response) => {
    const store = getStore();
    const saleMap = new Map(store.sales.map((s) => [Number(s.id), s]));
    const purMap = new Map(store.purchases.map((p) => [Number(p.id), p]));
    const custMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? '')]));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? '')]));

    const customerPayments = [...store.payments]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((p) => {
        const s = saleMap.get(Number(p.sale_id));
        return {
          ...p,
          invoice_no: s ? String(s.invoice_no ?? '') : `#${p.sale_id}`,
          party_name:
            (s ? String(s.customer_name ?? '') : '') ||
            custMap.get(Number(p.customer_id)) ||
            'Walk-in Customer',
        };
      });

    const supplierPayments = [...store.supplier_payments]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((p) => {
        const pur = purMap.get(Number(p.purchase_id));
        return {
          ...p,
          invoice_no: pur ? String(pur.invoice_no ?? '') : `#${p.purchase_id}`,
          party_name: supMap.get(Number(p.supplier_id ?? pur?.supplier_id)) || 'Supplier',
        };
      });

    const dueSales = store.sales
      .filter((s) => Number(s.due ?? 0) > 0.009)
      .map((s) => ({
        id: Number(s.id),
        invoice_no: String(s.invoice_no ?? ''),
        customer_name: String(s.customer_name ?? 'Customer'),
        due: Number(s.due ?? 0),
      }));

    const duePurchases = store.purchases
      .filter((p) => Number(p.due ?? 0) > 0.009)
      .map((p) => ({
        id: Number(p.id),
        invoice_no: String(p.invoice_no ?? ''),
        supplier_name: supMap.get(Number(p.supplier_id)) || 'Supplier',
        due: Number(p.due ?? 0),
      }));

    res.json({ customerPayments, supplierPayments, dueSales, duePurchases });
  });

  // ---- Employees & Salary ----
  app.get('/api/employees', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.employees].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });

  app.post('/api/employees', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    const salary = Number(req.body?.salary ?? 0);
    if (!name) {
      res.status(400).json({ error: 'Employee name is required.' });
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      res.status(400).json({ error: 'Salary cannot be negative.' });
      return;
    }
    const emp = {
      id: nextId(store.employees),
      employee_id: String(req.body?.employee_id ?? '').trim() || `EMP-${String(nextId(store.employees)).padStart(3, '0')}`,
      name,
      email: String(req.body?.email ?? '').trim(),
      phone: String(req.body?.phone ?? '').trim(),
      address: String(req.body?.address ?? '').trim(),
      designation: String(req.body?.designation ?? '').trim() || 'Staff',
      department: String(req.body?.department ?? '').trim() || 'Operations',
      joining_date: String(req.body?.joining_date ?? new Date().toISOString().slice(0, 10)),
      salary,
      status: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.employees.unshift(emp);
    saveStore(store);
    res.status(201).json(emp);
  });

  app.post('/api/employees/:id/pay-salary', (req: AuthedRequest, res: Response) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    const amount = Number(req.body?.amount ?? emp.salary ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Salary payment amount must be greater than 0.' });
      return;
    }
    const exp = {
      id: nextId(store.expenses),
      category: 'Salary',
      description: `Salary paid to ${emp.name} (${emp.designation || 'Staff'})${req.body?.note ? ` - ${req.body.note}` : ''}`,
      amount,
      expense_date: String(req.body?.date ?? new Date().toISOString().slice(0, 10)),
      created_by: req.authUser?.id ?? 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });

  app.patch('/api/employees/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    emp.status = Number(emp.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(emp);
  });

  app.delete('/api/employees/:id', (req: Request, res: Response) => {
    const store = getStore();
    store.employees = store.employees.filter((e) => Number(e.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Backup & Restore ----
  app.get('/api/backup/export', (_req: Request, res: Response) => {
    const store = getStore();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="youthit-pos-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(store, null, 2));
  });

  app.get('/api/backup/export-sql', (_req: Request, res: Response) => {
    const store = getStore();
    const sqlDump = generateMysqlDumpSql(store);
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="youthit-pos-database-${new Date().toISOString().slice(0, 10)}.sql"`);
    res.send(sqlDump);
  });

  app.get('/api/backup/download-full-project-zip', async (_req: Request, res: Response) => {
    const projectRoot = process.cwd();
    const store = getStore();
    const sqlDump = generateMysqlDumpSql(store);
    const zip = new JSZip();
    const files = collectFiles(projectRoot, projectRoot);

    for (const rel of files) {
      if (rel === 'database/youthit_pos_database.sql' || rel === 'laravel/database/sql/youthits_pos.sql') {
        continue;
      }
      const full = path.join(projectRoot, rel);
      zip.file(`youthit-pos-full-project/${rel}`, fs.readFileSync(full));
    }

    zip.file('youthit-pos-full-project/database/youthit_pos_database.sql', sqlDump);
    zip.file('youthit-pos-full-project/laravel/database/sql/youthits_pos.sql', sqlDump);
    zip.file('youthit-pos-full-project/HOSTING_UPLOAD_GUIDE.md', buildHostingUploadGuide());

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="youthit-pos-full-project.zip"');
    res.send(buffer);
  });

  app.post('/api/backup/restore', (req: Request, res: Response) => {
    const payload = req.body?.backup;
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.products) || !Array.isArray(payload.sales)) {
      res.status(400).json({ error: 'Invalid backup JSON file. Required POS tables missing.' });
      return;
    }
    const current = getStore();
    const safeStore: PosStoreData = {
      ...current,
      settings: payload.settings && typeof payload.settings === 'object' ? { ...current.settings, ...payload.settings } : current.settings,
      menus: Array.isArray(payload.menus) && payload.menus.length ? payload.menus : current.menus,
      users: Array.isArray(payload.users) && payload.users.length ? payload.users : current.users,
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      brands: Array.isArray(payload.brands) ? payload.brands : [],
      units: Array.isArray(payload.units) ? payload.units : [],
      warranties: Array.isArray(payload.warranties) ? payload.warranties : [],
      products: (payload.products as SqlRow[]).map((p) => ({
        ...p,
        image: resolveProductImage(p.image, p.name),
      })),
      stock_movements: Array.isArray(payload.stock_movements) ? payload.stock_movements : [],
      customers: Array.isArray(payload.customers) ? payload.customers : [],
      suppliers: Array.isArray(payload.suppliers) ? payload.suppliers : [],
      owners: Array.isArray(payload.owners) ? payload.owners : [],
      employees: Array.isArray(payload.employees) ? payload.employees : [],
      bank_accounts: Array.isArray(payload.bank_accounts) ? payload.bank_accounts : [],
      bank_transactions: Array.isArray(payload.bank_transactions) ? payload.bank_transactions : [],
      cash_transactions: Array.isArray(payload.cash_transactions) ? payload.cash_transactions : [],
      expense_categories: Array.isArray(payload.expense_categories) ? payload.expense_categories : current.expense_categories,
      expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
      sales: payload.sales,
      sale_items: Array.isArray(payload.sale_items) ? payload.sale_items : [],
      payments: Array.isArray(payload.payments) ? payload.payments : [],
      purchases: Array.isArray(payload.purchases) ? payload.purchases : [],
      purchase_items: Array.isArray(payload.purchase_items) ? payload.purchase_items : [],
      supplier_payments: Array.isArray(payload.supplier_payments) ? payload.supplier_payments : [],
      estimates: Array.isArray(payload.estimates) ? payload.estimates : [],
      estimate_items: Array.isArray(payload.estimate_items) ? payload.estimate_items : [],
      returns: Array.isArray(payload.returns) ? payload.returns : [],
      damages: Array.isArray(payload.damages) ? payload.damages : [],
    };
    saveStore(safeStore);
    res.json({ ok: true, products: safeStore.products.length, sales: safeStore.sales.length });
  });

  app.post('/api/backup/import-sql', (req: Request, res: Response) => {
    const sqlText = String(req.body?.sql ?? '');
    if (!sqlText.trim()) {
      res.status(400).json({ error: 'SQL file content is empty.' });
      return;
    }

    const { tables, schemas, truncated, incompleteTables } = parseMysqlDumpText(sqlText);
    const tableNames = Object.keys(tables);
    if (tableNames.length === 0) {
      const sizeKb = (Buffer.byteLength(sqlText, 'utf8') / 1024).toFixed(1);
      const schemaList = Object.keys(schemas).join(', ') || 'none';
      const cutTable = incompleteTables[0] || 'unknown';
      res.status(400).json({
        error: truncated
          ? `The uploaded SQL file (${sizeKb} KB) is incomplete/truncated inside table "${cutTable}" before ";" finished (schemas found: ${schemaList}). Please export a complete .sql file from phpMyAdmin/MySQL.`
          : `No valid INSERT INTO table statements were found in this SQL file (${sizeKb} KB).`,
      });
      return;
    }

    const current = getStore();
    const rawCategories = tables.categories ?? tables.product_categories ?? [];
    const rawBrands = tables.brands ?? [];
    const rawUnits = tables.units ?? [];
    const rawWarranties = tables.warranties ?? [];
    const rawProducts = tables.products ?? [];
    const rawCustomers = tables.customers ?? [];
    const rawSuppliers = tables.suppliers ?? [];
    const rawAccounts = tables.bank_accounts ?? tables.accounts ?? [];
    const rawExpenseCats = tables.expense_categories ?? [];
    const rawExpenses = tables.expenses ?? [];
    const rawSales = tables.sales ?? tables.sells ?? [];
    const rawSaleItems = tables.sale_items ?? tables.sell_items ?? [];
    const rawPurchases = tables.purchases ?? [];
    const rawPurchaseItems = tables.purchase_items ?? [];
    const rawActualPayments = tables.actual_payments ?? [];

    const custNameMap = new Map(rawCustomers.map((c) => [Number(c.id), String(c.name ?? '')]));
    const prodNameMap = new Map(rawProducts.map((p) => [Number(p.id), String(p.name ?? '')]));
    const expCatMap = new Map(rawExpenseCats.map((c) => [Number(c.id), String(c.name ?? '')]));
    const acctNameMap = new Map(
      rawAccounts.map((a) => [Number(a.id), String(a.account_name ?? a.name ?? 'Account')])
    );

    const warranties = rawWarranties.map((w) => ({
      ...w,
      id: Number(w.id),
      name: String(w.name ?? w.duration ?? 'Warranty'),
      duration: String(w.duration ?? w.name ?? ''),
      status: Number(w.status ?? 1),
    }));

    const products = rawProducts.map((p) => {
      const qty = Number(p.stock_quantity ?? p.quantity ?? p.stock ?? 0);
      return {
        ...p,
        id: Number(p.id),
        name: String(p.name ?? ''),
        sku: String(p.sku ?? p.code ?? ''),
        category_id: p.category_id ? Number(p.category_id) : null,
        brand_id: p.brand_id ? Number(p.brand_id) : null,
        unit_id: (p.unit_id ?? p.main_unit_id) ? Number(p.unit_id ?? p.main_unit_id) : null,
        warranty_id: p.warranty_id ? Number(p.warranty_id) : null,
        purchase_price: Number(p.purchase_price ?? p.purchase_cost ?? p.cost_price ?? 0),
        selling_price: Number(p.selling_price ?? p.sale_price ?? p.price ?? 0),
        quantity: qty,
        stock_quantity: qty,
        alert_quantity: Number(p.alert_quantity ?? 5),
        image: resolveProductImage(p.image, p.name),
        status: Number(p.status ?? 1),
      };
    });

    const customers = rawCustomers.map((c) => ({
      ...c,
      id: Number(c.id),
      name: String(c.name ?? ''),
      email: c.email ? String(c.email) : '',
      phone: c.phone ? String(c.phone) : '',
      address: c.address ? String(c.address) : '',
      opening_balance: Number(c.opening_balance ?? c.due ?? 0),
      status: Number(c.status ?? 1),
    }));

    const suppliers = rawSuppliers.map((s) => ({
      ...s,
      id: Number(s.id),
      name: String(s.name ?? ''),
      email: s.email ? String(s.email) : '',
      phone: s.phone ? String(s.phone) : '',
      address: s.address ? String(s.address) : '',
      opening_balance: Number(s.opening_balance ?? s.due ?? 0),
      status: Number(s.status ?? 1),
    }));

    const bank_accounts = rawAccounts.map((a) => ({
      ...a,
      id: Number(a.id),
      bank_name: String(a.bank_name ?? ''),
      account_name: String(a.account_name ?? a.name ?? 'Account'),
      branch: a.branch ?? null,
      opening_balance: Number(a.opening_balance ?? 0),
      balance: Number(a.balance ?? a.current_balance ?? a.opening_balance ?? 0),
    }));

    const expenses = rawExpenses.map((ex) => ({
      ...ex,
      id: Number(ex.id),
      category: String(ex.category ?? (ex.expense_category_id ? expCatMap.get(Number(ex.expense_category_id)) : '') ?? 'Other'),
      amount: Number(ex.amount ?? 0),
      expense_date: String(ex.expense_date ?? ex.date ?? ex.created_at ?? '').slice(0, 10),
      description: String(ex.description ?? ex.note ?? ''),
    }));

    const sales = rawSales.map((s) => {
      const cid = s.customer_id ? Number(s.customer_id) : null;
      const receivable = Number(s.receivable ?? s.final_receivable ?? s.total_amount ?? s.total ?? 0);
      const paid = Number(s.paid ?? s.paid_amount ?? 0);
      const due = Number(s.due ?? s.due_amount ?? Math.max(0, receivable - paid));
      return {
        ...s,
        id: Number(s.id),
        invoice_no: String(s.invoice_no ?? s.invoice ?? `INV-${s.id}`),
        customer_id: cid,
        customer_name: String(s.customer_name ?? (cid ? custNameMap.get(cid) : '') ?? 'Walk-in Customer'),
        date: String(s.date ?? s.sell_date ?? s.sale_date ?? s.created_at ?? '').slice(0, 10),
        discount: Number(s.discount ?? 0),
        vat: Number(s.vat ?? 0),
        receivable,
        paid,
        due,
        purchase_cost: Number(s.purchase_cost ?? s.total_cost ?? 0),
        profit: Number(s.profit ?? 0),
        status: String(s.status ?? 'completed'),
        payment_status: String(
          s.payment_status ?? (due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'due')
        ),
      };
    });

    const sale_items = rawSaleItems.map((it) => ({
      ...it,
      id: Number(it.id),
      product_id: it.product_id ? Number(it.product_id) : null,
      sale_id: Number(it.sale_id ?? it.sell_id ?? 0),
      product_name: String(it.product_name ?? (it.product_id ? prodNameMap.get(Number(it.product_id)) : '') ?? 'Product'),
      quantity: Number(it.quantity ?? it.qty ?? 1),
      price: Number(it.price ?? it.rate ?? it.unit_price ?? 0),
      total: Number(it.total ?? it.sub_total ?? 0),
    }));

    const purchases = rawPurchases.map((p) => {
      const total = Number(p.total ?? p.total_amount ?? 0);
      const paid = Number(p.paid ?? p.paid_amount ?? 0);
      const due = Number(p.due ?? p.due_amount ?? Math.max(0, total - paid));
      return {
        ...p,
        id: Number(p.id),
        invoice_no: String(p.invoice_no ?? `PUR-${p.id}`),
        supplier_id: p.supplier_id ? Number(p.supplier_id) : null,
        total,
        paid,
        due,
      };
    });

    const purchase_items = rawPurchaseItems.map((pi) => ({
      ...pi,
      id: Number(pi.id),
      purchase_id: Number(pi.purchase_id ?? 0),
      product_id: pi.product_id ? Number(pi.product_id) : null,
      quantity: Number(pi.quantity ?? pi.qty ?? 1),
      price: Number(pi.price ?? pi.rate ?? 0),
      total: Number(pi.total ?? pi.sub_total ?? 0),
    }));

    const actualReceives: SqlRow[] = rawActualPayments
      .filter((r) => String(r.payment_type ?? '') === 'receive')
      .map((r) => ({
        id: Number(r.id),
        sale_id: null,
        customer_id: r.customer_id ? Number(r.customer_id) : null,
        amount: Number(r.amount ?? 0),
        payment_date: String(r.date ?? r.created_at ?? ''),
        payment_method: Number(r.wallet_payment ?? 0) === 1 ? 'wallet' : 'cash',
        reference_no: null,
        note: r.note ? String(r.note) : null,
        created_by: 1,
        created_at: String(r.created_at ?? r.date ?? ''),
      }));

    const actualPays: SqlRow[] = rawActualPayments
      .filter((r) => String(r.payment_type ?? '') === 'pay')
      .map((r) => ({
        id: Number(r.id),
        purchase_id: null,
        supplier_id: r.supplier_id ? Number(r.supplier_id) : null,
        amount: Number(r.amount ?? 0),
        payment_date: String(r.date ?? r.created_at ?? ''),
        payment_method: Number(r.wallet_payment ?? 0) === 1 ? 'wallet' : 'cash',
        reference_no: null,
        note: r.note ? String(r.note) : null,
        created_by: 1,
        created_at: String(r.created_at ?? r.date ?? ''),
      }));

    const a2aTransactions: SqlRow[] = (tables.account_to_account_transections ?? []).map((t) => ({
      id: Number(t.id),
      bank_account_id: t.to ? Number(t.to) : (t.from ? Number(t.from) : null),
      account_name: t.to ? (acctNameMap.get(Number(t.to)) ?? 'Account') : 'Transfer',
      type: 'deposit',
      amount: Number(t.amount ?? 0),
      description: String(t.note ?? 'Account Transfer'),
      transaction_date: String(t.created_at ?? '').slice(0, 10),
    }));

    const updatedStore: PosStoreData = {
      ...current,
      categories: rawCategories,
      brands: rawBrands,
      units: rawUnits,
      warranties,
      products,
      stock_movements: tables.stock_movements ?? [],
      customers,
      suppliers,
      owners: tables.owners ?? [],
      employees: tables.employees ?? [],
      bank_accounts,
      bank_transactions: [...(tables.bank_transactions ?? []), ...a2aTransactions],
      cash_transactions: tables.cash_transactions ?? [],
      expense_categories: rawExpenseCats,
      expenses,
      sales,
      sale_items,
      payments: [...(tables.payments ?? []), ...actualReceives],
      purchases,
      purchase_items,
      supplier_payments: [...(tables.supplier_payments ?? []), ...actualPays],
      estimates: tables.estimates ?? [],
      estimate_items: tables.estimate_items ?? [],
      returns: tables.returns ?? tables.return_items ?? [],
      damages: tables.damages ?? [],
    };

    saveStore(updatedStore);
    res.json({
      ok: true,
      truncated,
      tablesImported: tableNames.length,
      counts: {
        products: updatedStore.products.length,
        categories: updatedStore.categories.length,
        brands: updatedStore.brands.length,
        customers: updatedStore.customers.length,
        suppliers: updatedStore.suppliers.length,
        sales: updatedStore.sales.length,
        purchases: updatedStore.purchases.length,
        payments: updatedStore.payments.length + updatedStore.supplier_payments.length,
        bankAccounts: updatedStore.bank_accounts.length,
      },
    });
  });

  app.post('/api/backup/clear', (_req: Request, res: Response) => {
    const current = getStore();
    const cleared: PosStoreData = {
      ...current,
      categories: [],
      brands: [],
      units: [],
      warranties: [],
      products: [],
      stock_movements: [],
      customers: [],
      suppliers: [],
      owners: [],
      employees: [],
      bank_accounts: [],
      bank_transactions: [],
      cash_transactions: [],
      expense_categories: [],
      expenses: [],
      sales: [],
      sale_items: [],
      payments: [],
      purchases: [],
      purchase_items: [],
      supplier_payments: [],
      estimates: [],
      estimate_items: [],
      returns: [],
      damages: [],
    };
    saveStore(cleared);
    res.json({ ok: true });
  });

  // ---- Laravel 13 Codebase Inspector & ZIP Export ----
  const laravelRoot = path.resolve(process.cwd(), 'laravel');

  app.get('/api/laravel/tree', (_req: Request, res: Response) => {
    const files = collectFiles(laravelRoot, laravelRoot);
    res.json({ files });
  });

  app.get('/api/laravel/file', (req: Request, res: Response) => {
    const rel = String(req.query.path ?? '');
    const target = path.resolve(laravelRoot, rel);
    if (!target.startsWith(laravelRoot + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    const stats = fs.statSync(target);
    if (stats.size > 350_000) {
      res.json({ path: rel, content: `/* Large SQL file (${(stats.size / 1024).toFixed(1)} KB) — included in ZIP download */` });
      return;
    }
    res.json({ path: rel, content: fs.readFileSync(target, 'utf8') });
  });

  app.get('/api/laravel/download-zip', async (_req: Request, res: Response) => {
    const zip = new JSZip();
    const files = collectFiles(laravelRoot, laravelRoot);
    const seen = new Set<string>();

    for (const rel of files) {
      if (rel === 'database/sql/youthits_pos.sql' || rel === 'database/youthit_pos_database.sql') {
        continue;
      }
      const full = path.join(laravelRoot, rel);
      zip.file(`youthit-pos-laravel/${rel}`, fs.readFileSync(full));
      seen.add(rel);
    }

    // Mirror any uploaded/public assets from root /public into laravel/public
    const rootPublic = path.resolve(process.cwd(), 'public');
    for (const publicRel of collectFiles(rootPublic, rootPublic)) {
      const targetRel = `public/${publicRel}`;
      if (!seen.has(targetRel)) {
        zip.file(`youthit-pos-laravel/${targetRel}`, fs.readFileSync(path.join(rootPublic, publicRel)));
        seen.add(targetRel);
      }
    }

    const sqlDump = generateMysqlDumpSql(getStore());
    zip.file('youthit-pos-laravel/database/sql/youthits_pos.sql', sqlDump);
    zip.file('youthit-pos-laravel/database/youthit_pos_database.sql', sqlDump);
    zip.file('youthit-pos-laravel/HOSTING_UPLOAD_GUIDE.md', buildHostingUploadGuide());

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="youthit-pos-laravel-13.zip"');
    res.send(buffer);
  });

  // Prevent any unmatched or failing /api/* request from falling through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  });

  // ---- Vite / Static Frontend ----
  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));
  const runningCompiledServer = path.basename(process.argv[1] || '') === 'server.js';
  const hasViteInstalled = fs.existsSync(path.resolve(process.cwd(), 'node_modules/vite/package.json'));
  const useProductionDist =
    process.env.NODE_ENV === 'production' ||
    (runningCompiledServer && distIndexExists) ||
    (!hasViteInstalled && distIndexExists);

  if (!useProductionDist) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Youth IT POS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
