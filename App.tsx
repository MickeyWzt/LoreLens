
import React, { useState, useRef, useEffect, useCallback, useReducer, lazy, Suspense } from 'react';
import { decipherImage } from './services/aiService';
import { HistoryItem, ViewState, type ApiError, type AnalysisRecordV2, type LocationSnapshot } from './types';
import { triggerHaptic, compressHistoryImage } from './utils';
import { createPendingRecord, deferAnalysisRecord } from './domain/records';
import { initialScanState, scanReducer } from './domain/scanState';
import { useAppContextStore } from './store/useAppContextStore';
import { useTranslation } from 'react-i18next';
import { normalizeImageFile } from './utils/image';
import { resolvePhotoLocation } from './services/photoLocationService';
import i18n from './i18n';
import { localizeApiError } from './services/errorMessages';
import { ResultDrawer } from './components/ResultDrawer';
import { HomeView } from './components/HomeView';
import { CropView } from './components/CropView';
import { IconCamera, IconHistory, IconSettings, IconSparkles, IconMap, IconChevronUp, IconPhoto } from './components/Icons';
import { useSettingsStore } from './store/useSettingsStore';
import { useHistoryStore } from './store/useHistoryStore';
import { openPreferredCamera, PhysicalCameraUnavailableError } from './services/cameraService';

const HistoryView = lazy(() => import('./components/HistoryView').then((module) => ({ default: module.HistoryView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((module) => ({ default: module.SettingsView })));
const MapView = lazy(() => import('./components/MapView').then((module) => ({ default: module.MapView })));

const ViewLoader = () => (
  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black text-white" aria-live="polite">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
  </div>
);

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
  const activeAnalysisIdRef = useRef<string | null>(null);
  const capturedLocationRef = useRef<Promise<LocationSnapshot> | undefined>(undefined);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<'denied' | 'unavailable' | 'noPhysical' | null>(null);

  // Stores
  const { theme, language, fontSize, saveToGallery, reduceMotion, locationEnabled } = useSettingsStore();
  const { history, records, addRecord, updateRecord, loadHistory } = useHistoryStore();
  const ensureLocation = useAppContextStore((state) => state.ensureLocation);
  const refreshLocation = useAppContextStore((state) => state.refreshLocation);
  
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

  // Location is an app-level capability: request it as soon as LoreLens opens,
  // rather than waiting for the home screen (which may be replaced or remounted).
  useEffect(() => {
    if (locationEnabled) void ensureLocation(language);
  }, [ensureLocation, language, locationEnabled]);

  useEffect(() => {
    if (viewState !== ViewState.CAMERA) analysisAbortRef.current?.abort();
  }, [viewState]);

  // Sync language with i18next
  useEffect(() => {
      if (i18n.language !== language) void i18n.changeLanguage(language);
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

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  // Optimized Camera Lifecycle Management
  // Only activate camera when NOT in Home View (to save battery/heat)
  useEffect(() => {
    // Keep camera active if we haven't captured yet, or if we are not in cropping/analyzing/drawer modes
    const shouldCameraBeActive = !isHomeOpen && viewState === ViewState.CAMERA && !capturedImage;

    let cancelled = false;

    const manageCamera = async () => {
        if (shouldCameraBeActive) {
            // Start Camera
            if (!streamRef.current) {
                try {
                    setCameraError(null);
                    const stream = await openPreferredCamera(navigator.mediaDevices);
                    if (cancelled) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }
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
                    if (cancelled) return;
                    const denied = err instanceof DOMException && err.name === 'NotAllowedError';
                    const noPhysical = err instanceof PhysicalCameraUnavailableError;
                    const errorType = denied ? 'denied' : noPhysical ? 'noPhysical' : 'unavailable';
                    const messageKey = denied
                      ? 'errors.cameraDenied'
                      : noPhysical
                        ? 'errors.physicalCameraUnavailable'
                        : 'errors.cameraUnavailable';
                    setCameraError(errorType);
                    showNotification(t(messageKey));
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
       cancelled = true;
       if (streamRef.current) {
           streamRef.current.getTracks().forEach(track => track.stop());
           streamRef.current = null;
           setIsCameraReady(false);
           if (videoRef.current) videoRef.current.srcObject = null;
       }
    };
  }, [capturedImage, isHomeOpen, t, viewState]);


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
     capturedLocationRef.current = resolvePhotoLocation({
       kind: 'camera',
       language,
       locationEnabled,
       getDeviceLocation: () => refreshLocation(language),
     });
     
     activeAnalysisIdRef.current = null;
     dispatchScan({ type: 'CAPTURE', image: base64Image });
  }, [language, locationEnabled, refreshLocation]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      try {
        capturedLocationRef.current = resolvePhotoLocation({
          kind: 'upload',
          file,
          language,
          locationEnabled,
          getDeviceLocation: () => refreshLocation(language),
        });
        activeAnalysisIdRef.current = null;
        dispatchScan({ type: 'CAPTURE', image: await normalizeImageFile(file) });
      } catch {
        showNotification(t('errors.invalidImage'));
      }
    }
  };

  // Called after Crop is confirmed
  const handleCropConfirm = async (croppedBase64: string) => {
      triggerHaptic([50, 50]);
      if (saveToGallery) {
          try {
              const link = document.createElement('a');
              link.href = croppedBase64;
              link.download = `lorelens-crop-${Date.now()}.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showNotification(t('common.saved'));
          } catch {
              showNotification(t('errors.saveFailed'));
          }
      }

      void processImage(croppedBase64);
  };

  const processImage = async (base64: string) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const createdAt = Date.now();
    const id = activeAnalysisIdRef.current || crypto.randomUUID();
    activeAnalysisIdRef.current = id;
    dispatchScan({ type: 'START_ANALYSIS', image: base64 });
    let attachedLocation: LocationSnapshot | undefined;

    try {
        const locationPromise = capturedLocationRef.current || resolvePhotoLocation({
          kind: 'camera',
          language,
          locationEnabled,
          getDeviceLocation: () => ensureLocation(language),
        });
        const [location, thumbnail, storedImage] = await Promise.all([
          locationPromise,
          compressHistoryImage(base64, 400, 0.6),
          compressHistoryImage(base64, 1600, 0.76),
        ]);
        attachedLocation = location;
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
          showNotification(t('scan.savedForLater'));
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
          location: attachedLocation,
          error: details,
          createdAt,
          updatedAt: Date.now(),
        };
        addRecord(failedRecord);
        const localizedMessage = localizeApiError(details, t);
        dispatchScan({ type: 'ANALYSIS_FAILURE', error: localizedMessage });
        showNotification(localizedMessage);
    }
  };

  const resetCamera = () => {
    analysisAbortRef.current?.abort();
    activeAnalysisIdRef.current = null;
    capturedLocationRef.current = undefined;
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
  const navigateTo = (nextView: ViewState) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setViewState(nextView);
  };
  const startScan = () => dispatchScan({ type: 'OPEN_CAMERA' });
  const openHistory = () => navigateTo(ViewState.HISTORY);
  const openSettings = () => navigateTo(ViewState.SETTINGS);
  const backToHome = () => {
      resetCamera();
      dispatchScan({ type: 'RESET' });
  };

  const handleDeferAnalysis = () => {
    const id = activeAnalysisIdRef.current;
    if (scan.stage === 'error' && id) {
      const record = records.find((candidate) => candidate.id === id);
      if (record) updateRecord(id, deferAnalysisRecord(record));
    }
    backToHome();
  };

  return (
    <div className={`relative h-[100dvh] w-full overflow-hidden font-sans transition-colors duration-200 ${theme === 'dark' ? 'bg-[#0b0b0a] text-white' : 'bg-[#f2efe6] text-[#171714]'}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label={t('scan.choosePhoto')}
        className="sr-only"
        onChange={handleFileUpload}
      />
      
      {/* Toast Notification */}
      <div role="status" aria-live="polite" className={`fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex justify-center px-5 transition-[opacity,transform] duration-200 [transition-timing-function:var(--ll-ease-out)] ${notification ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}>
          <div className={`ll-material flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-semibold ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#e69b62]"></span>
              {notification}
          </div>
      </div>

      {/* 1. Camera / Viewfinder Layer (Always rendered in background) */}
      <div
        aria-hidden={viewState !== ViewState.CAMERA}
        inert={viewState !== ViewState.CAMERA}
        className={`absolute inset-0 transition-opacity duration-200 ${viewState === ViewState.CAMERA ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        
        {/* Aesthetic Background when Camera is Off (Saves Battery) */}
        <div className={`ll-grain absolute inset-0 bg-[radial-gradient(circle_at_65%_20%,rgba(191,116,70,0.16),transparent_35%),linear-gradient(160deg,#24221e,#090909_58%,#11100e)] transition-opacity duration-200 ${!capturedImage && (!isCameraReady || isHomeOpen) ? 'opacity-100' : 'opacity-0'}`}>
        </div>

        {capturedImage && !isCropping ? (
            <img src={capturedImage} className="w-full h-full object-cover" alt={t('aria.capturedImage')} />
        ) : (
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`h-full w-full scale-[1.01] object-cover transition-opacity duration-200 ${isCameraReady && !isHomeOpen && !isCropping ? 'opacity-100' : 'opacity-0'}`}
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/72 backdrop-blur-md">
                <div className="relative flex flex-col items-center">
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/14 bg-black/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <div className="absolute inset-2 animate-[spin_1.8s_linear_infinite] rounded-full border border-transparent border-t-[#e69b62]" />
                        <IconSparkles className="h-7 w-7 text-[#f2efe6]" />
                    </div>
                    <p className="mt-5 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-white/66">{t('scan.deciphering')}</p>
                </div>
            </div>
        )}

        {(scan.stage === 'error' || scan.stage === 'pending') && capturedImage && (
            <div className="absolute inset-0 z-50 flex items-end bg-black/55 p-6 pb-[max(2rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
                <div className="ll-material ll-sheet-enter mx-auto w-full max-w-md rounded-[1.75rem] p-6 text-white">
                    <h2 className="font-serif text-2xl leading-tight">
                        {scan.stage === 'pending' ? t('scan.savedForLater') : t('scan.analysisFailed')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                        {scan.error || (scan.stage === 'pending' ? t('scan.pendingHint') : t('scan.failureHint'))}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => void processImage(capturedImage)}
                            className="ll-pressable rounded-xl bg-[#f2efe6] px-4 py-3 font-semibold text-[#0b0b0a] transition-transform duration-150"
                        >
                            {t('common.retry')}
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="ll-pressable rounded-xl border border-white/18 px-4 py-3 font-semibold transition-transform duration-150"
                        >
                            {t('scan.choosePhoto')}
                        </button>
                    </div>
                    <button type="button" onClick={handleDeferAnalysis} className="mt-4 w-full text-sm text-white/55">
                        {t('scan.later')}
                    </button>
                </div>
            </div>
        )}

        {/* Live Camera Interface (Only when Home is closed and not analyzing/cropping) */}
        {!isHomeOpen && !isAnalyzing && !isDrawerOpen && !isCropping && capturedImage === null && (
            <>
                <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
                     <button 
                        aria-label={t('aria.close')}
                        onClick={backToHome} 
                        className="ll-icon-button h-11 w-11 rounded-2xl text-white"
                    >
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                     
                     {/* Map Button (Moved to Top Right) */}
                     <button 
                        aria-label={t('aria.openMap')}
                        onClick={() => navigateTo(ViewState.MAP)}
                        className="ll-icon-button h-11 w-11 rounded-2xl text-white"
                    >
                         <IconMap className="w-6 h-6" />
                    </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/56 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-28">
                  <div className="ll-material mx-auto flex max-w-sm items-center justify-between rounded-[1.8rem] px-3 py-2.5">
                    {/* Gallery / Upload Button (New) */}
                    <button 
                        aria-label={t('aria.upload')}
                        onClick={() => fileInputRef.current?.click()}
                        className="ll-icon-button h-12 w-12 rounded-2xl text-white"
                    >
                        <IconPhoto className="w-6 h-6" />
                    </button>

                    <div className="relative">
                         {/* Removed capture="environment" to allow Gallery selection on mobile */}
                        {/* Capture Button */}
                        <button 
                            aria-label={isCameraReady ? t('aria.capture') : t('aria.upload')}
                            onClick={() => {
                                if (isCameraReady) {
                                    handleCapture();
                                } else {
                                    fileInputRef.current?.click();
                                }
                            }}
                            className="ll-pressable flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full border border-white/36 bg-white/10 transition-transform duration-150"
                        >
                            <div className="h-[3.65rem] w-[3.65rem] rounded-full bg-[#f2efe6] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_4px_18px_rgba(0,0,0,0.35)]"></div>
                        </button>
                    </div>
                    
                    {/* History Button (Moved to Bottom Right) */}
                    <button 
                        aria-label={t('aria.openHistory')}
                        onClick={openHistory}
                        className="ll-icon-button h-12 w-12 rounded-2xl text-white"
                    >
                         <IconHistory className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Reticle / Focus Frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     {cameraError && (
                       <div className="ll-material ll-sheet-enter pointer-events-auto mx-7 max-w-sm rounded-[1.75rem] p-6 text-center text-white">
                         <h2 className="font-serif text-2xl leading-tight">{t(
                           cameraError === 'denied'
                             ? 'errors.cameraDenied'
                             : cameraError === 'noPhysical'
                               ? 'errors.physicalCameraUnavailable'
                               : 'errors.cameraUnavailable',
                         )}</h2>
                         <p className="mt-2 text-sm text-white/65">{t(
                           cameraError === 'noPhysical' ? 'errors.physicalCameraHelp' : 'errors.cameraHelp',
                         )}</p>
                         <button type="button" onClick={() => fileInputRef.current?.click()} className="ll-primary-action mt-5 rounded-xl bg-[#f2efe6] px-5 py-3 font-semibold text-[#0b0b0a]">
                           {t('scan.choosePhoto')}
                         </button>
                       </div>
                     )}
                     {!cameraError && (
                     <div className="relative flex aspect-[4/5] w-[min(70vw,19rem)] flex-col justify-between p-2 opacity-78">
                        <div className="flex justify-between">
                            <div className="h-8 w-8 rounded-tl-2xl border-s-2 border-t-2 border-white/88"></div>
                            <div className="h-8 w-8 rounded-tr-2xl border-e-2 border-t-2 border-white/88"></div>
                        </div>
                        <span className="absolute start-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75" />
                        <div className="flex justify-between">
                            <div className="h-8 w-8 rounded-bl-2xl border-b-2 border-s-2 border-white/88"></div>
                            <div className="h-8 w-8 rounded-br-2xl border-b-2 border-e-2 border-white/88"></div>
                        </div>
                     </div>
                     )}
                </div>
            </>
        )}

        {(capturedImage && !isCropping || isDrawerOpen) && (
            <>
                <div className="absolute top-12 start-6 z-50 animate-fade-in-up">
                    <button 
                        aria-label={t('aria.close')}
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
                            aria-label={t('result.essence')}
                            onClick={() => setIsDrawerOpen(true)}
                            className="ll-icon-button ll-pressable rounded-2xl p-3.5 text-white"
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
          <div className={`absolute inset-0 z-20 transition-[opacity,transform] duration-[280ms] [transition-timing-function:var(--ll-ease-out)] ${isHomeOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}>
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
        <Suspense fallback={<ViewLoader />}>
          <HistoryView 
            onSelect={handleHistorySelect} 
            onClose={() => {
                setViewState(ViewState.CAMERA);
            }} 
            onShowNotification={showNotification}
          />
        </Suspense>
      )}

      {/* Map View */}
      {viewState === ViewState.MAP && (
        <Suspense fallback={<ViewLoader />}>
          <MapView 
            onClose={() => setViewState(ViewState.CAMERA)} 
          />
        </Suspense>
      )}

       {/* Settings View */}
       {viewState === ViewState.SETTINGS && (
        <Suspense fallback={<ViewLoader />}>
          <SettingsView 
            onBack={() => {
                setViewState(ViewState.CAMERA);
                analysisAbortRef.current?.abort();
                dispatchScan({ type: 'RESET' });
            }} 
          />
        </Suspense>
      )}

    </div>
  );
};

export default App;
