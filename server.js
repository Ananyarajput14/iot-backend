const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const sendSMS = require("./sms");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
require("dotenv").config();

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

  // check if person already has a record today
  const existing = attendanceLog.find(
    r => r.name === name && r.date === date
  );

  if (existing) {
    // second recognition = clock out
    if (!existing.clockOut) {
      existing.clockOut = time;
      existing.status   = "completed";
      console.log(`Clock OUT: ${name} at ${time}`);

      io.emit("attendanceUpdate", {
        record:     existing,
        allRecords: attendanceLog,
        type:       "clockout"
      });

      return res.json({ success:true, type:"clockout", record:existing });
    } else {
      // already has both clock in and out
      console.log(`Already completed: ${name}`);
      return res.json({ message:"Already completed", record:existing });
    }
  }

  // first recognition = clock in
  const record = {
    name,
    date,
    clockIn:  time,
    clockOut: null,
    status:   "present"
  };

  attendanceLog.push(record);
  console.log(`Clock IN: ${name} at ${time}`);

  io.emit("attendanceUpdate", {
    record,
    allRecords: attendanceLog,
    type:       "clockin"
  });

  res.json({ success:true, type:"clockin", record });
});

app.get("/attendance", (req, res) => {
  res.json(attendanceLog);
});

app.delete("/attendance", (req, res) => {
  attendanceLog = [];
  io.emit("attendanceUpdate", { record:null, allRecords:[], type:"clear" });
  console.log("Attendance cleared");
  res.json({ success:true });
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

// ── bed stats ──
let bedStats = { total:0, occupied:0, empty:0, time:null, date:null };

app.post("/beds", (req, res) => {
  const { total, occupied, empty, time, date } = req.body;
  bedStats = { total, occupied, empty, time, date };
  console.log(`Beds — Total:${total} Occupied:${occupied} Empty:${empty}`);
  io.emit("bedUpdate", bedStats);
  res.json({ success:true });
});

app.get("/beds", (req, res) => {
  res.json(bedStats);
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

console.log("ENV CHECK:", {
  SID: process.env.TWILIO_SID,
  AUTH: process.env.TWILIO_AUTH,
  FROM: process.env.TWILIO_PHONE,
  TO: process.env.ALERT_PHONE
});

//SMS Alert Function
let alertSent = false;

parser.on("data", async(data) => {
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
  if ((isTempAlert || isFireAlert) && !alertSent) {
    console.log("Sending SMS...");

    let msg = "?? HOSPITAL ALERT:\n";
    if (isTempAlert) msg += "?? High Temp/Humidity\n";
    if (isFireAlert) msg += "?? Fire Detected\n";

    await sendSMS(msg);
    alertSent = true;
}

if (!isTempAlert && !isFireAlert) {
    alertSent = false;
}

});

app.post("/test-alert", async (req, res) => {

  const { tempAlert, fireAlert } = req.body;

  io.emit("hospitalAlert", { tempAlert, fireAlert });

  if (tempAlert || fireAlert) {
    console.log("Sending SMS...");

    let msg = "🚨 HOSPITAL ALERT:\n";
    if (tempAlert) msg += "🔥 High Temp/Humidity\n";
    if (fireAlert) msg += "🔥 Fire Detected\n";

    await sendSMS(msg);
  }

  res.json({ success: true });
});

// ── Start Server ──
const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});