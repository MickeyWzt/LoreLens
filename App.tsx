
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { decipherImage } from './services/geminiService';
import { DecipherResult, HistoryItem, ViewState } from './types';
import { triggerHaptic, compressHistoryImage } from './utils';
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
  // State
  const [viewState, setViewState] = useState<ViewState>(ViewState.CAMERA);
  const [isHomeOpen, setIsHomeOpen] = useState(true); // Default to Home View
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCropping, setIsCropping] = useState(false); // New State for Crop Mode
  const [currentResult, setCurrentResult] = useState<DecipherResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // Camera Optimization State
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Stores
  const { theme, language, fontSize, saveToGallery, highResAudio } = useSettingsStore();
  const { history, setHistory, loadHistory } = useHistoryStore();
  
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


  // Helper to get location
  const getCurrentLocation = (): Promise<{lat: number, lng: number} | undefined> => {
      return new Promise((resolve) => {
          const fallbackLocation = { lat: 39.9042, lng: 116.4074 }; // Default to Beijing
          
          if (!navigator.geolocation) {
              showNotification("Geolocation not supported, using default");
              resolve(fallbackLocation);
              return;
          }
          
          navigator.geolocation.getCurrentPosition(
              (position) => resolve({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
              }),
              (err) => {
                  console.warn("Geolocation error", err);
                  if (err.code === 1) { // PERMISSION_DENIED
                      showNotification("Location denied, using default (Beijing)");
                  } else if (err.code === 3) { // TIMEOUT
                      showNotification("Location timeout, using default");
                  } else {
                      showNotification("Location unavailable, using default");
                  }
                  resolve(fallbackLocation);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      });
  };

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
     
     setCapturedImage(base64Image);
     setIsCropping(true); // Trigger Crop View
  }, []);

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
           setCapturedImage(reader.result);
           setIsCropping(true); // Trigger Crop View
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
      setIsCropping(false);
      setCapturedImage(croppedBase64); // Update displayed image to the cropped version
      
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

      processImage(croppedBase64);
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    
    try {
        // Get Location
        const location = await getCurrentLocation();
        
        // Pass language to service
        const result = await decipherImage(base64, location, language);
        setCurrentResult(result);
        setIsDrawerOpen(true);
        
        const compressedThumbnail = await compressHistoryImage(base64);

        const newItem: HistoryItem = {
            ...result,
            id: Date.now().toString(),
            timestamp: Date.now(),
            thumbnail: compressedThumbnail,
            location: location
        };
        setHistory(prev => [newItem, ...prev]);

    } catch (error) {
        console.error(error);
        showNotification("Analysis failed. Try again.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const resetCamera = () => {
    setIsDrawerOpen(false);
    setIsCropping(false);
    setTimeout(() => {
        setCapturedImage(null);
        setCurrentResult(null);
    }, 300);
  };

  const handleHistorySelect = (item: HistoryItem) => {
      setViewState(ViewState.CAMERA);
      setIsHomeOpen(false); // Close home to see detail
      setCapturedImage(item.thumbnail || null);
      setCurrentResult(item);
      setIsDrawerOpen(true);
  };

  // Handlers for Home View transitions
  const startScan = () => setIsHomeOpen(false);
  const openHistory = () => setViewState(ViewState.HISTORY);
  const openSettings = () => setViewState(ViewState.SETTINGS);
  const backToHome = () => {
      resetCamera();
      setIsHomeOpen(true);
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden font-sans transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      
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
                         <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={handleFileUpload}
                         />

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
                setIsHomeOpen(true);
            }} 
          />
      )}

    </div>
  );
};

export default App;
