import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";

const dbPath = path.resolve("data", "pump_launches.db");
const sqlPath = path.resolve("data", "d1_backup.sql");

console.log(`Importing ${sqlPath} into ${dbPath}...`);

// Ensure data dir exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// If existing db exists, remove or append
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");

const rl = readline.createInterface({
  input: fs.createReadStream(sqlPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let currentStatement = "";
let statementCount = 0;
let inTransaction = false;

db.exec("BEGIN TRANSACTION;");
inTransaction = true;

const start = Date.now();

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("--")) return;

  currentStatement += line + "\n";
  if (trimmed.endsWith(";")) {
    try {
      db.exec(currentStatement);
      statementCount++;
      if (statementCount % 5000 === 0) {
        db.exec("COMMIT;");
        db.exec("BEGIN TRANSACTION;");
        console.log(`Imported ${statementCount} statements...`);
      }
    } catch (err) {
      console.error(`Error on statement (${currentStatement.slice(0, 80)}...):`, err.message);
    }
    currentStatement = "";
  }
});

rl.on("close", () => {
  if (inTransaction) {
    db.exec("COMMIT;");
  }
  // Create indexes from schema.sql
  try {
    const schemaSql = fs.readFileSync("schema.sql", "utf8");
    db.exec(schemaSql);
  } catch (err) {
    console.error("Index creation note:", err.message);
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\nImport completed in ${duration}s! Total statements: ${statementCount}`);

  // Print counts
  try {
    const eventsCnt = db.prepare("SELECT count(*) as cnt FROM events").get();
    const tradesCnt = db.prepare("SELECT count(*) as cnt FROM trades").get();
    const alertsCnt = db.prepare("SELECT count(*) as cnt FROM alerts").get();
    console.log(`Row counts in local SQLite:`);
    console.log(`  events: ${eventsCnt?.cnt}`);
    console.log(`  trades: ${tradesCnt?.cnt}`);
    console.log(`  alerts: ${alertsCnt?.cnt}`);
  } catch (e) {
    console.error("Count check error:", e.message);
  }

  db.close();
});
