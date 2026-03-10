const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const {
    generatePatientRoomData,
    generateSecurityData,
    generateFrontDeskData,
    generateWardData
} = require("./dataSimulator");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
})
app.get("/", (req, res) => {
    res.send("Smart Hospital IoT Backend Running");
});

io.on("connection", (socket) => {

    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });

});

setInterval(() => {

    const patientRoom = generatePatientRoomData();
    const security = generateSecurityData();
    const frontDesk = generateFrontDeskData();
    const ward = generateWardData();

    io.emit("hospitalData", {
        patientRoom,
        security,
        frontDesk,
        ward
    });

}, 2000);


const PORT = 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});