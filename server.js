const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// ── in-memory attendance store ──
let attendanceLog = [];

// ── Routes ──
app.get("/", (req, res) => {
  res.send("Smart Hospital IoT Backend Running");
});

// Pi posts here when face is recognised
app.post("/attendance", (req, res) => {
  const { name, time, date, status } = req.body;

  if (!name) return res.status(400).json({ error: "Name required" });

  // prevent duplicate clock-ins same person same day
  const duplicate = attendanceLog.find(
    r => r.name === name && r.date === date
  );

  if (duplicate) {
    console.log(`Already clocked in: ${name}`);
    return res.json({ message: "Already clocked in", record: duplicate });
  }

  const record = { name, time, date, status: status || "present" };
  attendanceLog.push(record);

  console.log(`Attendance marked: ${name} at ${time}`);

  // push to all connected frontend clients instantly
  io.emit("attendanceUpdate", {
    record,
    allRecords: attendanceLog
  });

  res.json({ success: true, record });
});

// frontend fetches full log on page load
app.get("/attendance", (req, res) => {
  res.json(attendanceLog);
});

// ── motion log ──
let motionLog = [];

// Pi posts here when movement is detected
app.post("/motion", (req, res) => {
  const { detected, type, label, time, date } = req.body;

  const record = { detected, type, label, time, date };
  motionLog.push(record);

  if (motionLog.length > 50) {
    motionLog = motionLog.slice(motionLog.length - 50);
  }

  console.log(`Motion: ${label} at ${time}`);

  io.emit("motionUpdate", {
    record,
    allRecords: motionLog
  });

  res.json({ success: true, record });
});

// frontend fetches full motion log
app.get("/motion", (req, res) => {
  res.json(motionLog);
});

// clear motion log
app.delete("/motion", (req, res) => {
  motionLog = [];
  io.emit("motionUpdate", { record: null, allRecords: [] });
  res.json({ success: true });
});

// ── Socket ──
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // send existing attendance log to newly connected client
  socket.emit("attendanceUpdate", {
    record: null,
    allRecords: attendanceLog
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ── Bluetooth Serial ──
const port = new SerialPort({
  path: "COM5",
  baudRate: 9600
});

port.on("open", () => {
  console.log("Bluetooth serial port opened");
});

port.on("error", (err) => {
  console.log("Serial error:", err.message);
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

parser.on("data", (data) => {
  const clean = data.trim();
  console.log("Bluetooth Data:", clean);

  const tempMatch = clean.match(/Temp:\s*([0-9.]+)\s*F/);
  const humMatch  = clean.match(/Humidity:\s*([0-9.]+)/);

  const isTempAlert = clean.includes("HIGH TEMP OR HUMIDITY");
  const isFireAlert = clean.includes("FIRE DETECTED");

  if (tempMatch && humMatch) {
    io.emit("hospitalData", {
      patientRoom: {
        temperature: parseFloat(tempMatch[1]),
        humidity:    parseFloat(humMatch[1]),
        time: new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })
      }
    });
  }

  if (isTempAlert || isFireAlert) {
    io.emit("hospitalAlert", {
      tempAlert: isTempAlert,
      fireAlert: isFireAlert,
    });
  }
});

// ── Start Server ──
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});