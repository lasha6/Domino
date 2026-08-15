/* =====================================================================
   Where a player's progress lives.

   One record per player, holding everything that must outlive a session:
   coins, level, stats, streaks, achievements. Guests get one too, keyed by
   the id their device generated — so progress is kept without an account, but
   only a signed-in player carries it to a new phone.

   Three places it can be kept, chosen automatically:

     DATABASE_URL set  → Postgres. The real one. Survives restarts and
                         redeploys, and is the only option that works on a
                         host with no disk of its own (Render's free tier).
     otherwise         → a JSON file under DATA_DIR (default ./data). Fine
                         locally and on any host with a disk.
     file unwritable   → memory. Nothing is kept past a restart; the server
                         says so loudly on startup so it is never a surprise.

   Everything is behind one small interface, so moving between them changes
   nothing else in the game.
   ===================================================================== */
import fs from "fs/promises";
import path from "path";

const START_COINS = 1000;

/* ---------------- what a new player starts with ---------------- */
export function blankProfile(id, kind, name) {
  const now = Date.now();
  return {
    id, kind, name: name || "", picture: null,
    coins: START_COINS,
    gems: 0,
    owned: {},                       // what has been bought in the shop
    equipped: {},                    // and what is actually in use
    xp: 0, level: 1,
    stats: {
      matches: 0, matchWins: 0,
      hands: 0, handWins: 0,
      points: 0, bestHand: 0,
      streak: 0, bestStreak: 0,
    },
    daily: { lastClaim: null, streak: 0 },
    achievements: {},
    redeemed: {},                    // promo codes already used, so none twice
    created: now, seen: now,
  };
}

// Old records must keep working when new fields are added, so every read is
// filled in against a blank one rather than trusted as-is.
function complete(p, id, kind, name) {
  const base = blankProfile(id, kind, name);
  if (!p || typeof p !== "object") return base;
  return {
    ...base, ...p,
    stats: { ...base.stats, ...(p.stats || {}) },
    daily: { ...base.daily, ...(p.daily || {}) },
    achievements: { ...(p.achievements || {}) },
    redeemed: { ...(p.redeemed || {}) },
    owned: { ...(p.owned || {}) },
    equipped: { ...(p.equipped || {}) },
    id, kind: p.kind || kind,
  };
}

/* ---------------- memory: the fallback of last resort ---------------- */
function memoryStore() {
  const map = new Map();
  return {
    kind: "memory",
    async get(id) { return map.get(id) || null; },
    async set(id, data) { map.set(id, data); },
    async close() {},
  };
}

/* ---------------- a JSON file ---------------- */
async function fileStore(dir) {
  const file = path.join(dir, "profiles.json");
  await fs.mkdir(dir, { recursive: true });
  let all = {};
  try { all = JSON.parse(await fs.readFile(file, "utf8")) || {}; }
  catch (err) { if (err.code !== "ENOENT") throw err; }

  /* Writes go out at once rather than being batched. Batching looked cheaper,
     but it loses whatever is still waiting when the process is killed — and a
     player who wins a match and then sees the server restart would find the
     coins gone. Writes are queued one behind another so two never overlap, and
     each one lands through a temporary file so a crash mid-write cannot leave
     a half-written file behind. */
  let chain = Promise.resolve();
  async function flush() {
    try {
      const tmp = file + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(all));
      await fs.rename(tmp, file);          // replaces the old one in one step
    } catch (err) {
      console.error("[store] could not save:", err.message);
    }
  }

  return {
    kind: "file",
    file,
    async get(id) { return all[id] || null; },
    async set(id, data) {
      all[id] = data;
      chain = chain.then(flush, flush);
      return chain;
    },
    async close() { await chain; },
  };
}

/* ---------------- Postgres ---------------- */
async function pgStore(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    // hosted Postgres almost always wants TLS, and its certificate is not
    // one Node ships with
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    max: 4,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS profiles (
    id text PRIMARY KEY,
    data jsonb NOT NULL,
    updated timestamptz NOT NULL DEFAULT now()
  )`);
  return {
    kind: "postgres",
    async get(id) {
      const r = await pool.query("SELECT data FROM profiles WHERE id = $1", [id]);
      return r.rows.length ? r.rows[0].data : null;
    },
    async set(id, data) {
      await pool.query(
        `INSERT INTO profiles (id, data, updated) VALUES ($1, $2, now())
         ON CONFLICT (id) DO UPDATE SET data = $2, updated = now()`,
        [id, data]);
    },
    async close() { await pool.end(); },
  };
}

/* ---------------- pick one and get going ---------------- */
export async function openStore(env = process.env) {
  if (env.DATABASE_URL) {
    try {
      const s = await pgStore(env.DATABASE_URL);
      console.log("💾 progress: Postgres");
      return wrap(s);
    } catch (err) {
      console.error("[store] Postgres unavailable:", err.message);
    }
  }
  try {
    const s = await fileStore(env.DATA_DIR || path.join(process.cwd(), "data"));
    console.log(`💾 progress: file (${s.file})`);
    return wrap(s);
  } catch (err) {
    console.error("[store] no writable folder:", err.message);
  }
  console.warn("⚠️  progress: memory only — everything resets when the server restarts. Set DATABASE_URL to keep it.");
  return wrap(memoryStore());
}

// The interface the game actually uses. Nothing here throws: losing a profile
// read must never cost somebody their game.
function wrap(store) {
  const cache = new Map();          // id -> profile, so a hand does not hit the store on every move
  return {
    kind: store.kind,
    async load(id, kind, name) {
      if (cache.has(id)) {
        const p = cache.get(id);
        if (name && !p.name) p.name = name;
        return p;
      }
      let raw = null;
      try { raw = await store.get(id); } catch (err) { console.error("[store] read failed:", err.message); }
      const p = complete(raw, id, kind, name);
      cache.set(id, p);
      return p;
    },
    async save(p) {
      if (!p || !p.id) return;
      p.seen = Date.now();
      cache.set(p.id, p);
      try { await store.set(p.id, p); } catch (err) { console.error("[store] write failed:", err.message); }
    },
    forget(id) { cache.delete(id); },
    async close() { try { await store.close(); } catch (err) {} },
  };
}
