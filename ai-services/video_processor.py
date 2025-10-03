#!/usr/bin/env python3
"""
AI Parking System - Video Processor
Processes parking lot videos to detect vehicle occupancy using YOLO
"""

import cv2
import numpy as np
import json
import argparse
import sys
import os
from pathlib import Path
from datetime import datetime
import time
from typing import List, Dict, Tuple, Optional

# Import custom modules
from parking_detector import ParkingDetector
from utils import setup_logging, validate_video_file, parse_slot_config

# Setup logging
logger = setup_logging(__name__)

class VideoProcessor:
    """Main video processing class for parking lot analysis"""
    
    def __init__(self, model_path: Optional[str] = None):
        """Initialize video processor with YOLO model"""
        self.detector = ParkingDetector(model_path)
        self.processing_stats = {
            'total_frames': 0,
            'processed_frames': 0,
            'detection_time': 0,
            'start_time': None,
            'end_time': None
        }
        
    def process_video(self, 
                     video_path: str, 
                     slot_config: List[Dict], 
                     analysis_type: str = 'full',
                     output_format: str = 'json') -> Dict:
        """
        Process video file to detect parking slot occupancy
        
        Args:
            video_path: Path to video file
            slot_config: List of parking slot configurations
            analysis_type: Type of analysis ('occupancy', 'duration', 'full')
            output_format: Output format ('json', 'csv')
            
        Returns:
            Dictionary containing analysis results
        """
        logger.info(f"Starting video processing: {video_path}")
        logger.info(f"Analysis type: {analysis_type}")
        logger.info(f"Slot configuration: {len(slot_config)} slots")
        
        # Validate inputs
        if not validate_video_file(video_path):
            raise ValueError(f"Invalid video file: {video_path}")
            
        if not slot_config:
            raise ValueError("Slot configuration is required")
        
        # Initialize video capture
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        logger.info(f"Video properties: {total_frames} frames, {fps} FPS, {duration:.1f}s duration")
        
        # Initialize processing
        self.processing_stats['total_frames'] = total_frames
        self.processing_stats['start_time'] = time.time()
        
        # Process video based on analysis type
        if analysis_type == 'occupancy':
            results = self._process_occupancy_analysis(cap, slot_config)
        elif analysis_type == 'duration':
            results = self._process_duration_analysis(cap, slot_config)
        else:  # full analysis
            results = self._process_full_analysis(cap, slot_config)
        
        # Cleanup
        cap.release()
        self.processing_stats['end_time'] = time.time()
        
        # Compile final results
        final_results = {
            'video_filename': os.path.basename(video_path),
            'processing_time': self.processing_stats['end_time'] - self.processing_stats['start_time'],
            'total_frames': total_frames,
            'processed_frames': self.processing_stats['processed_frames'],
            'fps': fps,
            'duration': duration,
            'analysis_type': analysis_type,
            'timestamp': datetime.now().isoformat(),
            'slot_detections': results['slot_detections'],
            'vehicle_count': results['vehicle_count'],
            'occupancy_rate': results['occupancy_rate'],
            'confidence_scores': results['confidence_scores'],
            'processing_stats': self.processing_stats
        }
        
        logger.info(f"Processing completed: {final_results['processing_time']:.2f}s")
        logger.info(f"Vehicle count: {final_results['vehicle_count']}")
        logger.info(f"Occupancy rate: {final_results['occupancy_rate']:.1f}%")
        
        return final_results
    
    def _process_occupancy_analysis(self, cap: cv2.VideoCapture, slot_config: List[Dict]) -> Dict:
        """Process video for occupancy detection only"""
        logger.info("Processing occupancy analysis...")
        
        # Sample frames for analysis (every 30 frames for efficiency)
        frame_interval = 30
        slot_detections = []
        vehicle_count = 0
        confidence_scores = []
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                # Detect vehicles in current frame
                detections = self.detector.detect_vehicles(frame)
                
                # Analyze each parking slot
                for slot in slot_config:
                    slot_result = self._analyze_slot_occupancy(
                        frame, slot, detections
                    )
                    
                    # Check if this slot already has a detection
                    existing_slot = next(
                        (s for s in slot_detections if s['slot_id'] == slot['id']), 
                        None
                    )
                    
                    if existing_slot:
                        # Update with higher confidence detection
                        if slot_result['confidence'] > existing_slot['confidence']:
                            existing_slot.update(slot_result)
                    else:
                        slot_detections.append(slot_result)
                
                self.processing_stats['processed_frames'] += 1
                
            frame_count += 1
        
        # Calculate final statistics
        occupied_slots = sum(1 for slot in slot_detections if slot['is_occupied'])
        occupancy_rate = (occupied_slots / len(slot_config)) * 100 if slot_config else 0
        
        # Calculate average confidence
        confidences = [slot['confidence'] for slot in slot_detections]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        return {
            'slot_detections': slot_detections,
            'vehicle_count': occupied_slots,
            'occupancy_rate': occupancy_rate,
            'confidence_scores': {
                'overall': avg_confidence,
                'vehicle_detection': avg_confidence,
                'slot_classification': avg_confidence
            }
        }
    
    def _process_duration_analysis(self, cap: cv2.VideoCapture, slot_config: List[Dict]) -> Dict:
        """Process video for duration prediction analysis"""
        logger.info("Processing duration analysis...")
        
        # Track slot occupancy over time
        slot_timeline = {slot['id']: [] for slot in slot_config}
        frame_interval = 15  # Process every 15 frames
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                detections = self.detector.detect_vehicles(frame)
                
                for slot in slot_config:
                    slot_result = self._analyze_slot_occupancy(frame, slot, detections)
                    slot_timeline[slot['id']].append({
                        'frame': frame_count,
                        'is_occupied': slot_result['is_occupied'],
                        'confidence': slot_result['confidence']
                    })
                
                self.processing_stats['processed_frames'] += 1
                
            frame_count += 1
        
        # Analyze duration patterns
        slot_detections = []
        for slot in slot_config:
            duration_analysis = self._analyze_slot_duration(slot_timeline[slot['id']])
            slot_detections.append({
                'slot_id': slot['id'],
                'slot_number': slot['slot_number'],
                'is_occupied': duration_analysis['final_status'],
                'confidence': duration_analysis['confidence'],
                'predicted_duration': duration_analysis['predicted_duration'],
                'occupancy_changes': duration_analysis['changes'],
                'stability_score': duration_analysis['stability']
            })
        
        occupied_slots = sum(1 for slot in slot_detections if slot['is_occupied'])
        occupancy_rate = (occupied_slots / len(slot_config)) * 100 if slot_config else 0
        
        return {
            'slot_detections': slot_detections,
            'vehicle_count': occupied_slots,
            'occupancy_rate': occupancy_rate,
            'confidence_scores': {
                'overall': sum(s['confidence'] for s in slot_detections) / len(slot_detections),
                'vehicle_detection': 0.85,
                'slot_classification': 0.80
            }
        }
    
    def _process_full_analysis(self, cap: cv2.VideoCapture, slot_config: List[Dict]) -> Dict:
        """Process video for comprehensive analysis"""
        logger.info("Processing full analysis...")
        
        # Combine occupancy and duration analysis
        occupancy_results = self._process_occupancy_analysis(cap, slot_config)
        
        # Reset video capture for duration analysis
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        duration_results = self._process_duration_analysis(cap, slot_config)
        
        # Merge results
        final_detections = []
        for i, slot in enumerate(slot_config):
            occupancy_data = occupancy_results['slot_detections'][i]
            duration_data = duration_results['slot_detections'][i]
            
            final_detections.append({
                'slot_id': slot['id'],
                'slot_number': slot['slot_number'],
                'is_occupied': occupancy_data['is_occupied'],
                'confidence': max(occupancy_data['confidence'], duration_data['confidence']),
                'predicted_duration': duration_data.get('predicted_duration', 1800),
                'vehicle_type': occupancy_data.get('vehicle_type', 'unknown'),
                'detection_box': occupancy_data.get('detection_box'),
                'stability_score': duration_data.get('stability_score', 0.5)
            })
        
        occupied_slots = sum(1 for slot in final_detections if slot['is_occupied'])
        occupancy_rate = (occupied_slots / len(slot_config)) * 100 if slot_config else 0
        
        return {
            'slot_detections': final_detections,
            'vehicle_count': occupied_slots,
            'occupancy_rate': occupancy_rate,
            'confidence_scores': {
                'overall': (occupancy_results['confidence_scores']['overall'] + 
                           duration_results['confidence_scores']['overall']) / 2,
                'vehicle_detection': 0.88,
                'slot_classification': 0.82
            }
        }
    
    def _analyze_slot_occupancy(self, frame: np.ndarray, slot: Dict, detections: List) -> Dict:
        """Analyze occupancy for a single parking slot"""
        slot_coords = slot['coordinates']
        
        # Extract slot region
        x, y, w, h = slot_coords['x'], slot_coords['y'], slot_coords['width'], slot_coords['height']
        slot_region = frame[int(y):int(y+h), int(x):int(x+w)]
        
        # Check for vehicle detections in slot area
        is_occupied = False
        best_confidence = 0.0
        vehicle_type = None
        detection_box = None
        
        for detection in detections:
            det_x, det_y, det_w, det_h = detection['bbox']
            det_confidence = detection['confidence']
            
            # Calculate overlap with slot
            overlap = self._calculate_overlap(
                (x, y, w, h), 
                (det_x, det_y, det_w, det_h)
            )
            
            # If significant overlap (>50%), consider slot occupied
            if overlap > 0.5 and det_confidence > best_confidence:
                is_occupied = True
                best_confidence = det_confidence
                vehicle_type = detection.get('class', 'vehicle')
                detection_box = detection['bbox']
        
        # If no vehicle detection, use image analysis
        if not is_occupied:
            occupancy_score = self._analyze_slot_image(slot_region)
            is_occupied = occupancy_score > 0.6
            best_confidence = occupancy_score
        
        return {
            'slot_id': slot['id'],
            'slot_number': slot['slot_number'],
            'is_occupied': is_occupied,
            'confidence': best_confidence,
            'vehicle_type': vehicle_type,
            'detection_box': detection_box
        }
    
    def _analyze_slot_duration(self, timeline: List[Dict]) -> Dict:
        """Analyze slot occupancy timeline to predict duration"""
        if not timeline:
            return {
                'final_status': False,
                'confidence': 0.5,
                'predicted_duration': 1800,
                'changes': 0,
                'stability': 0.0
            }
        
        # Count occupancy changes
        changes = 0
        prev_status = timeline[0]['is_occupied']
        
        for entry in timeline[1:]:
            if entry['is_occupied'] != prev_status:
                changes += 1
                prev_status = entry['is_occupied']
        
        # Calculate stability (fewer changes = more stable)
        stability = max(0, 1 - (changes / len(timeline)))
        
        # Determine final status (majority vote)
        occupied_count = sum(1 for entry in timeline if entry['is_occupied'])
        final_status = occupied_count > len(timeline) / 2
        
        # Predict duration based on patterns
        if final_status:
            # If occupied, predict based on stability and historical patterns
            base_duration = 1800  # 30 minutes base
            if stability > 0.8:
                predicted_duration = base_duration * 2  # More stable = longer stay
            else:
                predicted_duration = base_duration
        else:
            predicted_duration = 0
        
        # Calculate average confidence
        avg_confidence = sum(entry['confidence'] for entry in timeline) / len(timeline)
        
        return {
            'final_status': final_status,
            'confidence': avg_confidence * stability,  # Adjust confidence by stability
            'predicted_duration': int(predicted_duration),
            'changes': changes,
            'stability': stability
        }
    
    def _calculate_overlap(self, box1: Tuple, box2: Tuple) -> float:
        """Calculate overlap ratio between two bounding boxes"""
        x1, y1, w1, h1 = box1
        x2, y2, w2, h2 = box2
        
        # Calculate intersection
        left = max(x1, x2)
        top = max(y1, y2)
        right = min(x1 + w1, x2 + w2)
        bottom = min(y1 + h1, y2 + h2)
        
        if left < right and top < bottom:
            intersection = (right - left) * (bottom - top)
            area1 = w1 * h1
            area2 = w2 * h2
            union = area1 + area2 - intersection
            
            return intersection / union if union > 0 else 0
        
        return 0
    
    def _analyze_slot_image(self, slot_image: np.ndarray) -> float:
        """Analyze slot image to determine occupancy using image processing"""
        if slot_image.size == 0:
            return 0.0
        
        # Convert to grayscale
        gray = cv2.cvtColor(slot_image, cv2.COLOR_BGR2GRAY)
        
        # Calculate various features
        # 1. Edge density (vehicles have more edges)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        # 2. Variance (vehicles create more texture variation)
        variance = np.var(gray)
        
        # 3. Mean intensity (vehicles are typically darker than empty asphalt)
        mean_intensity = np.mean(gray)
        
        # Combine features into occupancy score
        occupancy_score = (
            edge_density * 0.4 +
            min(variance / 1000, 1.0) * 0.3 +
            (1 - mean_intensity / 255) * 0.3
        )
        
        return min(occupancy_score, 1.0)

def main():
    """Main function for command line usage"""
    parser = argparse.ArgumentParser(description='AI Parking System Video Processor')
    parser.add_argument('--video_path', required=True, help='Path to video file')
    parser.add_argument('--slot_config', required=True, help='JSON string of slot configuration')
    parser.add_argument('--analysis_type', default='full', choices=['occupancy', 'duration', 'full'],
                       help='Type of analysis to perform')
    parser.add_argument('--output_format', default='json', choices=['json', 'csv'],
                       help='Output format')
    parser.add_argument('--model_path', help='Path to custom YOLO model')
    parser.add_argument('--parking_lot_id', type=int, help='Parking lot ID')
    
    args = parser.parse_args()
    
    try:
        # Parse slot configuration
        slot_config = parse_slot_config(args.slot_config)
        
        # Initialize processor
        processor = VideoProcessor(args.model_path)
        
        # Process video
        results = processor.process_video(
            video_path=args.video_path,
            slot_config=slot_config,
            analysis_type=args.analysis_type,
            output_format=args.output_format
        )
        
        # Output results
        if args.output_format == 'json':
            # Ensure numpy types (np.bool_, np.int32, np.float32, etc.) are JSON serializable
            def _json_default(o):
                try:
                    import numpy as _np  # local import to avoid hard dependency naming
                    if isinstance(o, _np.bool_):
                        return bool(o)
                    if isinstance(o, _np.integer):
                        return int(o)
                    if isinstance(o, _np.floating):
                        return float(o)
                except Exception:
                    pass
                # Fallbacks
                if hasattr(o, '__float__'):
                    return float(o)
                if hasattr(o, '__int__'):
                    return int(o)
                if hasattr(o, '__dict__'):
                    return o.__dict__
                return str(o)

            print(json.dumps(results, default=_json_default))
        else:
            # CSV output would be implemented here
            print("CSV output not implemented yet")
            
    except Exception as e:
        logger.error(f"Video processing failed: {str(e)}")
        error_result = {
            'error': str(e),
            'video_filename': os.path.basename(args.video_path) if args.video_path else 'unknown',
            'timestamp': datetime.now().isoformat(),
            'success': False
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
