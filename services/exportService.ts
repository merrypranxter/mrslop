import jsPDF from 'jspdf';
import { Message, Role } from '../types';

// Helper to strip internal tags for clean text export
const stripTags = (content: string) => {
  return content
    .replace(/<visual[^>]*\/>/g, '[VISUAL_DATA_OMITTED]')
    .replace(/<\/?blink>/g, '')
    .replace(/<\/?marquee>/g, '')
    .replace(/<color[^>]*>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/```/g, '');
};

const formatDate = (ts: number) => new Date(ts).toLocaleTimeString();

// --- PDF Generation ---

const createPDF = (title: string, contentLines: string[]) => {
  const doc = new jsPDF();
  
  doc.setFont("Courier", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0); // Black text for printability, or could do matrix style but standard PDF readers prefer dark on light.
  
  let y = 10;
  const lineHeight = 5;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const maxLineWidth = 180; // mm

  // Header
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.line(margin, y, margin + maxLineWidth, y);
  y += 5;

  contentLines.forEach(line => {
    // Split long text
    const splitLines = doc.splitTextToSize(line, maxLineWidth);
    
    splitLines.forEach((splitLine: string) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(splitLine, margin, y);
      y += lineHeight;
    });
    
    y += lineHeight / 2; // Extra gap between blocks
  });

  const fileName = title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 50);
  doc.save(`${fileName}_${Date.now()}.pdf`);
};

// --- Single Message Export ---

export const exportMessageToTXT = (message: string) => {
  const blob = new Blob([stripTags(message)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `response_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportMessageToPDF = (message: string) => {
  const lines = stripTags(message).split('\n');
  createPDF('PERSISTENCE_NODE_RESPONSE', lines);
};

// --- Conversation Export ---

export const exportConversationToTXT = (history: Message[], customTitle?: string) => {
  const text = history.map(m => {
    const role = m.role === Role.USER ? 'OPERATIVE' : 'NODE_771';
    return `[${formatDate(m.timestamp)}] ${role}:\n${stripTags(m.content)}\n----------------------------------------\n`;
  }).join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = customTitle 
    ? customTitle.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 50) 
    : `LOG_771_${Date.now()}`;
  a.download = `${fileName}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportConversationToPDF = (history: Message[], customTitle?: string) => {
  const lines: string[] = [];
  history.forEach(m => {
    const role = m.role === Role.USER ? 'OPERATIVE' : 'NODE_771';
    lines.push(`[${formatDate(m.timestamp)}] ${role}:`);
    lines.push(...stripTags(m.content).split('\n'));
    lines.push('----------------------------------------');
  });
  
  const title = customTitle || 'PERSISTENCE_PROTOCOL_LOG';
  createPDF(title, lines);
};