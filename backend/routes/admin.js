const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');

// Authentication routes
router.post('/login', AdminController.login);
router.post('/create-user', AdminController.createUser);

// Parking lot management
router.post('/parking-lots', AdminController.createParkingLot);
router.put('/parking-lots/:lotId', AdminController.updateParkingLot);
router.delete('/parking-lots/:lotId', AdminController.deleteParkingLot);

// Analytics routes
router.get('/analytics/system', AdminController.getSystemAnalytics);
router.get('/analytics/parking-lot/:lotId', AdminController.getParkingLotAnalytics);

// System configuration
router.get('/configuration', AdminController.getSystemConfiguration);
router.put('/configuration', AdminController.updateSystemConfiguration);

// User management
router.get('/users', AdminController.getAllUsers);
router.put('/users/:userId', AdminController.updateUser);
router.delete('/users/:userId', AdminController.deleteUser);

// Reports
router.get('/reports', AdminController.generateSystemReport);

module.exports = router;
