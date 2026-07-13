
import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { decipherImage } from './services/aiService';
import { HistoryItem, ViewState, type ApiError, type AnalysisRecordV2 } from './types';
import { triggerHaptic, compressHistoryImage } from './utils';
import { createPendingRecord } from './domain/records';
import { initialScanState, scanReducer } from './domain/scanState';
import { useAppContextStore } from './store/useAppContextStore';
import { useTranslation } from 'react-i18next';
import { ResultDrawer } from './components/ResultDrawer';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { MapView } from './components/MapView';
import { HomeView } from './components/HomeView';
import { CropView } from './components/CropView';
import { IconCamera, IconHistory, IconSettings, IconSparkles, IconMap, IconChevronUp, IconPhoto } from './components/Icons';
import { useSettingsStore } from './store/useSettingsStore';
import { useHistoryStore } from './store/useHistoryStore';

const App: React.FC = () => {
  const { t } = useTranslation();
  // State
  const [viewState, setViewState] = useState<ViewState>(ViewState.CAMERA);
  const [scan, dispatchScan] = useReducer(scanReducer, initialScanState);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isHomeOpen = scan.stage === 'home';
  const isAnalyzing = scan.stage === 'analyzing';
  const isCropping = scan.stage === 'crop';
  const capturedImage = scan.image || null;
  const currentResult = scan.result || null;
  
  // Camera Optimization State
  const streamRef = useRef<MediaStream | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Stores
  const { theme, language, fontSize, saveToGallery } = useSettingsStore();
  const { history, addRecord, loadHistory } = useHistoryStore();
  const ensureLocation = useAppContextStore((state) => state.ensureLocation);
  
  // Notification State
  const [notification, setNotification] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show Notification Helper
  const showNotification = (msg: string) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 3000);
  };

  // Load Data from Storage on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (viewState !== ViewState.CAMERA) analysisAbortRef.current?.abort();
  }, [viewState]);

  // Sync language with i18next
  useEffect(() => {
      import('i18next').then(({ default: i18n }) => {
          if (i18n.language !== language) {
              i18n.changeLanguage(language);
          }
      });
  }, [language]);

  // Apply Font Size
  useEffect(() => {
      const sizeMap = {
          small: '14px',
          medium: '16px',
          large: '18px'
      };
      document.documentElement.style.fontSize = sizeMap[fontSize];
  }, [fontSize]);

  // Optimized Camera Lifecycle Management
  // Only activate camera when NOT in Home View (to save battery/heat)
  useEffect(() => {
    // Keep camera active if we haven't captured yet, or if we are not in cropping/analyzing/drawer modes
    const shouldCameraBeActive = !isHomeOpen && viewState === ViewState.CAMERA && !capturedImage;

    const manageCamera = async () => {
        if (shouldCameraBeActive) {
            // Start Camera
            if (!streamRef.current) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { 
                            facingMode: 'environment',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 } 
                        } 
                    });
                    streamRef.current = stream;
                    
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        // Wait for metadata to load before showing
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().catch(console.error);
                            setIsCameraReady(true);
                        };
                    }
                } catch (err) {
                    console.warn("Camera access denied or unavailable", err);
                    showNotification("Camera access required");
                }
            } else {
                // If stream exists but was potentially paused (though we stop it usually)
                if (videoRef.current && !videoRef.current.srcObject) {
                     videoRef.current.srcObject = streamRef.current;
                     videoRef.current.play().catch(console.error);
                }
            }
        } else {
            // Stop Camera (Release Hardware to cool down device)
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setIsCameraReady(false);
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
            }
        }
    };

    manageCamera();

    // Cleanup on component unmount
    return () => {
       if (streamRef.current) {
           streamRef.current.getTracks().forEach(track => track.stop());
       }
    };
  }, [isHomeOpen, viewState, capturedImage]);


  // Handle Capture
  const handleCapture = useCallback(async () => {
     triggerHaptic(50);
     if (!videoRef.current) return;

     const video = videoRef.current;
     const canvas = document.createElement('canvas');
     
     let width = video.videoWidth;
     let height = video.videoHeight;
     const maxDim = 1920; // Increased capture res for better cropping
     
     if (width > maxDim || height > maxDim) {
         const ratio = width / height;
         if (width > height) {
             width = maxDim;
             height = maxDim / ratio;
         } else {
             height = maxDim;
             width = maxDim * ratio;
         }
     }
     
     canvas.width = width;
     canvas.height = height;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;
     
     ctx.drawImage(video, 0, 0, width, height);
     const base64Image = canvas.toDataURL('image/jpeg', 0.85);
     
     dispatchScan({ type: 'CAPTURE', image: base64Image });
  }, []);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
           dispatchScan({ type: 'CAPTURE', image: reader.result });
        }
      };
      reader.readAsDataURL(file);
      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  // Called after Crop is confirmed
  const handleCropConfirm = async (croppedBase64: string) => {
      triggerHaptic([50, 50]);
      dispatchScan({ type: 'START_ANALYSIS', image: croppedBase64 });
      
      if (saveToGallery) {
          try {
              const link = document.createElement('a');
              link.href = croppedBase64;
              link.download = `context-lens-crop-${Date.now()}.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showNotification("Saved to Gallery");
          } catch (e) {
              console.error("Failed to save image", e);
          }
      }

      void processImage(croppedBase64);
  };

  const processImage = async (base64: string) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const createdAt = Date.now();
    const id = crypto.randomUUID();
    dispatchScan({ type: 'START_ANALYSIS', image: base64 });

    try {
        const [location, thumbnail, storedImage] = await Promise.all([
          ensureLocation(language),
          compressHistoryImage(base64, 400, 0.6),
          compressHistoryImage(base64, 1600, 0.76),
        ]);
        if (controller.signal.aborted) return;

        if (!navigator.onLine) {
          addRecord(createPendingRecord({
            id,
            image: storedImage,
            thumbnail,
            language,
            location,
            createdAt,
          }));
          dispatchScan({ type: 'QUEUE_OFFLINE' });
          showNotification('Saved for later. Retry when you are online.');
          return;
        }

        const result = await decipherImage(base64, location, language, controller.signal);
        if (controller.signal.aborted) return;
        const record: AnalysisRecordV2 = {
          schemaVersion: 2,
          id,
          status: 'complete',
          image: storedImage,
          thumbnail,
          language,
          location,
          result,
          createdAt,
          updatedAt: Date.now(),
        };
        addRecord(record);
        dispatchScan({ type: 'ANALYSIS_SUCCESS', result });
        setIsDrawerOpen(true);
    } catch (error) {
        if (controller.signal.aborted) return;
        const details = error && typeof error === 'object' && 'details' in error
          ? (error as { details: ApiError }).details
          : {
              code: 'ANALYSIS_FAILED',
              message: error instanceof Error ? error.message : 'Analysis failed.',
              retryable: true,
              requestId: 'client',
            };
        const failedRecord: AnalysisRecordV2 = {
          schemaVersion: 2,
          id,
          status: 'failed',
          image: await compressHistoryImage(base64, 1600, 0.76),
          thumbnail: await compressHistoryImage(base64),
          language,
          error: details,
          createdAt,
          updatedAt: Date.now(),
        };
        addRecord(failedRecord);
        dispatchScan({ type: 'ANALYSIS_FAILURE', error: details.message });
        showNotification(details.message);
    }
  };

  const resetCamera = () => {
    analysisAbortRef.current?.abort();
    setIsDrawerOpen(false);
    dispatchScan({ type: 'OPEN_CAMERA' });
  };

  const handleHistorySelect = (item: HistoryItem) => {
      setViewState(ViewState.CAMERA);
      analysisAbortRef.current?.abort();
      dispatchScan({ type: 'SHOW_RESULT', image: item.thumbnail, result: item });
      setIsDrawerOpen(true);
  };

  // Handlers for Home View transitions
  const startScan = () => dispatchScan({ type: 'OPEN_CAMERA' });
  const openHistory = () => setViewState(ViewState.HISTORY);
  const openSettings = () => setViewState(ViewState.SETTINGS);
  const backToHome = () => {
      resetCamera();
      dispatchScan({ type: 'RESET' });
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden font-sans transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label={t('scan.choosePhoto')}
        className="sr-only"
        onChange={handleFileUpload}
      />
      
      {/* Toast Notification */}
      <div className={`fixed top-8 inset-x-0 flex justify-center z-[100] transition-all duration-300 transform ${notification ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
          <div className={`backdrop-blur-xl px-6 py-3 rounded-full border shadow-2xl text-sm font-medium tracking-wide flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10 text-white border-white/20' : 'bg-black/80 text-white border-black/10'}`}>
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              {notification}
          </div>
      </div>

      {/* 1. Camera / Viewfinder Layer (Always rendered in background) */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${viewState === ViewState.CAMERA ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Aesthetic Background when Camera is Off (Saves Battery) */}
        <div className={`absolute inset-0 bg-gradient-to-br from-[#121212] to-black transition-opacity duration-700 ${!capturedImage && (!isCameraReady || isHomeOpen) ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
            <div className="absolute top-0 right-0 w-[50vh] h-[50vh] bg-indigo-900/10 rounded-full blur-[100px] transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-purple-900/10 rounded-full blur-[100px] transform -translate-x-1/2 translate-y-1/2"></div>
        </div>

        {capturedImage && !isCropping ? (
            <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
        ) : (
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover scale-[1.02] transition-opacity duration-700 ${isCameraReady && !isHomeOpen && !isCropping ? 'opacity-100' : 'opacity-0'}`} 
             />
        )}
        
        {/* Crop View Overlay */}
        {isCropping && capturedImage && (
            <CropView 
                imageSrc={capturedImage}
                onConfirm={handleCropConfirm}
                onCancel={resetCamera}
            />
        )}
        
        {/* Analyzing Overlay - Improved Animation */}
        {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-500 z-50">
                <div className="relative flex flex-col items-center">
                    {/* Pulsing Rings */}
                    <div className="absolute w-32 h-32 bg-indigo-500/30 rounded-full animate-pulse-ring"></div>
                    <div className="absolute w-32 h-32 bg-indigo-500/30 rounded-full animate-pulse-ring delay-300"></div>
                    
                    {/* Center Icon */}
                    <div className="w-20 h-20 rounded-full bg-black/50 border border-white/20 backdrop-blur-md flex items-center justify-center relative z-10 shadow-[0_0_25px_rgba(99,102,241,0.4)]">
                        <IconSparkles className="w-8 h-8 text-indigo-300 animate-pulse" />
                    </div>
                    
                    <p className="mt-6 text-indigo-100 font-light tracking-[0.3em] text-xs animate-pulse uppercase">Deciphering</p>
                </div>
            </div>
        )}

        {(scan.stage === 'error' || scan.stage === 'pending') && capturedImage && (
            <div className="absolute inset-0 z-50 flex items-end bg-black/55 p-6 pb-[max(2rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
                <div className="w-full rounded-3xl border border-white/15 bg-black/80 p-6 text-white shadow-2xl">
                    <h2 className="text-xl font-medium">
                        {scan.stage === 'pending' ? t('scan.savedForLater') : t('scan.analysisFailed')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                        {scan.error || (scan.stage === 'pending' ? t('scan.pendingHint') : t('scan.failureHint'))}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => void processImage(capturedImage)}
                            className="rounded-full bg-indigo-600 px-4 py-3 font-medium"
                        >
                            {t('common.retry')}
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-full border border-white/20 px-4 py-3 font-medium"
                        >
                            {t('scan.choosePhoto')}
                        </button>
                    </div>
                    <button type="button" onClick={backToHome} className="mt-4 w-full text-sm text-white/55">
                        {t('scan.later')}
                    </button>
                </div>
            </div>
        )}

        {/* Live Camera Interface (Only when Home is closed and not analyzing/cropping) */}
        {!isHomeOpen && !isAnalyzing && !isDrawerOpen && !isCropping && capturedImage === null && (
            <>
                <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-start z-10 pt-10 pb-20">
                     <button 
                        onClick={backToHome} 
                        className="text-white/90 hover:text-white transition-all active:scale-90 p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
                    >
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                     
                     {/* Map Button (Moved to Top Right) */}
                     <button 
                        onClick={() => setViewState(ViewState.MAP)}
                        className="p-4 rounded-full glass-panel text-white hover:bg-white/20 transition-all active:scale-90"
                    >
                         <IconMap className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute bottom-0 inset-x-0 pb-12 pt-32 flex justify-between items-center px-10 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    {/* Gallery / Upload Button (New) */}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 rounded-full glass-panel text-white hover:bg-white/20 transition-all active:scale-90"
                    >
                        <IconPhoto className="w-6 h-6" />
                    </button>

                    <div className="relative group">
                         {/* Removed capture="environment" to allow Gallery selection on mobile */}
                        {/* Capture Button */}
                        <button 
                            onClick={() => {
                                if (isCameraReady) {
                                    handleCapture();
                                } else {
                                    fileInputRef.current?.click();
                                }
                            }}
                            className="w-20 h-20 rounded-full border-[5px] border-white/30 flex items-center justify-center bg-white/10 active:scale-90 transition-transform duration-200 backdrop-blur-sm"
                        >
                            <div className="w-16 h-16 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)] group-hover:scale-95 transition-transform duration-200"></div>
                        </button>
                    </div>
                    
                    {/* History Button (Moved to Bottom Right) */}
                    <button 
                        onClick={() => setViewState(ViewState.HISTORY)}
                        className="p-4 rounded-full glass-panel text-white hover:bg-white/20 transition-all active:scale-90"
                    >
                         <IconHistory className="w-6 h-6" />
                    </button>
                </div>

                {/* Reticle / Focus Frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-64 h-64 border border-white/30 rounded-[2rem] opacity-60 flex flex-col justify-between p-4">
                        <div className="flex justify-between">
                            <div className="w-4 h-4 border-t-2 border-l-2 border-white"></div>
                            <div className="w-4 h-4 border-t-2 border-r-2 border-white"></div>
                        </div>
                        <div className="flex justify-between">
                            <div className="w-4 h-4 border-b-2 border-l-2 border-white"></div>
                            <div className="w-4 h-4 border-b-2 border-r-2 border-white"></div>
                        </div>
                     </div>
                </div>
            </>
        )}

        {(capturedImage && !isCropping || isDrawerOpen) && (
            <>
                <div className="absolute top-12 start-6 z-50 animate-fade-in-up">
                    <button 
                        onClick={resetCamera}
                        className="p-3 rounded-full bg-black/50 backdrop-blur-md text-white border border-white/10 shadow-lg active:scale-90 transition-transform"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Re-open Drawer Button - Shows when drawer is closed but we have a result */}
                {capturedImage && !isDrawerOpen && !isAnalyzing && (
                    <div className="absolute bottom-10 inset-x-0 flex justify-center z-30 animate-fade-in-up">
                        <button 
                            onClick={() => setIsDrawerOpen(true)}
                            className="bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full p-4 shadow-lg active:scale-90 transition-transform hover:bg-black/60 animate-bounce"
                        >
                            <IconChevronUp className="w-6 h-6" />
                        </button>
                    </div>
                )}
            </>
        )}
      </div>

      {/* 2. Home Layer - Transitions away when !isHomeOpen */}
      {viewState === ViewState.CAMERA && (
          <div className={`absolute inset-0 z-20 transition-all duration-700 transform ${isHomeOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'}`}>
              <HomeView 
                onScanStart={startScan}
                onOpenHistory={openHistory}
                onOpenSettings={openSettings}
              />
          </div>
      )}

      {/* Result Drawer */}
      <ResultDrawer 
        result={currentResult} 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        onShowNotification={showNotification}
      />

      {/* History View */}
      {viewState === ViewState.HISTORY && (
          <HistoryView 
            onSelect={handleHistorySelect} 
            onClose={() => {
                setViewState(ViewState.CAMERA);
            }} 
            onShowNotification={showNotification}
          />
      )}

      {/* Map View */}
      {viewState === ViewState.MAP && (
          <MapView 
            onClose={() => setViewState(ViewState.CAMERA)} 
          />
      )}

       {/* Settings View */}
       {viewState === ViewState.SETTINGS && (
          <SettingsView 
            onBack={() => {
                setViewState(ViewState.CAMERA);
                analysisAbortRef.current?.abort();
                dispatchScan({ type: 'RESET' });
            }} 
          />
      )}

    </div>
  );
};

export default App;
