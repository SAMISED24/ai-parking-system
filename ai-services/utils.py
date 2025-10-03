#!/usr/bin/env python3
"""
AI Parking System - Utilities
Common utility functions for AI services
"""

import os
import json
import logging
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

def setup_logging(name: str, level: str = "INFO") -> logging.Logger:
    """
    Setup logging configuration
    
    Args:
        name: Logger name
        level: Logging level
        
    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        # Create handler
        handler = logging.StreamHandler()
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, level.upper()))
    
    return logger

def validate_video_file(video_path: str) -> bool:
    """
    Validate video file exists and is readable
    
    Args:
        video_path: Path to video file
        
    Returns:
        True if valid, False otherwise
    """
    if not os.path.exists(video_path):
        return False
    
    # Check file extension
    valid_extensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv']
    file_ext = Path(video_path).suffix.lower()
    
    if file_ext not in valid_extensions:
        return False
    
    # Try to open with OpenCV
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return False
        
        # Try to read first frame
        ret, frame = cap.read()
        cap.release()
        
        return ret and frame is not None
    except Exception:
        return False

def parse_slot_config(slot_config_str: str) -> List[Dict]:
    """
    Parse slot configuration from JSON string
    
    Args:
        slot_config_str: JSON string containing slot configuration
        
    Returns:
        List of slot configuration dictionaries
    """
    try:
        slot_config = json.loads(slot_config_str)
        
        # Validate slot configuration
        if not isinstance(slot_config, list):
            raise ValueError("Slot configuration must be a list")
        
        for slot in slot_config:
            required_fields = ['id', 'slot_number', 'coordinates']
            for field in required_fields:
                if field not in slot:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate coordinates
            coords = slot['coordinates']
            required_coords = ['x', 'y', 'width', 'height']
            for coord in required_coords:
                if coord not in coords:
                    raise ValueError(f"Missing coordinate: {coord}")
                if not isinstance(coords[coord], (int, float)):
                    raise ValueError(f"Invalid coordinate type: {coord}")
        
        return slot_config
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in slot configuration: {str(e)}")

def validate_slot_coordinates(coordinates: Dict, frame_shape: Tuple[int, int]) -> bool:
    """
    Validate slot coordinates are within frame bounds
    
    Args:
        coordinates: Dictionary with x, y, width, height
        frame_shape: Tuple of (height, width)
        
    Returns:
        True if coordinates are valid, False otherwise
    """
    frame_height, frame_width = frame_shape
    
    x = coordinates.get('x', 0)
    y = coordinates.get('y', 0)
    width = coordinates.get('width', 0)
    height = coordinates.get('height', 0)
    
    # Check bounds
    if x < 0 or y < 0:
        return False
    if x + width > frame_width:
        return False
    if y + height > frame_height:
        return False
    if width <= 0 or height <= 0:
        return False
    
    return True

def resize_frame(frame: np.ndarray, max_width: int = 1280, max_height: int = 720) -> np.ndarray:
    """
    Resize frame while maintaining aspect ratio
    
    Args:
        frame: Input frame
        max_width: Maximum width
        max_height: Maximum height
        
    Returns:
        Resized frame
    """
    height, width = frame.shape[:2]
    
    # Calculate scaling factor
    scale_w = max_width / width
    scale_h = max_height / height
    scale = min(scale_w, scale_h, 1.0)  # Don't upscale
    
    if scale < 1.0:
        new_width = int(width * scale)
        new_height = int(height * scale)
        frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    return frame

def calculate_iou(box1: Tuple, box2: Tuple) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes
    
    Args:
        box1: Tuple of (x, y, width, height)
        box2: Tuple of (x, y, width, height)
        
    Returns:
        IoU value between 0 and 1
    """
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

def non_max_suppression(detections: List[Dict], iou_threshold: float = 0.5) -> List[Dict]:
    """
    Apply Non-Maximum Suppression to remove overlapping detections
    
    Args:
        detections: List of detection dictionaries with 'bbox' and 'confidence'
        iou_threshold: IoU threshold for suppression
        
    Returns:
        Filtered list of detections
    """
    if not detections:
        return []
    
    # Sort by confidence (descending)
    detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
    
    keep = []
    while detections:
        # Take the detection with highest confidence
        current = detections.pop(0)
        keep.append(current)
        
        # Remove detections with high IoU
        remaining = []
        for detection in detections:
            iou = calculate_iou(current['bbox'], detection['bbox'])
            if iou <= iou_threshold:
                remaining.append(detection)
        
        detections = remaining
    
    return keep

def save_detection_results(results: Dict, output_path: str):
    """
    Save detection results to JSON file
    
    Args:
        results: Detection results dictionary
        output_path: Path to save results
    """
    try:
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Add metadata
        results['saved_at'] = datetime.now().isoformat()
        results['version'] = '1.0'
        
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
            
    except Exception as e:
        raise IOError(f"Failed to save results: {str(e)}")

def load_detection_results(input_path: str) -> Dict:
    """
    Load detection results from JSON file
    
    Args:
        input_path: Path to results file
        
    Returns:
        Detection results dictionary
    """
    try:
        with open(input_path, 'r') as f:
            results = json.load(f)
        return results
    except Exception as e:
        raise IOError(f"Failed to load results: {str(e)}")

def create_output_video(frames: List[np.ndarray], output_path: str, fps: int = 30):
    """
    Create output video from list of frames
    
    Args:
        frames: List of video frames
        output_path: Path to save video
        fps: Frames per second
    """
    if not frames:
        raise ValueError("No frames provided")
    
    height, width = frames[0].shape[:2]
    
    # Define codec and create VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    try:
        for frame in frames:
            out.write(frame)
    finally:
        out.release()

def extract_frames(video_path: str, interval: int = 30) -> List[np.ndarray]:
    """
    Extract frames from video at specified interval
    
    Args:
        video_path: Path to video file
        interval: Frame interval (extract every nth frame)
        
    Returns:
        List of extracted frames
    """
    cap = cv2.VideoCapture(video_path)
    frames = []
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % interval == 0:
                frames.append(frame.copy())
            
            frame_count += 1
    finally:
        cap.release()
    
    return frames

def get_video_info(video_path: str) -> Dict:
    """
    Get video file information
    
    Args:
        video_path: Path to video file
        
    Returns:
        Dictionary with video information
    """
    cap = cv2.VideoCapture(video_path)
    
    try:
        info = {
            'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            'fps': cap.get(cv2.CAP_PROP_FPS),
            'frame_count': int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            'duration': 0,
            'file_size': os.path.getsize(video_path) if os.path.exists(video_path) else 0
        }
        
        if info['fps'] > 0:
            info['duration'] = info['frame_count'] / info['fps']
        
        return info
    finally:
        cap.release()

def create_parking_grid_visualization(slot_config: List[Dict], 
                                    detections: Optional[List[Dict]] = None,
                                    grid_size: Tuple[int, int] = (800, 600)) -> np.ndarray:
    """
    Create a visualization of parking grid with slot status
    
    Args:
        slot_config: List of parking slot configurations
        detections: Optional list of detections for occupancy status
        grid_size: Size of output visualization
        
    Returns:
        Visualization image
    """
    width, height = grid_size
    vis_image = np.zeros((height, width, 3), dtype=np.uint8)
    vis_image.fill(50)  # Dark gray background
    
    # Create detection lookup
    detection_lookup = {}
    if detections:
        for det in detections:
            slot_id = det.get('slot_id') or det.get('region_id')
            if slot_id:
                detection_lookup[slot_id] = det
    
    # Draw slots
    for slot in slot_config:
        coords = slot['coordinates']
        slot_id = slot['id']
        slot_number = slot.get('slot_number', slot_id)
        
        # Scale coordinates to fit visualization
        x = int(coords['x'] * width / 1000)  # Assume original coordinates are in 1000x1000 space
        y = int(coords['y'] * height / 1000)
        w = int(coords['width'] * width / 1000)
        h = int(coords['height'] * height / 1000)
        
        # Determine color based on occupancy
        if slot_id in detection_lookup:
            is_occupied = detection_lookup[slot_id].get('is_occupied', False)
            color = (0, 0, 255) if is_occupied else (0, 255, 0)  # Red if occupied, green if free
        else:
            color = (128, 128, 128)  # Gray if unknown
        
        # Draw slot rectangle
        cv2.rectangle(vis_image, (x, y), (x + w, y + h), color, 2)
        
        # Draw slot number
        text_size = cv2.getTextSize(str(slot_number), cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        text_x = x + (w - text_size[0]) // 2
        text_y = y + (h + text_size[1]) // 2
        
        cv2.putText(vis_image, str(slot_number), (text_x, text_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # Add legend
    legend_y = height - 60
    cv2.rectangle(vis_image, (10, legend_y), (30, legend_y + 20), (0, 255, 0), -1)
    cv2.putText(vis_image, "Available", (40, legend_y + 15), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    cv2.rectangle(vis_image, (150, legend_y), (170, legend_y + 20), (0, 0, 255), -1)
    cv2.putText(vis_image, "Occupied", (180, legend_y + 15), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    cv2.rectangle(vis_image, (280, legend_y), (300, legend_y + 20), (128, 128, 128), -1)
    cv2.putText(vis_image, "Unknown", (310, legend_y + 15), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return vis_image

def benchmark_processing_time(func, *args, **kwargs) -> Tuple[Any, float]:
    """
    Benchmark function execution time
    
    Args:
        func: Function to benchmark
        *args: Function arguments
        **kwargs: Function keyword arguments
        
    Returns:
        Tuple of (function_result, execution_time_seconds)
    """
    import time
    
    start_time = time.time()
    result = func(*args, **kwargs)
    end_time = time.time()
    
    execution_time = end_time - start_time
    return result, execution_time

def create_config_template() -> Dict:
    """
    Create a template configuration for parking lot setup
    
    Returns:
        Template configuration dictionary
    """
    return {
        "parking_lot_id": 1,
        "name": "Sample Parking Lot",
        "total_slots": 20,
        "layout": {
            "rows": 4,
            "columns": 5,
            "slot_width": 2.5,
            "slot_height": 5.0
        },
        "slots": [
            {
                "id": i + 1,
                "slot_number": i + 1,
                "coordinates": {
                    "x": (i % 5) * 100 + 50,
                    "y": (i // 5) * 120 + 50,
                    "width": 80,
                    "height": 100
                }
            }
            for i in range(20)
        ]
    }

# Error handling utilities
class ParkingSystemError(Exception):
    """Base exception for parking system errors"""
    pass

class VideoProcessingError(ParkingSystemError):
    """Exception for video processing errors"""
    pass

class DetectionError(ParkingSystemError):
    """Exception for detection errors"""
    pass

class ConfigurationError(ParkingSystemError):
    """Exception for configuration errors"""
    pass
