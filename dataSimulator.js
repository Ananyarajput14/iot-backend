const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

app.get("/", (req, res) => {
    res.send("Smart Hospital IoT Backend Running");
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
});


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

    console.log("Bluetooth Data:", data);

    let temperature = null;
    let humidity = null;
    let alert = false;

    
    if (data.includes("ALERT")) {
        alert = true;
    }

    
    const tempMatch = data.match(/Temp:\s*([0-9.]+)/);
    const humMatch = data.match(/Humidity:\s*([0-9.]+)/);

    if (tempMatch && humMatch) {
        temperature = parseFloat(tempMatch[1]);
        humidity = parseFloat(humMatch[1]);

        const hospitalData = {
            patientRoom: {
                temperature,
                humidity,
                alert,
                time: new Date().toLocaleTimeString()
            }
        };

        io.emit("hospitalData", hospitalData);
    }

});



const PORT = 5001;

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});