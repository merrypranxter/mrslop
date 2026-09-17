import React from 'react';
import GlitchCanvas from './GlitchCanvas';
import { getVisualType, VisualType } from '../types';

interface ParsedMessageProps {
  content: string;
}

const ParsedMessage: React.FC<ParsedMessageProps> = ({ content }) => {
  // Guard against null/undefined content to prevent "Uncaught TypeError"
  if (!content) return null;

  // Regex logic:
  // 1. Tags: <visual ... />, <blink>...</blink>, etc.
  // 2. Code blocks: ```...``` (multiline)
  
  // We use a non-greedy capture for the content inside tags/blocks.
  const regex = /(<visual\s+type="[^"]+"\s*\/>|<blink>.*?<\/blink>|<marquee>.*?<\/marquee>|<color\s+c="[^"]+">.*?<\/color>|```[\s\S]*?```|!\[.*?\]\(.*?\))/g;
  
  const parts = content.split(regex);

  return (
    <span className="whitespace-pre-wrap leading-relaxed break-words break-all w-full block">
      {parts.map((part, index) => {
        if (!part) return null; // Skip empty parts from split

        if (part.startsWith('<visual')) {
          const match = part.match(/type="([^"]+)"/);
          if (match) {
            const type = getVisualType(match[1]);
            if (type) return <GlitchCanvas key={index} type={type} />;
          }
        } else if (part.startsWith('![')) {
           // Markdown Image
           const match = part.match(/!\[(.*?)\]\((.*?)\)/);
           if (match) {
               const alt = match[1];
               const src = match[2];
               return (
                   <div key={index} className="my-4 border border-green-800/50 rounded overflow-hidden bg-black/50 inline-block max-w-full">
                       <img src={src} alt={alt} className="max-w-full h-auto object-contain" />
                       {alt && <div className="text-[10px] text-green-800 p-1 font-mono uppercase border-t border-green-900/30">{alt}</div>}
                   </div>
               );
           }
        } else if (part.startsWith('<blink>')) {
          const text = part.replace(/<\/?blink>/g, '');
          return <span key={index} className="animate-pulse font-bold text-yellow-300">{text}</span>;
        } else if (part.startsWith('<marquee>')) {
          const text = part.replace(/<\/?marquee>/g, '');
          return (
            <div key={index} className="overflow-hidden border-y border-fuchsia-500/50 bg-fuchsia-900/10 py-1 my-2">
               <div className="animate-[marquee_10s_linear_infinite] whitespace-nowrap inline-block text-fuchsia-400 font-bold">
                 {text} &nbsp;&nbsp;&nbsp;&nbsp; {text} &nbsp;&nbsp;&nbsp;&nbsp; {text}
               </div>
            </div>
          );
        } else if (part.startsWith('<color')) {
          const colorMatch = part.match(/c="([^"]+)"/);
          const text = part.replace(/<color[^>]+>|<\/color>/g, '');
          const color = colorMatch ? colorMatch[1] : 'inherit';
          return <span key={index} style={{ color }}>{text}</span>;
        } else if (part.startsWith('```')) {
          // Code block / Data Snapshot
          // Strip the backticks and optional language identifier
          const lines = part.split('\n');
          // Remove first line (```json or just ```) and last line (```)
          const codeContent = lines.length > 2 ? lines.slice(1, -1).join('\n') : lines.join('\n').replace(/```/g, '');
          
          return (
            <div key={index} className="my-3 border border-green-700/50 bg-green-950/30 p-3 rounded font-mono text-xs md:text-sm text-green-300 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] max-w-full overflow-hidden">
              <div className="mb-1 text-[10px] uppercase opacity-50 border-b border-green-800 pb-1 w-fit">DATA_BLOCK.LOG</div>
              <pre className="whitespace-pre-wrap break-all w-full">{codeContent}</pre>
            </div>
          );
        }
        
        // Plain text
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default ParsedMessage;