import React, { useEffect, useMemo, useRef, useState } from 'react';
import BuildMeScreen, { BuildRoute } from './components/BuildMeScreen';
import MrSlopTerminal from './components/MrSlopTerminal';
import PartPicker from './components/PartPicker';
import SpecimenSidebar from './components/SpecimenSidebar';
import { SLOP_LIBRARY } from './data/slopLibrary';
import { createGenome, selectSurpriseComponents } from './lib/genome';
import { forkSpecimen, nextForkName } from './lib/lineage';
import { compileFuseGenome, MR_SLOP_FUSE_VERSION } from './services/kernelCompiler';
import { loadSpecimens, makeSpecimen, saveSpecimens } from './services/specimenStore';
import { GenomeMode, Specimen } from './types';

type Screen = 'build' | 'parts' | 'chat';

function App() {
  const [screen, setScreen] = useState<Screen>('build');
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const specimensRef = useRef<Specimen[]>([]);
  const [activeSpecimen, setActiveSpecimen] = useState<Specimen | null>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [showSpecimens, setShowSpecimens] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    void loadSpecimens().then(loaded => {
      specimensRef.current = loaded;
      setSpecimens(loaded);
      setIsLoaded(true);
    });
  }, []);

  const storeList = async (next: Specimen[]) => {
    specimensRef.current = next;
    setSpecimens(next);
    await saveSpecimens(next);
  };

  const persistSpecimen = async (next: Specimen) => {
    const current = specimensRef.current;
    const exists = current.some(specimen => specimen.id === next.id);
    const list = exists
      ? current.map(specimen => specimen.id === next.id ? next : specimen)
      : [...current, next];
    setActiveSpecimen(next);
    await storeList(list);
  };

  const createBuildingSpecimen = async () => {
    const emptyGenome = createGenome([], SLOP_LIBRARY, 'stack');
    const next = makeSpecimen(emptyGenome, 'NEW SPECIMEN', 'building');
    await persistSpecimen(next);
    setActiveSpecimen(next);
    setScreen('chat');
  };

  const createSurpriseSpecimen = async () => {
    const ids = selectSurpriseComponents(SLOP_LIBRARY);
    const genome = createGenome(ids, SLOP_LIBRARY, 'stack');
    const next = makeSpecimen(genome, 'SURPRISE SLOP', 'spawned');
    await persistSpecimen(next);
    setActiveSpecimen(next);
    setScreen('chat');
  };

  const handleRoute = async (route: BuildRoute) => {
    setAppError(null);
    if (route === 'parts') {
      setScreen('parts');
      return;
    }
    if (route === 'specimen') {
      setShowSpecimens(true);
      return;
    }

    setIsPreparing(true);
    try {
      if (route === 'surprise') await createSurpriseSpecimen();
      else await createBuildingSpecimen();
    } catch {
      setAppError('Mr. Slop tripped over his own shoelaces while creating the specimen. Try again.');
    } finally {
      setIsPreparing(false);
    }
  };

  const spawnPicked = async (mode: GenomeMode) => {
    if (selectedPartIds.length === 0 || isPreparing) return;
    setAppError(null);
    setIsPreparing(true);
    try {
      let genome = createGenome(selectedPartIds, SLOP_LIBRARY, mode);
      if (mode === 'fuse') {
        const compiledKernel = await compileFuseGenome(genome);
        genome = {
          ...genome,
          compiledKernel,
          compiledAt: Date.now(),
          compilerVersion: MR_SLOP_FUSE_VERSION,
        };
      }
      const next = makeSpecimen(
        genome,
        mode === 'fuse' ? 'FUSED SLOP' : 'STACKED SLOP',
        'spawned',
      );
      await persistSpecimen(next);
      setActiveSpecimen(next);
      setSelectedPartIds([]);
      setScreen('chat');
    } catch {
      setAppError(
        mode === 'fuse'
          ? 'FUSE did not compile cleanly. Nothing was spawned; you can retry or choose SPAWN STACK.'
          : 'That genome could not be created. Nothing was spawned.',
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const persistFork = async (suggestedName?: string): Promise<Specimen> => {
    if (!activeSpecimen) throw new Error('NO_ACTIVE_SPECIMEN');

    const source = specimensRef.current.find(item => item.id === activeSpecimen.id);
    if (!source) throw new Error('PARENT_SPECIMEN_NOT_FOUND');

    const childName = suggestedName?.trim() || nextForkName(source, specimensRef.current);
    const { parent, child } = forkSpecimen(source, childName);
    const nextList = [
      ...specimensRef.current.map(item => item.id === parent.id ? parent : item),
      child,
    ];

    await saveSpecimens(nextList);

    specimensRef.current = nextList;
    setSpecimens(nextList);
    setActiveSpecimen(parent);
    return child;
  };

  const openSpecimen = (specimen: Specimen) => {
    setActiveSpecimen(specimen);
    setScreen('chat');
    setShowSpecimens(false);
    setAppError(null);
  };

  const deleteSpecimen = async (id: string) => {
    const next = specimensRef.current.filter(specimen => specimen.id !== id);
    await storeList(next);
    if (activeSpecimen?.id === id) {
      setActiveSpecimen(null);
      setScreen('build');
    }
  };

  const specimenNames = useMemo(
    () => Object.fromEntries(specimens.map(specimen => [specimen.id, specimen.name])),
    [specimens],
  );

  const startAnother = () => {
    setShowSpecimens(false);
    setActiveSpecimen(null);
    setSelectedPartIds([]);
    setAppError(null);
    setScreen('build');
  };

  return (
    <div className="mr-slop-app selection:bg-fuchsia-400 selection:text-black">
      <div className="slop-noise" aria-hidden="true" />
      <div className="slop-scanlines" aria-hidden="true" />
      <div className="slop-vignette" aria-hidden="true" />

      <main className="mr-slop-main safe-top safe-bottom safe-left safe-right">
        {!isLoaded ? (
          <div className="route-selection-toast" role="status">
            <span>WAKING UP</span>
            <strong>MR. SLOP</strong>
            <small>Checking the specimen jars...</small>
          </div>
        ) : screen === 'parts' ? (
          <PartPicker
            library={SLOP_LIBRARY}
            selectedIds={selectedPartIds}
            onChange={setSelectedPartIds}
            onSpawn={mode => void spawnPicked(mode)}
            onCancel={() => {
              setScreen('build');
              setAppError(null);
            }}
          />
        ) : screen === 'chat' && activeSpecimen ? (
          <MrSlopTerminal
            specimen={activeSpecimen}
            onChange={persistSpecimen}
            onOpenSpecimens={() => setShowSpecimens(true)}
            onNewSpecimen={startAnother}
            onForkSpecimen={persistFork}
            onOpenSpecimen={openSpecimen}
            specimenNames={specimenNames}
          />
        ) : (
          <BuildMeScreen specimenCount={specimens.length} onChoose={route => void handleRoute(route)} />
        )}

        {isPreparing && (
          <div className="route-selection-toast" role="status">
            <span>BUILDING</span>
            <strong>HOLD ON, THIS PART ACTUALLY MATTERS</strong>
            <small>{screen === 'parts' ? 'Assembling the selected genome...' : 'Growing a specimen jar...'}</small>
          </div>
        )}

        {appError && (
          <div className="app-error-pop" role="alert">
            <strong>MR. SLOP HIT SOMETHING</strong>
            <span>{appError}</span>
            <button type="button" onClick={() => setAppError(null)}>OK</button>
          </div>
        )}
      </main>

      {showSpecimens && (
        <SpecimenSidebar
          specimens={specimens}
          activeSpecimenId={activeSpecimen?.id}
          onOpen={openSpecimen}
          onNew={startAnother}
          onDelete={id => void deleteSpecimen(id)}
          onClose={() => setShowSpecimens(false)}
        />
      )}
    </div>
  );
}

export default App;
