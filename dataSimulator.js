

function generatePatientRoomData() {
    return {
        temperature: (24 + Math.random() * 4).toFixed(2),
        humidity: (45 + Math.random() * 20).toFixed(2),
        light: Math.floor(200 + Math.random() * 200),
        smoke: Math.floor(180 + Math.random() * 80),
        fire: Math.random() > 0.95 ? 1 : 0,
        time: new Date().toLocaleTimeString()
    };
}

function generateSecurityData() {
    return {
        smoke: Math.floor(180 + Math.random() * 100),
        flame: Math.random() > 0.97 ? 1 : 0,
        linkStatus: Math.random() > 0.05 ? 1 : 0,
        temperature: (25 + Math.random() * 3).toFixed(2),
        humidity: (50 + Math.random() * 10).toFixed(2),
        time: new Date().toLocaleTimeString()
    };
}

function generateFrontDeskData() {
    return {
        doctorsPresent: Math.floor(5 + Math.random() * 5),
        nursesPresent: Math.floor(10 + Math.random() * 10),
        attendanceRate: Math.floor(80 + Math.random() * 20),
        time: new Date().toLocaleTimeString()
    };
}

function generateWardData() {
    const totalBeds = 50;
    const occupiedBeds = Math.floor(20 + Math.random() * 25);

    return {
        totalBeds,
        occupiedBeds,
        availableBeds: totalBeds - occupiedBeds,
        time: new Date().toLocaleTimeString()
    };
}

module.exports = {
    generatePatientRoomData,
    generateSecurityData,
    generateFrontDeskData,
    generateWardData
};