const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const VideoAnalysis = require('../models/VideoAnalysis');
const ParkingSlot = require('../models/ParkingSlot');

class VideoAnalyzer {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = [];
    this.maxConcurrentProcessing = 2;
    this.currentProcessing = 0;
    
    // Start processing queue
    this.startQueueProcessor();
  }

  // Add video to processing queue
  async queueVideoForProcessing(analysisId, videoPath, parkingLotId, analysisType = 'full') {
    try {
      const queueItem = {
        analysisId,
        videoPath,
        parkingLotId,
        analysisType,
        queuedAt: new Date(),
        attempts: 0,
        maxAttempts: 3
      };

      this.processingQueue.push(queueItem);
      console.log(`📋 Added video analysis ${analysisId} to processing queue (position: ${this.processingQueue.length})`);

      return queueItem;
    } catch (error) {
      console.error('❌ Error queuing video for processing:', error);
      throw error;
    }
  }

  // Start the queue processor
  startQueueProcessor() {
    setInterval(async () => {
      if (this.currentProcessing < this.maxConcurrentProcessing && this.processingQueue.length > 0) {
        const queueItem = this.processingQueue.shift();
        this.processQueueItem(queueItem);
      }
    }, 5000); // Check queue every 5 seconds

    console.log('🚀 Video analyzer queue processor started');
  }

  // Process a queue item
  async processQueueItem(queueItem) {
    this.currentProcessing++;
    
    try {
      console.log(`🎬 Starting video processing for analysis ${queueItem.analysisId}`);
      await this.processVideo(
        queueItem.analysisId,
        queueItem.videoPath,
        queueItem.parkingLotId,
        queueItem.analysisType
      );
      console.log(`✅ Completed video processing for analysis ${queueItem.analysisId}`);
    } catch (error) {
      console.error(`❌ Error processing video ${queueItem.analysisId}:`, error);
      
      // Retry logic
      queueItem.attempts++;
      if (queueItem.attempts < queueItem.maxAttempts) {
        console.log(`🔄 Retrying video processing for analysis ${queueItem.analysisId} (attempt ${queueItem.attempts + 1})`);
        this.processingQueue.push(queueItem);
      } else {
        console.error(`💀 Max attempts reached for video analysis ${queueItem.analysisId}`);
        try {
          const videoAnalysis = await VideoAnalysis.findById(queueItem.analysisId);
          if (videoAnalysis) {
            await videoAnalysis.fail(`Processing failed after ${queueItem.maxAttempts} attempts: ${error.message}`);
          }
        } catch (updateError) {
          console.error('Error updating failed analysis:', updateError);
        }
      }
    } finally {
      this.currentProcessing--;
    }
  }

  // Process video using Python AI services
  async processVideo(analysisId, videoPath, parkingLotId, analysisType) {
    let videoAnalysis;
    
    try {
      // Get the analysis record and mark as processing
      videoAnalysis = await VideoAnalysis.findById(analysisId);
      if (!videoAnalysis) {
        throw new Error('Video analysis record not found');
      }

      await videoAnalysis.startProcessing();

      // Verify video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error('Video file not found');
      }

      // Get parking lot configuration and slots
      const ParkingLot = require('../models/ParkingLot');
      const parkingLot = await ParkingLot.findById(parkingLotId);
      if (!parkingLot) {
        throw new Error('Parking lot not found');
      }

      const slots = await ParkingSlot.findByLotId(parkingLotId);
      
      // Prepare slot configuration for Python script
      const slotConfig = slots.map(slot => ({
        id: slot.id,
        slot_number: slot.slot_number,
        coordinates: typeof slot.coordinates === 'string' 
          ? JSON.parse(slot.coordinates) 
          : slot.coordinates
      }));

      // Configure Python shell options
      const pythonOptions = {
        mode: 'json',
        pythonPath: process.env.PYTHON_PATH || 'python',
        scriptPath: path.join(__dirname, '../../ai-services'),
        args: [
          '--video_path', videoPath,
          '--analysis_type', analysisType,
          '--slot_config', JSON.stringify(slotConfig),
          '--parking_lot_id', parkingLotId.toString(),
          '--output_format', 'json'
        ]
      };

      console.log(`🐍 Running Python video processor for analysis ${analysisId}...`);

      // Run Python video processing script
      const results = await this.runPythonScript('video_processor.py', pythonOptions);
      
      if (!results || results.length === 0) {
        throw new Error('No results returned from Python script');
      }

      // Get the final result
      const analysisResults = results[results.length - 1];
      
      if (!analysisResults || typeof analysisResults !== 'object') {
        throw new Error('Invalid results format from Python script');
      }

      console.log(`📊 Video analysis ${analysisId} completed with ${analysisResults.slot_detections?.length || 0} slot detections`);

      // Update slot statuses based on analysis results
      if (analysisResults.slot_detections && analysisResults.slot_detections.length > 0) {
        await this.updateSlotsFromAnalysis(analysisResults.slot_detections, parkingLotId);
      }

      // Complete the analysis
      await videoAnalysis.complete(analysisResults);

      return analysisResults;
    } catch (error) {
      console.error(`❌ Video processing failed for analysis ${analysisId}:`, error);
      
      if (videoAnalysis) {
        await videoAnalysis.fail(error.message);
      }
      
      throw error;
    } finally {
      // Clean up video file
      this.cleanupVideoFile(videoPath);
    }
  }

  // Run Python script with error handling
  async runPythonScript(scriptName, options) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];

      const pyshell = new PythonShell(scriptName, options);

      pyshell.on('message', (message) => {
        try {
          if (typeof message === 'object') {
            results.push(message);
          } else {
            // Check if message looks like JSON (starts with { or [)
            const trimmedMessage = message.trim();
            if (trimmedMessage.startsWith('{') || trimmedMessage.startsWith('[')) {
              const parsed = JSON.parse(message);
              results.push(parsed);
            } else {
              // If not JSON, treat as log message
              console.log(`🐍 Python log: ${message}`);
            }
          }
        } catch (parseError) {
          // If not JSON, treat as log message
          console.log(`🐍 Python log: ${message}`);
        }
      });

      pyshell.on('stderr', (stderr) => {
        console.error(`🐍 Python stderr: ${stderr}`);
        errors.push(stderr);
      });

      pyshell.end((err, code, signal) => {
        if (err) {
          reject(new Error(`Python script failed: ${err.message}. Errors: ${errors.join(', ')}`));
        } else if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}. Errors: ${errors.join(', ')}`));
        } else {
          resolve(results);
        }
      });
    });
  }

  // Update slot statuses from analysis results
  async updateSlotsFromAnalysis(slotDetections, parkingLotId) {
    try {
      const slotUpdates = slotDetections
        .filter(detection => detection.slot_id && typeof detection.is_occupied === 'boolean')
        .map(detection => ({
          slot_id: detection.slot_id,
          is_occupied: detection.is_occupied,
          predicted_vacancy_seconds: detection.predicted_duration || 0
        }));

      if (slotUpdates.length > 0) {
        console.log(`🔄 Updating ${slotUpdates.length} slots from video analysis`);
        await ParkingSlot.bulkUpdateStatuses(slotUpdates);
      }
    } catch (error) {
      console.error('❌ Error updating slots from analysis:', error);
      throw error;
    }
  }

  // Clean up video file after processing
  cleanupVideoFile(videoPath) {
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`🗑️  Cleaned up video file: ${videoPath}`);
      }
    } catch (error) {
      console.error(`❌ Error cleaning up video file ${videoPath}:`, error);
    }
  }

  // Generate mock analysis results (for testing without Python)
  generateMockResults(slots, analysisType = 'full') {
    const mockResults = {
      video_filename: 'mock-video.mp4',
      processing_time: Math.random() * 30 + 10, // 10-40 seconds
      total_frames: Math.floor(Math.random() * 500) + 100,
      analysis_type: analysisType,
      timestamp: new Date().toISOString(),
      slot_detections: [],
      vehicle_count: 0,
      confidence_scores: {
        overall: 0.85 + Math.random() * 0.15,
        vehicle_detection: 0.90 + Math.random() * 0.10,
        slot_classification: 0.80 + Math.random() * 0.20
      }
    };

    // Generate mock detections for each slot
    slots.forEach(slot => {
      const isOccupied = Math.random() < 0.4; // 40% occupancy rate
      const confidence = 0.75 + Math.random() * 0.25;
      const predictedDuration = isOccupied ? Math.floor(Math.random() * 3600) + 300 : 0; // 5-65 minutes

      mockResults.slot_detections.push({
        slot_id: slot.id,
        slot_number: slot.slot_number,
        is_occupied: isOccupied,
        confidence: confidence,
        predicted_duration: predictedDuration,
        vehicle_type: isOccupied ? this.getRandomVehicleType() : null,
        detection_box: isOccupied ? this.generateDetectionBox(slot.coordinates) : null
      });

      if (isOccupied) {
        mockResults.vehicle_count++;
      }
    });

    return mockResults;
  }

  // Get random vehicle type for mock data
  getRandomVehicleType() {
    const types = ['car', 'suv', 'truck', 'van', 'motorcycle'];
    return types[Math.floor(Math.random() * types.length)];
  }

  // Generate detection bounding box for mock data
  generateDetectionBox(slotCoordinates) {
    if (!slotCoordinates) return null;

    const coords = typeof slotCoordinates === 'string' 
      ? JSON.parse(slotCoordinates) 
      : slotCoordinates;

    return {
      x: coords.x + Math.random() * 10 - 5,
      y: coords.y + Math.random() * 10 - 5,
      width: coords.width * (0.8 + Math.random() * 0.4),
      height: coords.height * (0.8 + Math.random() * 0.4)
    };
  }

  // Process video with mock results (for testing)
  async processVideoMock(analysisId, videoPath, parkingLotId, analysisType) {
    try {
      console.log(`🎭 Processing video ${analysisId} with mock results...`);

      const videoAnalysis = await VideoAnalysis.findById(analysisId);
      if (!videoAnalysis) {
        throw new Error('Video analysis record not found');
      }

      await videoAnalysis.startProcessing();

      // Get slots for this parking lot
      const slots = await ParkingSlot.findByLotId(parkingLotId);
      
      // Generate mock results
      const mockResults = this.generateMockResults(slots, analysisType);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // Update slot statuses
      if (mockResults.slot_detections && mockResults.slot_detections.length > 0) {
        await this.updateSlotsFromAnalysis(mockResults.slot_detections, parkingLotId);
      }

      // Complete the analysis
      await videoAnalysis.complete(mockResults);

      console.log(`✅ Mock video analysis ${analysisId} completed`);
      return mockResults;
    } catch (error) {
      console.error(`❌ Mock video processing failed for analysis ${analysisId}:`, error);
      
      const videoAnalysis = await VideoAnalysis.findById(analysisId);
      if (videoAnalysis) {
        await videoAnalysis.fail(error.message);
      }
      
      throw error;
    } finally {
      this.cleanupVideoFile(videoPath);
    }
  }

  // Get processing queue status
  getQueueStatus() {
    return {
      queue_length: this.processingQueue.length,
      current_processing: this.currentProcessing,
      max_concurrent: this.maxConcurrentProcessing,
      queue_items: this.processingQueue.map(item => ({
        analysis_id: item.analysisId,
        parking_lot_id: item.parkingLotId,
        analysis_type: item.analysisType,
        queued_at: item.queuedAt,
        attempts: item.attempts
      }))
    };
  }

  // Clear processing queue
  clearQueue() {
    const clearedCount = this.processingQueue.length;
    this.processingQueue = [];
    console.log(`🗑️  Cleared ${clearedCount} items from processing queue`);
    return clearedCount;
  }

  // Set max concurrent processing
  setMaxConcurrentProcessing(max) {
    this.maxConcurrentProcessing = Math.max(1, Math.min(max, 5)); // Limit between 1-5
    console.log(`⚙️  Set max concurrent processing to ${this.maxConcurrentProcessing}`);
  }
}

module.exports = VideoAnalyzer;
