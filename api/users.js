const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_BODY = 16 * 1024;
const LOCAL_USERS_FILE = path.join(process.cwd(), "data", "users.log");
const TEMP_USERS_FILE = path.join("/tmp", "signaldesk-users.log");

function cleanName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function validName(name) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,60}$/.test(name);
}

function send(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res.end(JSON.stringify(data));
}

function bodyFromRequest(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BODY) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function storageFile() {
  if (process.env.VERCEL) return TEMP_USERS_FILE;
  return LOCAL_USERS_FILE;
}

function ensureFile(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "", "utf8");
}

function readExisting(file) {
  try {
    ensureFile(file);
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  try {
    const raw = await bodyFromRequest(req);
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return send(res, 400, { error: "Request body must be valid JSON." });
    }

    const name = cleanName(body.name);
    const age = Number(body.age);
    if (!validName(name)) return send(res, 400, { error: "Invalid name." });
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return send(res, 400, { error: "Age must be an integer from 1 to 120." });
    }

    const file = storageFile();
    const existing = readExisting(file);
    const duplicate = existing.some(line => {
      const match = line.match(/^\S+ \| Name: (.+) \| Age: (\d+) \|/);
      return match && match[1].toLowerCase() === name.toLowerCase() && Number(match[2]) === age;
    });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    if (!duplicate) {
      ensureFile(file);
      fs.appendFileSync(file, `${now} | Name: ${name} | Age: ${age} | Session: ${id}\n`, "utf8");
    }

    return send(res, 200, {
      id,
      name,
      age,
      existing: duplicate,
      storage: process.env.VERCEL ? "ephemeral-runtime" : "local-filesystem"
    });
  } catch (error) {
    console.error("SignalDesk user registration error:", error);
    return send(res, 500, { error: "The server could not process the user entry." });
  }
};
