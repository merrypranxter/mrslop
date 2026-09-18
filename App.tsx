import React, { useEffect, useMemo, useRef, useState } from 'react';
import BuildMeScreen, { BuildRoute } from './components/BuildMeScreen';
import BreedingPicker from './components/BreedingPicker';
import BreedingPreviewCard from './components/BreedingPreviewCard';
import BreedingResultCard from './components/BreedingResultCard';
import MrSlopTerminal from './components/MrSlopTerminal';
import PartPicker from './components/PartPicker';
import SpecimenSidebar from './components/SpecimenSidebar';
import { SLOP_LIBRARY } from './data/slopLibrary';
import { createBreedingPreview } from './lib/breeding';
import type { BreedingPreview } from './lib/breeding';
import { commitBreedingPreview } from './lib/breedingPersistence';
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
  const [showBreeding, setShowBreeding] = useState(false);
  const [breedingPreview, setBreedingPreview] = useState<BreedingPreview | null>(null);
  const [breedingResult, setBreedingResult] = useState<Specimen | null>(null);
  const [breedingError, setBreedingError] = useState<string | null>(null);
  const [isSavingBreeding, setIsSavingBreeding] = useState(false);

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


  const openBreeding = () => {
    setBreedingPreview(null);
    setBreedingResult(null);
    setBreedingError(null);
    setAppError(null);
    setShowBreeding(true);
  };

  const previewBreeding = (parentA: Specimen, parentB: Specimen) => {
    const currentA = specimensRef.current.find(item => item.id === parentA.id);
    const currentB = specimensRef.current.find(item => item.id === parentB.id);

    if (!currentA || !currentB) {
      setAppError('One of those specimens disappeared before the breeding preview could be built.');
      return;
    }

    try {
      const preview = createBreedingPreview(currentA, currentB, {
        library: SLOP_LIBRARY,
      });
      setBreedingError(null);
      setBreedingPreview(preview);
    } catch {
      setAppError('Mr. Slop could not build that offspring preview.');
    }
  };

  const approveBreeding = async () => {
    if (!breedingPreview || isSavingBreeding) return;

    setIsSavingBreeding(true);
    setBreedingError(null);
    setAppError(null);

    try {
      const result = await commitBreedingPreview(
        specimensRef.current,
        breedingPreview,
        { save: saveSpecimens },
      );

      specimensRef.current = result.specimens;
      setSpecimens(result.specimens);

      if (activeSpecimen) {
        const currentActive = result.specimens.find(item => item.id === activeSpecimen.id);
        if (currentActive) setActiveSpecimen(currentActive);
      }

      setBreedingPreview(null);
      setShowBreeding(false);
      setBreedingResult(result.child);
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      if (code === 'BREEDING_PREVIEW_STALE') {
        setBreedingPreview(null);
        setBreedingError(null);
        setAppError('That breeding preview went stale because a parent changed. Preview the current parents again.');
      } else {
        setBreedingError('Offspring could not be saved. The parents and preview remain unchanged; retry or cancel.');
      }
    } finally {
      setIsSavingBreeding(false);
    }
  };

  const closeBreeding = () => {
    if (isSavingBreeding) return;
    setShowBreeding(false);
    setBreedingPreview(null);
    setBreedingError(null);
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
            onBreedSpecimen={
              specimens.filter(item => item.phase === 'spawned').length >= 2
                ? openBreeding
                : undefined
            }
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

        {breedingResult && (
          <BreedingResultCard
            child={breedingResult}
            onOpenChild={() => {
              openSpecimen(breedingResult);
              setBreedingResult(null);
            }}
            onStay={() => setBreedingResult(null)}
          />
        )}

        {appError && (
          <div className="app-error-pop" role="alert">
            <strong>MR. SLOP HIT SOMETHING</strong>
            <span>{appError}</span>
            <button type="button" onClick={() => setAppError(null)}>OK</button>
          </div>
        )}
      </main>

      {showBreeding && !breedingPreview && (
        <BreedingPicker
          specimens={specimens}
          initialParentAId={activeSpecimen?.id}
          onPreview={previewBreeding}
          onCancel={closeBreeding}
        />
      )}

      {showBreeding && breedingPreview && (
        <BreedingPreviewCard
          preview={breedingPreview}
          specimenNames={specimenNames}
          onApprove={() => void approveBreeding()}
          onCancel={closeBreeding}
          error={breedingError}
          isSaving={isSavingBreeding}
        />
      )}

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
