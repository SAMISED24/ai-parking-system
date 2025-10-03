#!/usr/bin/env python3
"""
AI Parking System - Parking Detector
YOLO-based vehicle detection for parking lot analysis
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
import os
from pathlib import Path

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("Warning: ultralytics not available, using mock detection")

from utils import setup_logging

logger = setup_logging(__name__)

class ParkingDetector:
    """YOLO-based vehicle detector for parking lot analysis"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize parking detector with YOLO model
        
        Args:
            model_path: Path to custom YOLO model, if None uses default YOLOv8
        """
        self.model = None
        self.model_path = model_path
        self.confidence_threshold = 0.5
        self.nms_threshold = 0.4
        
        # Vehicle class IDs in COCO dataset
        self.vehicle_classes = {
            2: 'car',
            3: 'motorcycle', 
            5: 'bus',
            7: 'truck'
        }
        
        self._load_model()
        
    def _load_model(self):
        """Load YOLO model"""
        try:
            if YOLO_AVAILABLE:
                if self.model_path and os.path.exists(self.model_path):
                    logger.info(f"Loading custom YOLO model: {self.model_path}")
                    self.model = YOLO(self.model_path)
                else:
                    logger.info("Loading default YOLOv8n model")
                    # Suppress download progress output
                    import sys
                    from contextlib import redirect_stdout, redirect_stderr
                    from io import StringIO
                    
                    # Redirect stdout and stderr to suppress download progress
                    old_stdout = sys.stdout
                    old_stderr = sys.stderr
                    sys.stdout = StringIO()
                    sys.stderr = StringIO()
                    
                    try:
                        self.model = YOLO('yolov8n.pt')  # Lightweight model
                    finally:
                        # Restore stdout and stderr
                        sys.stdout = old_stdout
                        sys.stderr = old_stderr
                    
                logger.info("YOLO model loaded successfully")
            else:
                logger.warning("YOLO not available, using mock detector")
                self.model = None
                
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {str(e)}")
            self.model = None
    
    def detect_vehicles(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect vehicles in a frame
        
        Args:
            frame: Input image frame
            
        Returns:
            List of detection dictionaries with bbox, confidence, class
        """
        if self.model is None:
            return self._mock_detect_vehicles(frame)
        
        try:
            # Run YOLO inference
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)
            
            detections = []
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Extract box data
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = box.conf[0].cpu().numpy()
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        # Filter for vehicle classes only
                        if class_id in self.vehicle_classes:
                            detections.append({
                                'bbox': [int(x1), int(y1), int(x2-x1), int(y2-y1)],  # x, y, w, h
                                'confidence': float(confidence),
                                'class_id': class_id,
                                'class': self.vehicle_classes[class_id]
                            })
            
            logger.debug(f"Detected {len(detections)} vehicles")
            return detections
            
        except Exception as e:
            logger.error(f"Vehicle detection failed: {str(e)}")
            return self._mock_detect_vehicles(frame)
    
    def _mock_detect_vehicles(self, frame: np.ndarray) -> List[Dict]:
        """
        Mock vehicle detection for testing without YOLO
        
        Args:
            frame: Input image frame
            
        Returns:
            List of mock detection dictionaries
        """
        height, width = frame.shape[:2]
        
        # Generate random mock detections
        num_detections = np.random.randint(0, 5)  # 0-4 vehicles
        detections = []
        
        for i in range(num_detections):
            # Random position and size
            x = np.random.randint(0, width - 100)
            y = np.random.randint(0, height - 60)
            w = np.random.randint(80, 150)
            h = np.random.randint(40, 80)
            
            # Ensure bbox is within frame
            x = min(x, width - w)
            y = min(y, height - h)
            
            detections.append({
                'bbox': [x, y, w, h],
                'confidence': np.random.uniform(0.6, 0.95),
                'class_id': 2,  # Car
                'class': 'car'
            })
        
        return detections
    
    def detect_in_regions(self, frame: np.ndarray, regions: List[Dict]) -> List[Dict]:
        """
        Detect vehicles in specific regions (parking slots)
        
        Args:
            frame: Input image frame
            regions: List of region dictionaries with coordinates
            
        Returns:
            List of detections with region associations
        """
        # Get all vehicle detections
        all_detections = self.detect_vehicles(frame)
        
        region_detections = []
        
        for region in regions:
            region_coords = region['coordinates']
            region_x = region_coords['x']
            region_y = region_coords['y'] 
            region_w = region_coords['width']
            region_h = region_coords['height']
            
            # Find detections that overlap with this region
            region_vehicles = []
            for detection in all_detections:
                det_x, det_y, det_w, det_h = detection['bbox']
                
                # Calculate overlap
                overlap = self._calculate_overlap(
                    (region_x, region_y, region_w, region_h),
                    (det_x, det_y, det_w, det_h)
                )
                
                if overlap > 0.3:  # 30% overlap threshold
                    region_vehicles.append({
                        **detection,
                        'overlap': overlap,
                        'region_id': region.get('id'),
                        'slot_number': region.get('slot_number')
                    })
            
            # Sort by overlap and take the best detection
            if region_vehicles:
                best_detection = max(region_vehicles, key=lambda x: x['overlap'])
                region_detections.append({
                    'region_id': region.get('id'),
                    'slot_number': region.get('slot_number'),
                    'is_occupied': True,
                    'detection': best_detection
                })
            else:
                region_detections.append({
                    'region_id': region.get('id'),
                    'slot_number': region.get('slot_number'),
                    'is_occupied': False,
                    'detection': None
                })
        
        return region_detections
    
    def _calculate_overlap(self, box1: Tuple, box2: Tuple) -> float:
        """Calculate intersection over union (IoU) between two boxes"""
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
    
    def visualize_detections(self, frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
        """
        Draw detection boxes on frame for visualization
        
        Args:
            frame: Input image frame
            detections: List of detection dictionaries
            
        Returns:
            Frame with drawn bounding boxes
        """
        vis_frame = frame.copy()
        
        for detection in detections:
            x, y, w, h = detection['bbox']
            confidence = detection['confidence']
            class_name = detection['class']
            
            # Draw bounding box
            cv2.rectangle(vis_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Draw label
            label = f"{class_name}: {confidence:.2f}"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
            cv2.rectangle(vis_frame, (x, y - label_size[1] - 10), 
                         (x + label_size[0], y), (0, 255, 0), -1)
            cv2.putText(vis_frame, label, (x, y - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
        
        return vis_frame
    
    def visualize_parking_slots(self, frame: np.ndarray, slots: List[Dict], 
                               detections: Optional[List[Dict]] = None) -> np.ndarray:
        """
        Draw parking slot regions on frame
        
        Args:
            frame: Input image frame
            slots: List of parking slot configurations
            detections: Optional list of detections to show occupancy
            
        Returns:
            Frame with drawn parking slots
        """
        vis_frame = frame.copy()
        
        for slot in slots:
            coords = slot['coordinates']
            x, y, w, h = int(coords['x']), int(coords['y']), int(coords['width']), int(coords['height'])
            slot_number = slot.get('slot_number', '?')
            
            # Determine slot color based on occupancy
            if detections:
                slot_detection = next((d for d in detections if d.get('region_id') == slot.get('id')), None)
                is_occupied = slot_detection['is_occupied'] if slot_detection else False
                color = (0, 0, 255) if is_occupied else (0, 255, 0)  # Red if occupied, green if free
            else:
                color = (255, 255, 255)  # White if no detection info
            
            # Draw slot rectangle
            cv2.rectangle(vis_frame, (x, y), (x + w, y + h), color, 2)
            
            # Draw slot number
            text_size = cv2.getTextSize(str(slot_number), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            text_x = x + (w - text_size[0]) // 2
            text_y = y + (h + text_size[1]) // 2
            
            cv2.putText(vis_frame, str(slot_number), (text_x, text_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        return vis_frame
    
    def analyze_parking_lot(self, frame: np.ndarray, slot_config: List[Dict]) -> Dict:
        """
        Comprehensive parking lot analysis
        
        Args:
            frame: Input image frame
            slot_config: List of parking slot configurations
            
        Returns:
            Dictionary with analysis results
        """
        # Detect vehicles in slot regions
        region_detections = self.detect_in_regions(frame, slot_config)
        
        # Calculate statistics
        total_slots = len(slot_config)
        occupied_slots = sum(1 for det in region_detections if det['is_occupied'])
        occupancy_rate = (occupied_slots / total_slots) * 100 if total_slots > 0 else 0
        
        # Prepare slot results
        slot_results = []
        for detection in region_detections:
            slot_result = {
                'slot_id': detection['region_id'],
                'slot_number': detection['slot_number'],
                'is_occupied': detection['is_occupied'],
                'confidence': detection['detection']['confidence'] if detection['detection'] else 0.0,
                'vehicle_type': detection['detection']['class'] if detection['detection'] else None
            }
            
            if detection['detection']:
                slot_result['detection_box'] = detection['detection']['bbox']
            
            slot_results.append(slot_result)
        
        return {
            'total_slots': total_slots,
            'occupied_slots': occupied_slots,
            'available_slots': total_slots - occupied_slots,
            'occupancy_rate': occupancy_rate,
            'slot_results': slot_results,
            'timestamp': cv2.getTickCount()
        }
    
    def set_confidence_threshold(self, threshold: float):
        """Set confidence threshold for detections"""
        self.confidence_threshold = max(0.1, min(1.0, threshold))
        logger.info(f"Confidence threshold set to {self.confidence_threshold}")
    
    def set_nms_threshold(self, threshold: float):
        """Set NMS threshold for detections"""
        self.nms_threshold = max(0.1, min(1.0, threshold))
        logger.info(f"NMS threshold set to {self.nms_threshold}")
    
    def get_model_info(self) -> Dict:
        """Get information about the loaded model"""
        if self.model is None:
            return {
                'model_type': 'mock',
                'model_path': None,
                'available': False
            }
        
        return {
            'model_type': 'YOLO',
            'model_path': self.model_path,
            'available': YOLO_AVAILABLE,
            'confidence_threshold': self.confidence_threshold,
            'nms_threshold': self.nms_threshold,
            'vehicle_classes': self.vehicle_classes
        }

def test_detector():
    """Test function for the parking detector"""
    detector = ParkingDetector()
    
    # Create a test image
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    test_image.fill(128)  # Gray background
    
    # Test detection
    detections = detector.detect_vehicles(test_image)
    print(f"Test detections: {len(detections)}")
    
    # Test slot configuration
    test_slots = [
        {
            'id': 1,
            'slot_number': 1,
            'coordinates': {'x': 50, 'y': 50, 'width': 100, 'height': 200}
        },
        {
            'id': 2,
            'slot_number': 2,
            'coordinates': {'x': 200, 'y': 50, 'width': 100, 'height': 200}
        }
    ]
    
    # Test parking lot analysis
    analysis = detector.analyze_parking_lot(test_image, test_slots)
    print(f"Parking lot analysis: {analysis}")
    
    # Test visualization
    vis_frame = detector.visualize_parking_slots(test_image, test_slots)
    print("Visualization test completed")

if __name__ == '__main__':
    test_detector()
