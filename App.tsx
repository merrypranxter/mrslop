import React, { useState } from 'react';
import BuildMeScreen, { BuildRoute } from './components/BuildMeScreen';
import PartPicker from './components/PartPicker';
import { SLOP_LIBRARY } from './data/slopLibrary';
import { GenomeMode } from './types';

const ROUTE_LABELS: Record<BuildRoute, string> = {
  surprise: 'SURPRISE ME',
  idea: 'I HAVE AN IDEA',
  parts: 'LET ME PICK THE PARTS',
  specimen: 'START FROM A SPECIMEN',
};

function App() {
  const [selectedRoute, setSelectedRoute] = useState<BuildRoute | null>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<GenomeMode | null>(null);

  const handleRoute = (route: BuildRoute) => {
    setSelectedRoute(route);
    setSelectedMode(null);
  };

  const cancelParts = () => {
    setSelectedRoute(null);
    setSelectedMode(null);
  };

  return (
    <div className="mr-slop-app selection:bg-fuchsia-400 selection:text-black">
      <div className="slop-noise" aria-hidden="true" />
      <div className="slop-scanlines" aria-hidden="true" />
      <div className="slop-vignette" aria-hidden="true" />

      <main className="mr-slop-main safe-top safe-bottom safe-left safe-right">
        {selectedRoute === 'parts' ? (
          <PartPicker
            library={SLOP_LIBRARY}
            selectedIds={selectedPartIds}
            onChange={setSelectedPartIds}
            onSpawn={setSelectedMode}
            onCancel={cancelParts}
          />
        ) : (
          <BuildMeScreen specimenCount={0} onChoose={handleRoute} />
        )}

        {selectedRoute && selectedRoute !== 'parts' && (
          <div className="route-selection-toast" role="status">
            <span>ROUTE SELECTED</span>
            <strong>{ROUTE_LABELS[selectedRoute]}</strong>
            <small>Conversation handoff is the next wiring pass.</small>
          </div>
        )}

        {selectedRoute === 'parts' && selectedMode && (
          <div className="route-selection-toast" role="status">
            <span>GENOME READY</span>
            <strong>{selectedPartIds.length} PARTS / {selectedMode.toUpperCase()}</strong>
            <small>The next wiring pass turns this recipe into the live conversation.</small>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
