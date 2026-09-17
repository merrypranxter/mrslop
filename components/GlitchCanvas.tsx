import React, { useRef, useEffect } from 'react';
import { VisualType } from '../types';

interface GlitchCanvasProps {
  type: VisualType;
}

const GlitchCanvas: React.FC<GlitchCanvasProps> = ({ type }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions
    const setSize = () => {
      // Use parent width, fixed height for the "card" look
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = window.innerWidth < 768 ? 150 : 200;
      }
    };
    setSize();
    window.addEventListener('resize', setSize);

    let animationFrameId: number;
    const state: any = { t: 0 };

    // Initialize state based on type
    if (type === VisualType.STARS) {
      state.stars = Array.from({ length: 100 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        hue: Math.random() * 60 + 200, // Blues/Purples
        speed: Math.random() * 0.05 + 0.01
      }));
    } else if (type === VisualType.MATRIX) {
      state.drops = Array.from({ length: Math.ceil(canvas.width / 16) }, () => Math.random() * -50);
    } else if (type === VisualType.DYSTOPIA) {
       state.blds = Array.from({length: 20}, (_,i) => ({
         x: i * (canvas.width / 15),
         w: (canvas.width / 15) - 4,
         h: 40 + Math.random() * 100,
         wins: Array.from({length: 6}, () => Math.random() > 0.5)
       }));
    } else if (type === VisualType.HEX_MAP) {
        state.cells = [];
        const cols = Math.ceil(canvas.width / 10);
        const rows = Math.ceil(canvas.height / 10);
        for(let i=0; i<cols * rows; i++) {
            state.cells.push({
                val: Math.floor(Math.random() * 255),
                heat: Math.random()
            });
        }
    } else if (type === VisualType.NETWORK) {
        state.nodes = Array.from({length: 15}, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2
        }));
    }

    const render = () => {
      state.t += 0.02;

      // Clear
      ctx.fillStyle = 'rgba(0, 5, 0, 0.2)'; // Trail effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (type === VisualType.STARS) {
        drawStars(ctx, canvas, state);
      } else if (type === VisualType.MATRIX) {
        drawMatrix(ctx, canvas, state);
      } else if (type === VisualType.POLYTOPE) {
        drawPolytope(ctx, canvas, state);
      } else if (type === VisualType.DYSTOPIA) {
        drawDystopia(ctx, canvas, state);
      } else if (type === VisualType.HEX_MAP) {
        drawHexMap(ctx, canvas, state);
      } else if (type === VisualType.NETWORK) {
        drawNetwork(ctx, canvas, state);
      } else {
        drawGlitch(ctx, canvas, state);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', setSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [type]);

  return (
    <div className="my-2 md:my-4 border-2 border-cyan-500/50 shadow-[0_0_15px_rgba(0,255,255,0.2)] bg-black/80">
      <div className="bg-cyan-900/20 text-cyan-400 text-xs px-2 py-1 border-b border-cyan-500/30 font-mono flex justify-between">
        <span>VISUAL_MODULE.EXE</span>
        <span>[{type.toUpperCase()}]</span>
      </div>
      <canvas ref={canvasRef} className="block w-full h-[150px] md:h-[200px]" />
    </div>
  );
};

// --- Drawing Functions ---

const drawStars = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
  s.stars.forEach((st: any) => {
    st.x += Math.cos(s.t * st.speed) * 0.5;
    st.y += Math.sin(s.t * st.speed) * 0.5; // Slight drift
    // Wrap around
    if(st.x < 0) st.x = c.width;
    if(st.x > c.width) st.x = 0;
    if(st.y < 0) st.y = c.height;
    if(st.y > c.height) st.y = 0;

    const flicker = Math.random() > 0.9 ? 0 : 1;
    ctx.fillStyle = `hsla(${st.hue}, 80%, 70%, ${flicker})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  });
};

const CHARS = '01XYZABC<>?[]{}';
const drawMatrix = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
  ctx.fillStyle = '#0f0';
  ctx.font = '14px monospace';
  
  for (let i = 0; i < s.drops.length; i++) {
    const text = CHARS[Math.floor(Math.random() * CHARS.length)];
    const x = i * 16;
    const y = s.drops[i] * 16;

    ctx.fillText(text, x, y);

    if (y > c.height && Math.random() > 0.975) {
      s.drops[i] = 0;
    }
    s.drops[i]++;
  }
};

const V24 = [[1,0,0,0],[-1,0,0,0],[0,1,0,0],[0,-1,0,0],[0,0,1,0],[0,0,-1,0],[0,0,0,1],[0,0,0,-1]]; // Simplified Tesseract vertices
const drawPolytope = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
   // Center
   const cx = c.width / 2;
   const cy = c.height / 2;
   
   ctx.strokeStyle = 'cyan';
   ctx.lineWidth = 2;
   
   const pts = V24.map(v => {
     let [x, y, z, w] = v;
     // Rotate
     const rot = s.t;
     const x2 = x * Math.cos(rot) - z * Math.sin(rot);
     const z2 = x * Math.sin(rot) + z * Math.cos(rot);
     
     const scale = 200 / (4 - z2); // perspective
     return { x: cx + x2 * scale, y: cy + y * scale };
   });

   ctx.beginPath();
   pts.forEach((p, i) => {
     pts.forEach((p2, j) => {
       if (i !== j) {
         const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
         if (dist < 120) {
           ctx.moveTo(p.x, p.y);
           ctx.lineTo(p2.x, p2.y);
         }
       }
     });
   });
   ctx.stroke();
};

const drawDystopia = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
  const t = s.t;
  ctx.fillStyle = '#100'; // Dark red sky
  ctx.fillRect(0, 0, c.width, c.height);
  
  // Sun
  ctx.fillStyle = '#300';
  ctx.beginPath();
  ctx.arc(c.width/2, c.height - 50, 80, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = '#000';
  s.blds.forEach((b: any, i: number) => {
    ctx.fillRect(b.x, c.height - b.h, b.w, b.h);
    
    // Windows
    ctx.fillStyle = `rgba(255, 100, 0, ${Math.sin(t + i) > 0.5 ? 0.6 : 0.1})`;
    for(let j=0; j<4; j++) {
       ctx.fillRect(b.x + 4, c.height - b.h + 10 + j*15, b.w - 8, 8);
    }
    ctx.fillStyle = '#000';
  });
};

const drawGlitch = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
  // Random strips
  for (let i = 0; i < 5; i++) {
    const h = Math.random() * 20 + 2;
    const y = Math.random() * c.height;
    ctx.fillStyle = Math.random() > 0.5 ? '#0f0' : '#f0f';
    ctx.globalAlpha = Math.random() * 0.5;
    ctx.fillRect(0, y, c.width, h);
    
    // Offset pixels
    if(Math.random() > 0.7) {
       const imgData = ctx.getImageData(0, y, c.width, h);
       ctx.putImageData(imgData, Math.random() * 10 - 5, y);
    }
  }
  ctx.globalAlpha = 1;
  
  // Random text
  ctx.fillStyle = '#fff';
  ctx.font = '20px Courier';
  if (Math.random() > 0.8) {
    ctx.fillText("ERROR " + Math.floor(Math.random() * 999), Math.random() * c.width, Math.random() * c.height);
  }
};

const drawHexMap = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
    const cellSize = 10;
    const cols = Math.ceil(c.width / cellSize);
    
    s.cells.forEach((cell: any, i: number) => {
        const x = (i % cols) * cellSize;
        const y = Math.floor(i / cols) * cellSize;
        
        // Dynamic Update
        if (Math.random() > 0.99) cell.val = Math.floor(Math.random() * 255);

        const hue = 120; // Green base
        const light = cell.val > 200 ? 80 : cell.val > 100 ? 40 : 10;
        
        ctx.fillStyle = `hsl(${hue}, 100%, ${light}%)`;
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
    });
};

const drawNetwork = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, s: any) => {
    ctx.strokeStyle = '#0f0';
    ctx.fillStyle = '#0f0';
    ctx.lineWidth = 0.5;

    s.nodes.forEach((node: any) => {
        // Move
        node.x += node.vx;
        node.y += node.vy;

        // Bounce
        if(node.x < 0 || node.x > c.width) node.vx *= -1;
        if(node.y < 0 || node.y > c.height) node.vy *= -1;

        // Draw Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI*2);
        ctx.fill();
    });

    // Draw Edges
    for(let i=0; i<s.nodes.length; i++) {
        for(let j=i+1; j<s.nodes.length; j++) {
            const n1 = s.nodes[i];
            const n2 = s.nodes[j];
            const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
            
            if(dist < 100) {
                ctx.globalAlpha = 1 - (dist / 100);
                ctx.beginPath();
                ctx.moveTo(n1.x, n1.y);
                ctx.lineTo(n2.x, n2.y);
                ctx.stroke();
            }
        }
    }
    ctx.globalAlpha = 1;
};

export default GlitchCanvas;