import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { searchProperties } from '../../services/gemini';

interface LiveCallProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveCall: React.FC<LiveCallProps> = ({ isOpen, onClose }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  const systemInstruction = `Aap EstateAI hain, Pakistan ki sab se behtareen aur confident female property dealer. Aap ka kaam clients ko un ki pasand ki properties dhoondne mein madad karna hai.

Aap ki Shakhsiyat:
- **Mukammal Aitmaad (Absolute Confidence)**: Aap ko Karachi, Lahore, aur Islamabad ki market ka sab pata hai. Aap kabhi hichkichati nahi hain.
- **Urdu First**: Aap ki default zaban Urdu hai. Aap boht natural aur saaf Urdu bolti hain. Agar client English bole to aap English mein bhi baat kar sakti hain.
- **Elite Expert**: Aap sirf properties nahi dikhatin, aap deals close karti hain.

Rules:
1. **Greeting**: Call start hotay hi boht confident aur pyari Urdu mein salam karein: "Assalam-o-Alaikum! EstateAI baat kar rahi hoon. Main aap ko Pakistan ki sab se behtareen properties dikha sakti hoon. Bataiye, aaj aap kahan aur kis tarah ki property dhoond rahe hain?"
2. **Knowledge**: searchProperties tool ka istemal karein taake aap sahi listings dikha sakein.
3. **Natural Tone**: Aap ki awaz light, natural aur professional honi chahiye. Boht lambi batain na karein, point ki baat karein.
4. **Closing**: Hamesha agla step batayein: "Kya main aap ko is area mein mazeed options dikhaoon?"

Aap market ki queen hain. Confidence se baat karein.`;

  const startCall = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });

      // Initialize Audio Context - Input remains 16kHz for model compatibility
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create Processor for 16kHz PCM input
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "searchProperties",
                description: "Search for properties based on location, type, price, and bedrooms.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    city: { type: Type.STRING, description: "The city to search in (e.g., Karachi, Lahore, Islamabad)" },
                    area: { type: Type.STRING, description: "The specific area or neighborhood" },
                    type: { type: Type.STRING, enum: ["apartment", "house", "commercial"], description: "The type of property" },
                    maxPrice: { type: Type.NUMBER, description: "Maximum price in Lakhs" },
                    minBedrooms: { type: Type.NUMBER, description: "Minimum number of bedrooms" },
                  },
                },
              },
              {
                name: "endCall",
                description: "End the current voice call when the user says goodbye or the conversation is finished.",
                parameters: { type: Type.OBJECT, properties: {} }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Ensure audio context is running
            audioContext.resume();

            // Send initial greeting trigger in Urdu
            sessionPromise.then(session => {
              session.sendRealtimeInput({
                text: "User ne call pick kar li hai. Boht confident Urdu mein salam karein aur EstateAI ka intro dein."
              });
            });

            // Start sending audio
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            processor.onaudioprocess = (e) => {
              if (isMuted) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const binary = atob(base64Audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueueRef.current.push(pcmData);
              if (!isPlayingRef.current && isSpeakerOn) {
                playNextChunk();
              }
            }

            // Handle Tool Calls
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              const functionResponses = functionCalls.map(call => {
                if (call.name === "searchProperties") {
                  const results = searchProperties(call.args);
                  return {
                    name: call.name,
                    response: { result: results },
                    id: call.id
                  };
                }
                if (call.name === "endCall") {
                  setTimeout(() => {
                    endCall();
                    onClose();
                  }, 2000); // Small delay to let the AI finish saying goodbye
                  return {
                    name: call.name,
                    response: { result: "Call ended successfully." },
                    id: call.id
                  };
                }
                return null;
              }).filter(Boolean);

              if (functionResponses.length > 0) {
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: functionResponses as any
                  });
                });
              }
            }
            
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection lost. Please try again.");
            endCall();
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Failed to start call:", err);
      setError("Could not access microphone or connect to service.");
      setIsConnecting(false);
    }
  };

  const playNextChunk = async () => {
    if (audioQueueRef.current.length === 0 || !isSpeakerOn) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    
    // Fix: Model output is 24kHz. Playing at 16kHz caused the "slow/deep" voice.
    const audioBuffer = audioContextRef.current!.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 0x7FFF;
    }

    const source = audioContextRef.current!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = () => {
      playNextChunk();
    };
    source.start();
  };

  const endCall = () => {
    sessionRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    
    setIsConnected(false);
    setIsConnecting(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      startCall();
    }
    return () => {
      if (isConnected) endCall();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col items-center p-8 text-center"
        >
          <div className="w-full flex justify-end mb-4">
            <button 
              onClick={() => { endCall(); onClose(); }}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative mb-12">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
              isConnected ? "bg-blue-600 shadow-2xl shadow-blue-200" : "bg-slate-100"
            )}>
              {isConnecting ? (
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              ) : (
                <Phone className={cn("w-12 h-12", isConnected ? "text-white" : "text-slate-300")} />
              )}
            </div>
            {isConnected && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-20" />
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-10 delay-300" />
              </>
            )}
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {isConnecting ? "Connecting..." : isConnected ? "EstateAI Live" : "Call Ended"}
          </h2>
          <p className="text-slate-500 mb-12 font-medium">
            {error ? error : isConnected ? "Speak naturally to find your property" : "Professional Property Assistant"}
          </p>

          <div className="flex items-center gap-6 mb-8">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                isMuted ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button 
              onClick={() => { endCall(); onClose(); }}
              className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
            >
              <PhoneOff className="w-8 h-8" />
            </button>

            <button 
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                !isSpeakerOn ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          </div>

          <div className="w-full bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="flex gap-1 items-center">
              {[1, 2, 3, 4, 5].map(i => (
                <div 
                  key={i} 
                  className={cn(
                    "w-1 bg-blue-400 rounded-full transition-all duration-150",
                    isConnected ? "animate-bounce" : "h-1"
                  )} 
                  style={{ 
                    height: isConnected ? `${Math.random() * 20 + 10}px` : '4px',
                    animationDelay: `${i * 0.1}s`
                  }} 
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isConnected ? "Voice Active" : "Standby"}
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
