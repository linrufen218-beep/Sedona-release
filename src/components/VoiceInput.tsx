import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onResult, className = '', size = 'default' }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onResult(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        // Recognition might already be starting or started
        console.error('Failed to start recognition:', err);
        setIsListening(false);
      }
    }
  };

  if (!isSupported) return null;

  const sizeClasses = {
    sm: 'w-8 h-8',
    default: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSize = size === 'sm' ? 14 : 18;

  return (
    <div className={`relative ${className}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`rounded-full transition-all duration-300 ${
          isListening 
            ? 'bg-primary/20 text-primary hover:bg-primary/30 animate-pulse' 
            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
        } ${sizeClasses[size]}`}
        onClick={toggleListening}
      >
        <Mic className={`w-[${iconSize}px] h-[${iconSize}px] ${!isListening ? 'opacity-60' : ''}`} />
      </Button>
      
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-popover border border-border px-3 py-1 rounded-full shadow-lg whitespace-nowrap z-50 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-medium">正在听...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
