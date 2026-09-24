const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.log");
const MAX_BODY = 16 * 1024;

fs.mkdirSync(DATA_DIR, {recursive:true});
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "", "utf8");

const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".ico":"image/x-icon"
};

function send(res, status, body, type="application/json; charset=utf-8", extra={}) {
  res.writeHead(status, {"Content-Type":type, "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"strict-origin-when-cross-origin", "Permissions-Policy":"camera=(), microphone=(), geolocation=()", ...extra});
  res.end(body);
}
function json(res, status, data) { send(res,status,JSON.stringify(data)); }
function cleanName(name) { return String(name).trim().replace(/\s+/g," "); }
function validName(name) { return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,60}$/.test(name); }

function readBody(req) {
  return new Promise((resolve,reject)=>{
    let data="";
    req.on("data", chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > MAX_BODY) { req.destroy(); reject(new Error("Request too large")); }
    });
    req.on("end",()=>resolve(data));
    req.on("error",reject);
  });
}

async function handleUser(req,res) {
  try {
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch { return json(res,400,{error:"Request body must be valid JSON."}); }
    const name = cleanName(body.name);
    const age = Number(body.age);
    if (!validName(name)) return json(res,400,{error:"Invalid name."});
    if (!Number.isInteger(age) || age < 1 || age > 120) return json(res,400,{error:"Age must be an integer from 1 to 120."});

    const existing = fs.readFileSync(USERS_FILE,"utf8").split("\n").filter(Boolean);
    const duplicate = existing.some(line => {
      const match = line.match(/^\S+ \| Name: (.+) \| Age: (\d+) \|/);
      return match && match[1].toLowerCase() === name.toLowerCase() && Number(match[2]) === age;
    });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    if (!duplicate) fs.appendFileSync(USERS_FILE, `${now} | Name: ${name} | Age: ${age} | Session: ${id}\n`, "utf8");
    json(res,200,{id,name,age,existing:duplicate});
  } catch (err) {
    json(res,500,{error:"The server could not write the user record."});
  }
}

function serveStatic(req,res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname); }
  catch { return send(res,400,"Bad request","text/plain; charset=utf-8"); }
  if (pathname === "/") pathname="/index.html";
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) return send(res,403,"Forbidden","text/plain; charset=utf-8");
  fs.stat(file,(err,stat)=>{
    if (err || !stat.isFile()) return send(res,404,"Not found","text/plain; charset=utf-8");
    const ext=path.extname(file).toLowerCase();
    send(res,200,fs.readFileSync(file),MIME[ext]||"application/octet-stream",{"Cache-Control":ext===".html"?"no-store":"public, max-age=3600"});
  });
}

const server = http.createServer(async (req,res)=>{
  if (req.method === "POST" && req.url === "/api/users") return handleUser(req,res);
  if (req.method === "GET" && req.url === "/api/health") return json(res,200,{ok:true,service:"signaldesk",time:new Date().toISOString()});
  if (req.method !== "GET" && req.method !== "HEAD") return json(res,405,{error:"Method not allowed."});
  if (req.method === "HEAD") return send(res,200,"", "text/plain; charset=utf-8");
  serveStatic(req,res);
});

server.listen(PORT,HOST,()=>console.log(`SignalDesk running at http://${HOST}:${PORT}`));
server.on("error",err=>{ console.error(err); process.exitCode=1; });