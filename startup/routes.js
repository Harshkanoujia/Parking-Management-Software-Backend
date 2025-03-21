require("express-async-errors");
const express = require('express');
const reqLogger = require('../startup/logger');

// Routes
const user = require('../routes/users');
const admin = require('../routes/admins');
const vehicle = require('../routes/vehicles');
const booking = require('../routes/bookings');
const manager  = require('../routes/managers');
const adminAuth = require('../routes/adminAuth');
const parkingArea = require('../routes/parkingAreas');
const parkingSlot = require('../routes/parkingSlots');
const parkingSpot = require('../routes/parkingSpots');

// Error Handling
const error = require('../middleware/error');


module.exports = function (app) {
    app.use(express.json());
    app.use(reqLogger);

    app.use('/api/users', user);
    app.use('/api/admins', admin);
    app.use('/api/vehicles', vehicle);
    app.use('/api/bookings', booking);
    app.use('/api/managers', manager);
    app.use('/api/auth/admin', adminAuth);
    app.use('/api/parking-areas', parkingArea);
    app.use('/api/parking-slots', parkingSlot);
    app.use('/api/parking-spots', parkingSpot);

    app.use(error);
}