const express = require('express');
const router = express.Router();
const ParkingController = require('../controllers/parkingController');

// Get all parking lots
router.get('/lots', ParkingController.getAllParkingLots);

// Get parking lot status with all slots
router.get('/status/:lotId', ParkingController.getParkingStatus);

// Get available slots for a parking lot
router.get('/available-slots/:lotId', ParkingController.getAvailableSlots);

// Get occupied slots for a parking lot
router.get('/occupied-slots/:lotId', ParkingController.getOccupiedSlots);

// Book a parking slot
router.post('/book-slot', ParkingController.bookSlot);

// Release a parking slot
router.post('/release-slot/:slotId', ParkingController.releaseSlot);

// Update slot status (for AI system)
router.put('/slot-status/:slotId', ParkingController.updateSlotStatus);

// Bulk update slot statuses (for video analysis results)
router.put('/bulk-update-slots/:lotId', ParkingController.bulkUpdateSlots);

// Get slot details with booking history
router.get('/slot-details/:slotId', ParkingController.getSlotDetails);

// Update slot durations (called periodically for occupied slots)
router.post('/update-durations/:lotId', ParkingController.updateSlotDurations);

module.exports = router;
