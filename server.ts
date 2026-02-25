import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    punch_in DATETIME,
    punch_out DATETIME,
    status TEXT CHECK(status IN ('present', 'late', 'half-day', 'absent', 'absent_pending_reason')),
    total_hours REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    read_status INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed Admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)")
    .run("Admin User", "admin@company.com", hash, "admin", "Management");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    next();
  };

  // Auth Routes
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  });

  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, department } = req.body;
    try {
      const hash = bcrypt.hashSync(password, 10);
      const result = db.prepare("INSERT INTO users (name, email, password_hash, department) VALUES (?, ?, ?, ?)")
        .run(name, email, hash, department);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  // Attendance Routes
  app.get("/api/attendance/today", authenticate, (req: any, res) => {
    const today = new Date().toISOString().split('T')[0];
    const record = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(req.user.id, today);
    res.json(record || null);
  });

  app.post("/api/attendance/punch-in", authenticate, (req: any, res) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    // Check if already punched in
    const existing = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(req.user.id, today);
    if (existing) return res.status(400).json({ error: "Already punched in today" });

    // Determine status (Late if after 9:30 AM)
    const punchTime = new Date();
    const lateTime = new Date();
    lateTime.setHours(9, 30, 0);
    const status = punchTime > lateTime ? 'late' : 'present';

    db.prepare("INSERT INTO attendance (user_id, date, punch_in, status) VALUES (?, ?, ?, ?)")
      .run(req.user.id, today, now, status);
    
    res.json({ success: true, status });
  });

  app.post("/api/attendance/punch-out", authenticate, (req: any, res) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    const record = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(req.user.id, today) as any;
    if (!record || !record.punch_in) return res.status(400).json({ error: "No punch-in record found" });
    if (record.punch_out) return res.status(400).json({ error: "Already punched out" });

    const punchIn = new Date(record.punch_in);
    const punchOut = new Date(now);
    const diffMs = punchOut.getTime() - punchIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);

    db.prepare("UPDATE attendance SET punch_out = ?, total_hours = ? WHERE id = ?")
      .run(now, hours.toFixed(2), record.id);
    
    res.json({ success: true, hours: hours.toFixed(2) });
  });

  app.get("/api/attendance/history", authenticate, (req: any, res) => {
    const history = db.prepare("SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 30").all(req.user.id);
    res.json(history);
  });

  // Leave Routes
  app.post("/api/leaves", authenticate, (req: any, res) => {
    const { type, startDate, endDate, reason } = req.body;
    db.prepare("INSERT INTO leaves (user_id, type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)")
      .run(req.user.id, type, startDate, endDate, reason);
    
    // Notify Admin
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[];
    admins.forEach(admin => {
      db.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)")
        .run(admin.id, `New leave request from ${req.user.name}`);
    });

    res.json({ success: true });
  });

  app.get("/api/leaves/my", authenticate, (req: any, res) => {
    const leaves = db.prepare("SELECT * FROM leaves WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(leaves);
  });

  // Admin Routes
  app.get("/api/admin/employees", authenticate, isAdmin, (req, res) => {
    const employees = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.created_at,
      (SELECT SUM(total_hours) FROM attendance WHERE user_id = u.id AND strftime('%m', date) = strftime('%m', 'now')) as monthly_hours
      FROM users u
    `).all();
    res.json(employees);
  });

  app.get("/api/admin/attendance/today", authenticate, isAdmin, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const attendance = db.prepare(`
      SELECT a.*, u.name, u.department 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.date = ?
    `).all(today);
    res.json(attendance);
  });

  app.get("/api/admin/leaves/pending", authenticate, isAdmin, (req, res) => {
    const leaves = db.prepare(`
      SELECT l.*, u.name, u.department 
      FROM leaves l 
      JOIN users u ON l.user_id = u.id 
      WHERE l.status = 'pending'
    `).all();
    res.json(leaves);
  });

  app.post("/api/admin/leaves/:id/status", authenticate, isAdmin, (req: any, res) => {
    const { status, comment } = req.body;
    const { id } = req.params;
    db.prepare("UPDATE leaves SET status = ?, admin_comment = ? WHERE id = ?")
      .run(status, comment, id);
    
    const leave = db.prepare("SELECT user_id FROM leaves WHERE id = ?").get(id) as any;
    db.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)")
      .run(leave.user_id, `Your leave request has been ${status}`);

    res.json({ success: true });
  });

  app.get("/api/admin/stats", authenticate, isAdmin, (req, res) => {
    const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'employee'").get() as any;
    const today = new Date().toISOString().split('T')[0];
    const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status IN ('present', 'late')").get(today) as any;
    const onLeaveToday = db.prepare("SELECT COUNT(*) as count FROM leaves WHERE ? BETWEEN start_date AND end_date AND status = 'approved'").get(today) as any;
    
    // Monthly trends (last 7 days)
    const trends = db.prepare(`
      SELECT date, COUNT(*) as count 
      FROM attendance 
      WHERE date >= date('now', '-7 days') 
      GROUP BY date
    `).all();

    res.json({
      totalEmployees: totalEmployees.count,
      presentToday: presentToday.count,
      onLeaveToday: onLeaveToday.count,
      trends
    });
  });

  // Notifications
  app.get("/api/notifications", authenticate, (req: any, res) => {
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/read", authenticate, (req: any, res) => {
    db.prepare("UPDATE notifications SET read_status = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ success: true });
  });

  // Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
