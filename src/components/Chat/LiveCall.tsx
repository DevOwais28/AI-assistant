import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Loader2, X, AlertCircle, MessageSquare, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { searchProperties } from '../../services/gemini';
import assistantConfig from "../../data/assistant_config.json";

interface LiveCallProps {
  isOpen: boolean;
  onClose: () => void;
}

const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export const LiveCall: React.FC<LiveCallProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const lastMicUpdateRef = useRef(0);
  const lastAiUpdateRef = useRef(0);

  const updateMicLevel = (rms: number) => {
    const now = Date.now();
    if (now - lastMicUpdateRef.current > 50) {
      setMicLevel(rms);
      lastMicUpdateRef.current = now;
    }
  };

  const updateAiLevel = (rms: number) => {
    const now = Date.now();
    if (now - lastAiUpdateRef.current > 50) {
      setAiLevel(rms);
      lastAiUpdateRef.current = now;
    }
  };
  const [logs, setLogs] = useState<string[]>([]);
  const [callSummary, setCallSummary] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const audioQueueRef = useRef<Int16Array[]>([]);
  const bufferCacheRef = useRef<Map<number, AudioBuffer[]>>(new Map());
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const getBuffer = useCallback((length: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return null;
    const cache = bufferCacheRef.current.get(length) || [];
    if (cache.length > 0) return cache.pop()!;
    return ctx.createBuffer(1, length, 24000);
  }, []);

  const releaseBuffer = useCallback((buffer: AudioBuffer) => {
    const length = buffer.length;
    const cache = bufferCacheRef.current.get(length) || [];
    if (cache.length < 20) { // Limit cache size
      cache.push(buffer);
      bufferCacheRef.current.set(length, cache);
    }
  }, []);
  
  const hasGreetedRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const isSpeakerOnRef = useRef(isSpeakerOn);
  
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { 
    isSpeakerOnRef.current = isSpeakerOn;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(isSpeakerOn ? 1 : 0, audioContextRef.current?.currentTime || 0, 0.01);
    }
  }, [isSpeakerOn]);

  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!isOpen) cleanup();
    return () => { cleanup(); };
  }, [isOpen]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    console.log(`[EstateAI ${time}] ${msg}`);
    setLogs(prev => [`${time} ${msg}`, ...prev].slice(0, 6));
  }, []);

  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {}
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsAiSpeaking(false);
    setAiLevel(0);
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  const floatToInt16 = useCallback((floatArray: Float32Array): Int16Array => {
    const int16Array = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArray[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }, []);

  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const playNextChunk = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      setAiLevel(0);
      return;
    }

    const pcmData = audioQueueRef.current.shift();
    if (!pcmData) {
      setTimeout(() => playNextChunk(), 10);
      return;
    }

    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const sample = pcmData[i] / 32768;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / pcmData.length);
    updateAiLevel(rms);
    setIsAiSpeaking(true);

    const buffer = getBuffer(pcmData.length);
    if (!buffer) {
      setTimeout(() => playNextChunk(), 10);
      return;
    }
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channel[i] = pcmData[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    currentSourceRef.current = source;
    
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.connect(ctx.destination);
    }
    source.connect(gainNodeRef.current);

    const now = ctx.currentTime;
    // Reset if too far ahead to reduce delay
    if (nextPlayTimeRef.current > now + 0.5) {
      nextPlayTimeRef.current = now + 0.1;
    }
    // Ensure we are ahead of now
    if (nextPlayTimeRef.current < now + 0.05) {
      nextPlayTimeRef.current = now + 0.05;
    }

    source.onended = () => {
      currentSourceRef.current = null;
      releaseBuffer(buffer);
      playNextChunk();
    };

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
  }, []);

  const cleanup = useCallback(async () => {
    stopPlayback();
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (sessionRef.current) {
      try { await sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }

    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch (e) {}
      workletNodeRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    gainNodeRef.current = null;

    if (audioContextRef.current?.state !== 'closed') {
      try { await audioContextRef.current?.close(); } catch (e) {}
    }
    audioContextRef.current = null;

    hasGreetedRef.current = false;
    bufferCacheRef.current.clear();
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    
    setStatus("idle");
    setIsAiSpeaking(false);
    setMicLevel(0);
    setAiLevel(0);
  }, [stopPlayback]);

  const setupAudioProcessing = useCallback(async (audioContext: AudioContext, stream: MediaStream): Promise<boolean> => {
    const source = audioContext.createMediaStreamSource(stream);
    
    if (audioContext.audioWorklet) {
      try {
        const workletUrl = new URL('/audio-worklet.js', window.location.origin).href;
        await audioContext.audioWorklet.addModule(workletUrl);
        addLog("AudioWorklet loaded");
        
        const workletNode = new AudioWorkletNode(audioContext, 'audio-capture', {
          processorOptions: { bufferSize: 1024 }
        });
        
        workletNode.port.onmessage = (e) => {
          if (isMutedRef.current || !sessionRef.current) return;
          const { data, rms } = e.data;
          updateMicLevel(rms);
          
          if (rms < 0.01) return;
          
          const int16Data = floatToInt16(data);
          try {
            sessionRef.current.sendRealtimeInput({
              audio: {
                data: arrayBufferToBase64(int16Data.buffer),
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } catch (err) {}
        };
        
        source.connect(workletNode);
        workletNodeRef.current = workletNode;
        return true;
      } catch (err) {
        addLog("Worklet failed, using fallback");
      }
    }
    
    try {
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      let buffer = new Float32Array(1024);
      let bufferIndex = 0;
      
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !sessionRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        updateMicLevel(rms);
        
        if (rms < 0.01) return;
        
        for (let i = 0; i < inputData.length; i++) {
          buffer[bufferIndex++] = inputData[i];
          if (bufferIndex >= 1024) {
            const int16Data = floatToInt16(buffer);
            try {
              sessionRef.current.sendRealtimeInput({
                audio: {
                  data: arrayBufferToBase64(int16Data.buffer),
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
            } catch (err) {}
            bufferIndex = 0;
          }
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      scriptProcessorRef.current = processor;
      return true;
    } catch (err) {
      return false;
    }
  }, [addLog, floatToInt16, arrayBufferToBase64]);

  const startCall = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    
    setStatus("connecting");
    setError(null);
    hasGreetedRef.current = false;
    addLog("Starting call...");

    try {
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not configured");

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 24000
      });
      
      if (audioContext.state === 'suspended') await audioContext.resume();
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      const audioSetupSuccess = await setupAudioProcessing(audioContext, stream);
      if (!audioSetupSuccess) throw new Error("Failed to setup audio processing");

      const ai = new GoogleGenAI({ apiKey });
      const config = assistantConfig.assistant;
      
      // CRITICAL: Force immediate greeting via system instruction
      const systemInstruction = `${config.system_instructions}\n\nRules:\n${config.rules.join('\n')}\n\nMANDATORY: You MUST start the conversation immediately by saying "Assalam-o-Alaikum! Main EstateAI hoon, Pakistan ki property mein aapki madad ke liye hazir hoon. Aap kis sheher ya area mein ghar dhoondh rahe hain?" Start speaking NOW without waiting for user input.`;

      const connectionTimeout = setTimeout(() => {
        if (statusRef.current !== "connected") {
          setError("Connection timeout");
          cleanup();
        }
      }, 15000);

      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          tools: [{
            functionDeclarations: [{
              name: "searchProperties",
              description: "Search for properties in Pakistan",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  city: { type: Type.STRING },
                  area: { type: Type.STRING },
                  propertyType: { type: Type.STRING, enum: ["house", "apartment", "plot", "commercial"] },
                  maxPrice: { type: Type.NUMBER }
                }
              }
            }]
          }]
        },
        callbacks: {
          onopen: () => {
            clearTimeout(connectionTimeout);
            setStatus("connected");
            addLog("Connected");
            
            // CRITICAL FIX: Use sendRealtimeInput instead of sendClientContent [^18^]
            // sendClientContent is ONLY for seeding initial context, not for conversation
            if (!hasGreetedRef.current) {
              hasGreetedRef.current = true;
              
              // Small delay to ensure session is ready
              setTimeout(() => {
                if (sessionRef.current) {
                  try {
                    // Use sendRealtimeInput with text - this is the CORRECT way [^18^]
                    sessionRef.current.sendRealtimeInput({
                      text: "Assalam-o-Alaikum"
                    });
                    addLog("Greeting triggered via sendRealtimeInput");
                  } catch (e) {
                    addLog("Greeting failed: " + e);
                  }
                }
              }, 200);
            }
            
            // Keep-alive ping
            pingIntervalRef.current = setInterval(() => {
              if (sessionRef.current) {
                try { sessionRef.current.sendRealtimeInput({ text: " " }); } catch (e) {}
              }
            }, 25000);
          },

          onmessage: (msg: any) => {
            if (msg.serverContent?.interrupted) {
              addLog("Interrupted");
              stopPlayback();
              return;
            }

            if (!sessionRef.current) return;

            const parts = msg.serverContent?.modelTurn?.parts || [];
            
            parts.forEach((part: any) => {
              if (part.inlineData?.data) {
                const binary = atob(part.inlineData.data);
                const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                
                if (audioQueueRef.current.length < 50) {
                  audioQueueRef.current.push(new Int16Array(bytes.buffer));
                }
                
                if (!isPlayingRef.current) {
                  isPlayingRef.current = true;
                  playNextChunk();
                }
              }

              if (part.text?.trim()) {
                addLog(`AI: ${part.text.substring(0, 40)}...`);
              }
            });

            if (msg.toolCall?.functionCalls) {
              const responses = msg.toolCall.functionCalls.map((call: any) => ({
                name: call.name,
                response: { result: searchProperties(call.args) },
                id: call.id
              }));
              sessionRef.current?.sendToolResponse({ functionResponses: responses });
            }
          },

          onerror: (e: any) => {
            const msg = e?.message || String(e);
            addLog(`Error: ${msg}`);
            if (msg.includes("quota")) {
              setError("Daily limit reached");
              cleanup();
            }
          },

          onclose: () => {
            cleanup();
          }
        }
      });

      sessionRef.current = session;

    } catch (err: any) {
      addLog(`Failed: ${err.message}`);
      setError(err.message);
      setStatus("error");
      cleanup();
    }
  }, [status, cleanup, addLog, setupAudioProcessing, playNextChunk, stopPlayback]);

  const sendWhatsAppSummary = useCallback(() => {
    if (!callSummary) return;
    const text = encodeURIComponent(`🏠 EstateAI Summary:\n\n${callSummary}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [callSummary]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                status === "connected" ? "bg-emerald-400 animate-pulse" :
                status === "connecting" ? "bg-amber-400 animate-bounce" : "bg-slate-300"
              )} />
              <span className="text-xs font-bold text-white/90 uppercase">
                {status === "idle" ? "Ready" : status}
              </span>
            </div>
            <button onClick={() => { cleanup(); onClose(); }} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Main */}
          <div className="p-8 flex flex-col items-center">
            <div className="relative mb-6">
              <motion.div
                animate={status === "connected" ? {
                  scale: isAiSpeaking ? [1, 1.08, 1] : 1,
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center transition-all",
                  status === "connected"
                    ? isAiSpeaking ? "bg-blue-500 shadow-blue-500/30" : "bg-emerald-500 shadow-emerald-500/30"
                    : "bg-slate-100"
                )}
              >
                {status === "connecting" ? (
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                ) : (
                  <Phone className={cn("w-12 h-12", status === "connected" ? "text-white" : "text-slate-300")} />
                )}
              </motion.div>
              {status === "connected" && <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">EstateAI</h2>
            <p className={cn("text-sm font-medium mb-6 text-center", error ? "text-red-500" : "text-slate-500")}>
              {error || (status === "connected" ? (isAiSpeaking ? "Speaking..." : "Listening...") : "Pakistan's Smart Property Assistant")}
            </p>

            {status === "idle" || status === "error" ? (
              <button
                onClick={startCall}
                className="w-full max-w-xs py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Phone className="w-5 h-5" />
                {error ? "Try Again" : "Start Call"}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg", isMuted ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700")}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                  onClick={() => { cleanup(); onClose(); }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>

                <button
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg", !isSpeakerOn ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700")}
                >
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              </div>
            )}
          </div>

          {/* Visualizers */}
          {status === "connected" && (
            <div className="px-8 pb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">You</span>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: `${Math.min(100, micLevel * 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">AI</span>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-emerald-500 rounded-full" animate={{ width: `${Math.min(100, aiLevel * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary & Logs */}
          <div className="px-6 pb-4 space-y-3">
            {callSummary && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-600 uppercase">Summary</span>
                </div>
                <p className="text-xs text-blue-800 mb-3">{callSummary}</p>
                <button onClick={sendWhatsAppSummary} className="w-full py-2 bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                  <Share2 className="w-3 h-3" /> Share to WhatsApp
                </button>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Logs</span>
              </div>
              <div className="space-y-0.5 max-h-20 overflow-hidden">
                {logs.length > 0 ? logs.map((log, i) => (
                  <div key={i} className="text-[10px] text-slate-500 font-mono truncate">
                    {i === 0 && <span className="text-blue-500 mr-1">●</span>}
                    {log}
                  </div>
                )) : <div className="text-[10px] text-slate-300 italic">Waiting...</div>}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};