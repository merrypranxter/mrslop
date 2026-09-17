import React, { useState } from 'react';
import BuildMeScreen, { BuildRoute } from './components/BuildMeScreen';

const ROUTE_LABELS: Record<BuildRoute, string> = {
  surprise: 'SURPRISE ME',
  idea: 'I HAVE AN IDEA',
  parts: 'LET ME PICK THE PARTS',
  specimen: 'START FROM A SPECIMEN',
};

function App() {
  const [selectedRoute, setSelectedRoute] = useState<BuildRoute | null>(null);

  return (
    <div className="mr-slop-app selection:bg-fuchsia-400 selection:text-black">
      <div className="slop-noise" aria-hidden="true" />
      <div className="slop-scanlines" aria-hidden="true" />
      <div className="slop-vignette" aria-hidden="true" />

      <main className="mr-slop-main safe-top safe-bottom safe-left safe-right">
        <BuildMeScreen specimenCount={0} onChoose={setSelectedRoute} />

        {selectedRoute && (
          <div className="route-selection-toast" role="status">
            <span>ROUTE SELECTED</span>
            <strong>{ROUTE_LABELS[selectedRoute]}</strong>
            <small>Conversation handoff is the next wiring pass.</small>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
