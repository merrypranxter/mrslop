import React from 'react';
import Terminal from './components/Terminal';

function App() {
  return (
    <div className="relative min-h-[100dvh] bg-black text-green-500 font-['Courier_Prime'] overflow-x-hidden selection:bg-green-500 selection:text-black w-full">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0a2a0a_0%,_#000000_90%)] z-0"></div>
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
           style={{
             backgroundImage: 'linear-gradient(#0f0 1px, transparent 1px), linear-gradient(90deg, #0f0 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }}>
      </div>

      {/* Main Content */}
      <main className="relative z-10 h-[100dvh] flex items-center justify-center p-0 md:p-6 lg:p-10 w-full overflow-hidden">
        <Terminal />
      </main>

      {/* CRT Effects Layer (Global Overlay) */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden h-[100dvh] w-full">
         <div className="scan-line absolute top-0 left-0 w-full h-full"></div>
         <div className="crt-overlay absolute top-0 left-0 w-full h-full opacity-30 md:opacity-60"></div>
         {/* Vignette */}
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]"></div>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

export default App;