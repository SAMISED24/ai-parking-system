const express = require('express');
const router = express.Router();
const VideoController = require('../controllers/videoController');

// Upload video and start analysis
router.post('/upload', VideoController.uploadVideo, VideoController.handleVideoUpload);

// Get analysis results
router.get('/analysis/:analysisId', VideoController.getAnalysisResults);

// Get all analyses for a parking lot
router.get('/lot-analyses/:lotId', VideoController.getLotAnalyses);

// Get processing queue status
router.get('/processing-queue', VideoController.getProcessingQueue);

// Cancel video analysis
router.post('/cancel-analysis/:analysisId', VideoController.cancelAnalysis);

// Get recent analyses across all lots
router.get('/recent-analyses', VideoController.getRecentAnalyses);

// Delete analysis record
router.delete('/analysis/:analysisId', VideoController.deleteAnalysis);

// Test video processing with mock data
router.post('/test-processing/:lotId', VideoController.testVideoProcessing);

module.exports = router;
