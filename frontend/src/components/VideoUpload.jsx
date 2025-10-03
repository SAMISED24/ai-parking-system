import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  XMarkIcon, 
  CloudArrowUpIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { videoService } from '../services/api';
import { ProgressBar } from './LoadingSpinner';
import { toast } from 'react-hot-toast';

const VideoUpload = ({ isOpen, onClose, onSuccess, parkingLots = [] }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [analysisType, setAnalysisType] = useState('full');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState(null);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        setError('File is too large. Maximum size is 500MB.');
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        setError('Invalid file type. Please upload a video file.');
      } else {
        setError('File upload failed. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false
  });

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a video file');
      return;
    }

    if (!selectedLotId) {
      setError('Please select a parking lot');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('parking_lot_id', selectedLotId);
      formData.append('analysis_type', analysisType);

      const response = await videoService.uploadVideo(
        formData,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (response.data.success) {
        setUploadComplete(true);
        toast.success('Video uploaded successfully!');
        
        // Call success callback after a short delay
        setTimeout(() => {
          onSuccess && onSuccess(response.data.data);
        }, 1500);
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedFile(null);
    setSelectedLotId('');
    setAnalysisType('full');
    setUploadProgress(0);
    setUploading(false);
    setUploadComplete(false);
    setError(null);
  };

  // Handle close
  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <VideoCameraIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Video for Analysis
              </h3>
            </div>
            <button
              onClick={handleClose}
              disabled={uploading}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {uploadComplete ? (
              // Success State
              <div className="text-center py-8">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Successful!
                </h4>
                <p className="text-gray-600 mb-6">
                  Your video has been uploaded and processing will begin shortly.
                </p>
                <button
                  onClick={handleClose}
                  className="btn btn-primary"
                >
                  Close
                </button>
              </div>
            ) : (
              // Upload Form
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* File Drop Zone */}
                <div>
                  <label className="form-label">Video File</label>
                  <div
                    {...getRootProps()}
                    className={`video-upload-area ${
                      isDragActive ? 'drag-over' : ''
                    } ${uploading ? 'uploading' : ''} ${
                      isDragReject ? 'border-red-400 bg-red-50' : ''
                    }`}
                  >
                    <input {...getInputProps()} disabled={uploading} />
                    
                    {selectedFile ? (
                      <div className="text-center">
                        <VideoCameraIcon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                            }}
                            className="mt-2 text-xs text-red-600 hover:text-red-700"
                          >
                            Remove file
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 mb-2">
                          {isDragActive
                            ? 'Drop the video file here'
                            : 'Drag & drop a video file here, or click to select'
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          Supports MP4, AVI, MOV, WMV, FLV, MKV (max 500MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parking Lot Selection */}
                <div>
                  <label htmlFor="parking-lot" className="form-label">
                    Parking Lot
                  </label>
                  <select
                    id="parking-lot"
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    className="form-input"
                    disabled={uploading}
                    required
                  >
                    <option value="">Select a parking lot</option>
                    {parkingLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.name} ({lot.total_slots} slots)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Analysis Type */}
                <div>
                  <label htmlFor="analysis-type" className="form-label">
                    Analysis Type
                  </label>
                  <select
                    id="analysis-type"
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="form-input"
                    disabled={uploading}
                  >
                    <option value="full">Full Analysis (Occupancy + Duration)</option>
                    <option value="occupancy">Occupancy Only</option>
                    <option value="duration">Duration Analysis</option>
                  </select>
                  <p className="form-help">
                    Full analysis provides the most comprehensive results but takes longer to process.
                  </p>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <ProgressBar
                      progress={uploadProgress}
                      isLoading={true}
                      color="blue"
                    />
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                    <ExclamationCircleIcon className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                    <span className="text-red-700 text-sm">{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={uploading}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFile || !selectedLotId || uploading}
                    className="btn btn-primary"
                  >
                    {uploading ? 'Uploading...' : 'Upload & Analyze'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoUpload;
