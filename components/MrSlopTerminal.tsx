import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BookmarkPlus,
  Download,
  FilePlus2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  X,
} from 'lucide-react';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { buildCatalogIndex } from '../lib/catalog';
import { createGenome } from '../lib/genome';
import { assembleSystemInstruction } from '../lib/kernel';
import {
  acquireTrait,
  advanceSuccessfulTurn,
  fossilizeAccident,
  promoteInfection,
  removeInfection,
  retireTrait,
  startInfection,
} from '../lib/mutations';
import { compileFuseGenome, MR_SLOP_FUSE_VERSION } from '../services/kernelCompiler';
import { sendMrSlopMessage } from '../services/geminiService';
import { processFile } from '../services/fileService';
import { isSpeechSupported, startListening, stopListening } from '../services/speechService';
import { exportConversationToPDF, exportConversationToTXT } from '../services/exportService';
import { checkpointSpecimen, restoreCheckpoint, saveArtifact } from '../services/specimenStore';
import {
  Attachment,
  ChoiceCardEvent,
  ChoiceCardOption,
  Genome,
  Message,
  MutationActionRequest,
  MutationProposal,
  Role,
  Specimen,
  StructuralDecisionEvent,
} from '../types';
import ParsedMessage from './ParsedMessage';
import ChoiceCard from './ChoiceCard';
import StructuralDecisionModal from './StructuralDecisionModal';
import MutationCard from './MutationCard';
import MutationStatus from './MutationStatus';
import './ConversationUI.css';

interface MrSlopTerminalProps {
  specimen: Specimen;
  onChange: (specimen: Specimen) => void | Promise<void>;
  onOpenSpecimens?: () => void;
  onNewSpecimen?: () => void;
}

interface FailedTurn {
  userMessage: string;
  attachments: Attachment[];
}

const CATALOG_INDEX = buildCatalogIndex(SLOP_LIBRARY);

const makeMessage = (role: Role, content: string, attachments?: Attachment[]): Message => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: Date.now(),
  attachments,
});

const snapshotGenome = (genome: Genome): Genome => ({
  ...genome,
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

const specimenStateSummary = (specimen: Specimen): string => {
  const traits = specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(trait => trait.name);
  const infections = specimen.infections
    .filter(infection => infection.status === 'active')
    .map(infection => infection.durationMode === 'indefinite'
      ? `${infection.name} (indefinite)`
      : `${infection.name} (${infection.remainingTurns ?? 0} turns left)`);

  return [
    `Specimen: ${specimen.name}`,
    `Phase: ${specimen.phase}`,
    `Mode: ${specimen.currentGenome.mode}`,
    `Installed IDs: ${specimen.currentGenome.components.map(component => component.id).join(', ') || 'none yet'}`,
    `Active acquired traits: ${traits.join(', ') || 'none'}`,
    `Active infections: ${infections.join(', ') || 'none'}`,
    `Checkpoints: ${specimen.checkpoints.length}`,
  ].join('\n');
};

const userFacingTransportError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error || '');
  const separator = raw.indexOf(':');
  const detail = separator > 0 && /^[A-Z0-9_]+$/.test(raw.slice(0, separator))
    ? raw.slice(separator + 1)
    : raw;
  return detail.trim();
};

const MrSlopTerminal: React.FC<MrSlopTerminalProps> = ({
  specimen,
  onChange,
  onOpenSpecimens,
  onNewSpecimen,
}) => {
  const [working, setWorking] = useState(specimen);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeChoice, setActiveChoice] = useState<ChoiceCardEvent | null>(null);
  const [activeDecision, setActiveDecision] = useState<StructuralDecisionEvent | null>(null);
  const [activeMutationProposal, setActiveMutationProposal] = useState<MutationProposal | null>(null);
  const [preferredMutationTurns, setPreferredMutationTurns] = useState<number | undefined>(undefined);
  const [pendingMutationAction, setPendingMutationAction] = useState<MutationActionRequest | null>(null);
  const [mutationChoiceActions, setMutationChoiceActions] = useState<Record<string, MutationActionRequest>>({});
  const [structuralError, setStructuralError] = useState<string | null>(null);
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  const [transmissionError, setTransmissionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setWorking(specimen);
    setActiveChoice(null);
    setActiveDecision(null);
    setActiveMutationProposal(null);
    setPreferredMutationTurns(undefined);
    setPendingMutationAction(null);
    setMutationChoiceActions({});
    setFailedTurn(null);
    setTransmissionError(null);
  }, [specimen.id]);

  useEffect(() => () => stopListening(), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [working.messages, activeChoice, activeMutationProposal, isProcessing, transmissionError]);

  const commit = (next: Specimen) => {
    setWorking(next);
    void onChange(next);
  };

  const updateMessages = (base: Specimen, messages: Message[]): Specimen => ({
    ...base,
    messages,
    lastModified: Date.now(),
  });

  const saveReplyArtifact = (message: Message) => {
    if (working.artifacts.some(artifact => artifact.messageId === message.id)) return;
    const firstLine = message.content.trim().split('\n')[0];
    const next = saveArtifact(working, {
      messageId: message.id,
      kind: 'other',
      title: (firstLine || 'Mr. Slop artifact').slice(0, 72),
      content: message.content,
    });
    commit(next);
  };

  const makeMutationDecision = (
    action: MutationActionRequest,
    base: Specimen,
  ): StructuralDecisionEvent | null => {
    let title = 'MUTATION DECISION';
    let reason = 'This changes the specimen persistently, so Mr. Slop needs your explicit approval.';
    let label = 'APPLY MUTATION';
    let description = 'Apply this lasting mutation.';

    if (action.type === 'fossilize-accident' && action.proposal) {
      title = `FOSSILIZE ${action.proposal.name}?`;
      reason = `Preserve the observed behavior “${action.proposal.name}” as a lasting acquired trait.`;
      label = 'FOSSILIZE IT';
      description = action.proposal.description;
    } else if (action.type === 'acquire-trait' && action.proposal) {
      title = `KEEP ${action.proposal.name}?`;
      reason = `Add “${action.proposal.name}” as a lasting acquired trait.`;
      label = 'KEEP THIS TRAIT';
      description = action.proposal.description;
    } else if (action.type === 'promote-infection' && action.targetId) {
      const infection = base.infections.find(item => item.id === action.targetId);
      if (!infection || infection.status !== 'active') return null;
      title = `KEEP ${infection.name}?`;
      reason = `Promote the temporary infection “${infection.name}” into a lasting acquired trait.`;
      label = 'KEEP AS TRAIT';
      description = infection.description;
    } else if (action.type === 'retire-trait' && action.targetId) {
      const trait = base.acquiredTraits.find(item => item.id === action.targetId);
      if (!trait || trait.status !== 'active') return null;
      title = `RETIRE ${trait.name}?`;
      reason = `Stop applying the acquired trait “${trait.name}”. Its history stays recorded.`;
      label = 'RETIRE TRAIT';
      description = trait.description;
    } else if (action.type === 'restore-checkpoint' && action.targetId) {
      const checkpoint = base.checkpoints.find(item => item.id === action.targetId);
      if (!checkpoint) return null;
      title = 'RESTORE CHECKPOINT?';
      reason = `Restore the specimen’s genome and mutation state to “${checkpoint.reason}”. Conversation and artifacts stay intact.`;
      label = 'RESTORE CHECKPOINT';
      description = checkpoint.reason;
    } else {
      return null;
    }

    return {
      type: 'structural-decision',
      id: `mutation-decision-${crypto.randomUUID()}`,
      title,
      reason,
      options: [{
        id: `approve-${action.type}`,
        label,
        description,
      }],
    };
  };

  const openMutationDecision = (action: MutationActionRequest, base: Specimen = working) => {
    const event = makeMutationDecision(action, base);
    if (!event) {
      setTransmissionError('That mutation target is no longer available.');
      return;
    }
    setPendingMutationAction(action);
    setActiveMutationProposal(null);
    setActiveChoice(null);
    setStructuralError(null);
    setActiveDecision(event);
  };

  const mutationChoiceFor = (
    action: MutationActionRequest,
    base: Specimen,
  ): { event: ChoiceCardEvent; actions: Record<string, MutationActionRequest> } | null => {
    const actions: Record<string, MutationActionRequest> = {};
    const options: ChoiceCardOption[] = [];

    if (action.type === 'remove-infection' || action.type === 'promote-infection') {
      base.infections
        .filter(infection => infection.status === 'active')
        .forEach(infection => {
          const id = `mutation-choice-${action.type}-${infection.id}`;
          actions[id] = { ...action, targetId: infection.id };
          options.push({
            id,
            label: action.type === 'remove-infection'
              ? `REMOVE ${infection.name}`
              : `KEEP ${infection.name} AS TRAIT`,
            description: infection.description,
          });
        });
    } else if (action.type === 'retire-trait') {
      base.acquiredTraits
        .filter(trait => trait.status === 'active')
        .forEach(trait => {
          const id = `mutation-choice-retire-${trait.id}`;
          actions[id] = { ...action, targetId: trait.id };
          options.push({
            id,
            label: `RETIRE ${trait.name}`,
            description: trait.description,
          });
        });
    } else if (action.type === 'restore-checkpoint') {
      base.checkpoints.forEach(checkpoint => {
        const id = `mutation-choice-restore-${checkpoint.id}`;
        actions[id] = { ...action, targetId: checkpoint.id };
        options.push({
          id,
          label: `RESTORE ${checkpoint.reason}`,
          description: 'Restore this saved genome and mutation state.',
        });
      });
    }

    if (options.length < 2) return null;

    return {
      event: {
        type: 'choice-card',
        id: `mutation-choice-${crypto.randomUUID()}`,
        title: 'WHICH ONE?',
        reason: 'More than one real specimen state matches that request. Pick the one you meant.',
        options,
      },
      actions,
    };
  };

  const routeMutationAction = (
    action: MutationActionRequest,
    base: Specimen,
  ) => {
    if (action.type === 'start-infection') {
      if (!action.proposal || action.proposal.kind !== 'infection') return;
      setPreferredMutationTurns(action.durationMode === 'turns' ? action.durationTurns : undefined);
      setActiveMutationProposal(action.proposal);
      return;
    }

    if (action.type === 'remove-infection') {
      const active = base.infections.filter(infection => infection.status === 'active');
      const target = action.targetId
        ? active.find(infection => infection.id === action.targetId)
        : active.length === 1 ? active[0] : undefined;

      if (target) {
        commit(removeInfection(base, target.id, 'removed from conversation'));
        return;
      }

      const choice = mutationChoiceFor(action, base);
      if (choice) {
        setMutationChoiceActions(choice.actions);
        setActiveChoice(choice.event);
      } else {
        setTransmissionError('There is no unique active infection to remove.');
      }
      return;
    }

    if (
      action.type === 'promote-infection' ||
      action.type === 'retire-trait' ||
      action.type === 'restore-checkpoint'
    ) {
      const candidateIds = action.type === 'promote-infection'
        ? base.infections.filter(item => item.status === 'active').map(item => item.id)
        : action.type === 'retire-trait'
          ? base.acquiredTraits.filter(item => item.status === 'active').map(item => item.id)
          : base.checkpoints.map(item => item.id);
      const targetId = action.targetId || (candidateIds.length === 1 ? candidateIds[0] : undefined);

      if (targetId) {
        openMutationDecision({ ...action, targetId }, base);
        return;
      }

      const choice = mutationChoiceFor(action, base);
      if (choice) {
        setMutationChoiceActions(choice.actions);
        setActiveChoice(choice.event);
      } else {
        setTransmissionError('There is no unique mutation target for that request.');
      }
      return;
    }

    if (action.type === 'acquire-trait' || action.type === 'fossilize-accident') {
      if (action.proposal) openMutationDecision(action, base);
    }
  };

  const processEnvelope = async (
    base: Specimen,
    envelope: Awaited<ReturnType<typeof sendMrSlopMessage>>,
  ) => {
    const modelMessage = makeMessage(Role.MODEL, envelope.text);
    const accepted = updateMessages(base, [...base.messages, modelMessage]);
    commit(accepted);
    const next = advanceSuccessfulTurn(accepted);
    commit(next);
    setFailedTurn(null);
    setTransmissionError(null);

    setMutationChoiceActions({});

    if (envelope.uiEvent?.type === 'structural-decision') {
      setActiveChoice(null);
      setStructuralError(null);
      setActiveDecision(envelope.uiEvent);
    } else if (envelope.uiEvent?.type === 'choice-card') {
      setActiveDecision(null);
      setActiveChoice(envelope.uiEvent);
    }

    if (envelope.mutationAction) {
      routeMutationAction(envelope.mutationAction, next);
    } else if (envelope.mutationProposal) {
      setPreferredMutationTurns(envelope.mutationProposal.recommendedTurns);
      setActiveMutationProposal(envelope.mutationProposal);
    }

    if (envelope.proposedGenome && next.phase === 'building') {
      setActiveDecision(null);
      setActiveChoice({
        type: 'choice-card',
        id: `build-${modelMessage.id}`,
        title: 'BUILD THIS MR. SLOP?',
        reason: 'This is the starting genome Mr. Slop is proposing from the conversation so far.',
        options: [
          {
            id: 'build-this',
            label: 'BUILD THIS',
            description: `${envelope.proposedGenome.componentIds.length} parts · ${envelope.proposedGenome.mode.toUpperCase()}`,
            componentIds: envelope.proposedGenome.componentIds,
            mode: envelope.proposedGenome.mode,
          },
        ],
      });
    }
  };

  const callModel = async (base: Specimen, userMessage: string, rawAttachments: Attachment[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsProcessing(true);
    try {
      const systemInstruction = assembleSystemInstruction({
        phase: base.phase,
        catalogIndex: base.phase === 'building' ? CATALOG_INDEX : '',
        genome: base.currentGenome,
        acquiredTraits: base.acquiredTraits,
        infections: base.infections,
        specimenState: specimenStateSummary(base),
      });
      const envelope = await sendMrSlopMessage({
        history: base.messages,
        userMessage,
        attachments: rawAttachments,
        systemInstruction,
        signal: controller.signal,
      });
      await processEnvelope(base, envelope);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setFailedTurn({ userMessage, attachments: rawAttachments });
      const detail = userFacingTransportError(error);
      setTransmissionError(
        detail
          ? `That turn failed without changing the genome. ${detail}`
          : 'That turn failed without changing the genome. You can retry it.',
      );
    } finally {
      abortRef.current = null;
      setIsProcessing(false);
    }
  };

  const send = async () => {
    const clean = input.trim();
    if ((!clean && attachments.length === 0) || isProcessing) return;

    if (isListening) {
      stopListening();
      setIsListening(false);
    }

    setActiveChoice(null);
    setActiveMutationProposal(null);
    setPreferredMutationTurns(undefined);
    setMutationChoiceActions({});
    setTransmissionError(null);
    const rawAttachments = attachments;
    const persistedAttachments = rawAttachments.map(attachment => ({
      ...attachment,
      fileHandle: undefined,
      data: attachment.isInlineData ? '[MEDIA_BUFFER_NOT_PERSISTED]' : attachment.data,
    }));
    const displayText = clean || rawAttachments.map(attachment => `[FILE: ${attachment.name}]`).join(' ');
    const userMessage = makeMessage(Role.USER, displayText, persistedAttachments);
    const next = updateMessages(working, [...working.messages, userMessage]);
    commit(next);
    setInput('');
    setAttachments([]);
    await callModel(next, displayText, rawAttachments);
  };

  const retry = async () => {
    if (!failedTurn || isProcessing) return;
    setTransmissionError(null);
    await callModel(working, failedTurn.userMessage, failedTurn.attachments);
  };

  const buildGenomeFromOption = async (option: ChoiceCardOption): Promise<Genome | null> => {
    if (!option.componentIds?.length) return null;
    const mode = option.mode || working.currentGenome.mode || 'stack';
    const genome = createGenome(option.componentIds, SLOP_LIBRARY, mode, working.currentGenome.customSeed);
    if (mode === 'fuse') {
      const kernel = await compileFuseGenome(genome);
      return {
        ...genome,
        compiledKernel: kernel,
        compiledAt: Date.now(),
        compilerVersion: MR_SLOP_FUSE_VERSION,
      };
    }
    return genome;
  };

  const spawnBuildingSpecimen = async (option: ChoiceCardOption) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTransmissionError(null);
    try {
      const genome = await buildGenomeFromOption(option);
      if (!genome) return;
      const next: Specimen = {
        ...working,
        phase: 'spawned',
        name: working.name === 'NEW SPECIMEN'
          ? `SLOP ${working.messages.find(message => message.role === Role.USER)?.content.slice(0, 24) || 'SPECIMEN'}`
          : working.name,
        birthGenome: snapshotGenome(genome),
        currentGenome: snapshotGenome(genome),
        lastModified: Date.now(),
      };
      commit(next);
      setActiveChoice(null);
    } catch {
      setTransmissionError('FUSE did not compile cleanly. Nothing was installed; you can try again or choose a STACK build.');
    } finally {
      setIsProcessing(false);
    }
  };

  const choose = async (option: ChoiceCardOption) => {
    const mutationAction = mutationChoiceActions[option.id];
    if (mutationAction) {
      setActiveChoice(null);
      setMutationChoiceActions({});
      routeMutationAction(mutationAction, working);
      return;
    }

    if (working.phase === 'building' && option.componentIds?.length) {
      await spawnBuildingSpecimen(option);
      return;
    }

    if (working.phase === 'spawned' && option.componentIds?.length) {
      setActiveChoice(null);
      setActiveDecision({
        type: 'structural-decision',
        id: `choice-to-decision-${option.id}`,
        title: 'THIS CHANGES THE GENOME',
        reason: 'That option installs a different set of mechanisms, so Mr. Slop needs your explicit approval.',
        options: [option],
      });
      return;
    }

    setActiveChoice(null);
    setInput(option.label);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const applyStructural = async (option: ChoiceCardOption, forceStack = false) => {
    if (isProcessing) return;
    const checkpointed = checkpointSpecimen(working, `Before ${activeDecision?.title || 'structural change'}`);
    commit(checkpointed);
    setIsProcessing(true);
    setStructuralError(null);

    try {
      const ids = option.componentIds?.length
        ? option.componentIds
        : checkpointed.currentGenome.components.map(component => component.id);
      const targetMode = forceStack ? 'stack' : (option.mode || checkpointed.currentGenome.mode);
      let genome = createGenome(ids, SLOP_LIBRARY, targetMode, checkpointed.currentGenome.customSeed);
      if (targetMode === 'fuse') {
        const compiledKernel = await compileFuseGenome(genome);
        genome = {
          ...genome,
          compiledKernel,
          compiledAt: Date.now(),
          compilerVersion: MR_SLOP_FUSE_VERSION,
        };
      }
      const updated: Specimen = {
        ...checkpointed,
        currentGenome: snapshotGenome(genome),
        phase: 'spawned',
        lastModified: Date.now(),
      };
      commit(updated);
      setActiveDecision(null);
    } catch {
      setStructuralError('FUSE failed. The previous genome is still active. Retry the option or use STACK instead.');
    } finally {
      setIsProcessing(false);
    }
  };

  const applyApprovedMutation = () => {
    if (!pendingMutationAction) return;

    const checkpointed = checkpointSpecimen(
      working,
      `Before ${activeDecision?.title || pendingMutationAction.type}`,
    );
    commit(checkpointed);

    try {
      let updated = checkpointed;

      if (pendingMutationAction.type === 'fossilize-accident' && pendingMutationAction.proposal) {
        updated = fossilizeAccident(checkpointed, pendingMutationAction.proposal);
      } else if (pendingMutationAction.type === 'acquire-trait' && pendingMutationAction.proposal) {
        const origin = pendingMutationAction.proposal.sourceType === 'mr-slop' ||
          pendingMutationAction.proposal.sourceType === 'mutation-proposal'
          ? 'mr-slop-proposal'
          : 'explicit';
        updated = acquireTrait(checkpointed, pendingMutationAction.proposal, origin);
      } else if (pendingMutationAction.type === 'promote-infection' && pendingMutationAction.targetId) {
        updated = promoteInfection(checkpointed, pendingMutationAction.targetId);
      } else if (pendingMutationAction.type === 'retire-trait' && pendingMutationAction.targetId) {
        updated = retireTrait(checkpointed, pendingMutationAction.targetId);
      } else if (pendingMutationAction.type === 'restore-checkpoint' && pendingMutationAction.targetId) {
        updated = restoreCheckpoint(checkpointed, pendingMutationAction.targetId);
      } else {
        throw new Error('UNSUPPORTED_MUTATION_ACTION');
      }

      commit(updated);
      setActiveDecision(null);
      setPendingMutationAction(null);
      setStructuralError(null);
    } catch {
      setStructuralError('That mutation could not be applied. The pre-change checkpoint is still available.');
    }
  };

  const startProposedInfection = (
    proposal: MutationProposal,
    duration: { mode: 'turns'; turns: number } | { mode: 'indefinite' },
  ) => {
    const next = startInfection(working, proposal, duration);
    commit(next);
    setActiveMutationProposal(null);
    setPreferredMutationTurns(undefined);
  };

  const reviewPersistentProposal = (proposal: MutationProposal) => {
    if (proposal.kind === 'fossilized-accident') {
      openMutationDecision({ type: 'fossilize-accident', proposal }, working);
    } else if (proposal.kind === 'trait') {
      openMutationDecision({ type: 'acquire-trait', proposal }, working);
    }
  };

  const currentDecisionOption = activeDecision?.options[0];

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 300 * 1024 * 1024) {
      setTransmissionError('That file is over 300MB. Give Mr. Slop a smaller chunk.');
      return;
    }
    try {
      const processed = await processFile(file);
      setAttachments(current => [...current, processed]);
    } catch {
      setTransmissionError(`Could not read ${file.name}.`);
    }
  };

  const toggleMic = () => {
    if (!isSpeechSupported()) return;
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }
    setIsListening(true);
    startListening(
      (text, isFinal) => {
        if (isFinal) setInput(current => `${current} ${text}`.trim());
      },
      () => setIsListening(false),
    );
  };

  const exportAll = (format: 'txt' | 'pdf') => {
    if (format === 'txt') exportConversationToTXT(working.messages, working.name);
    else exportConversationToPDF(working.messages, working.name);
  };

  const componentLabel = useMemo(() => {
    if (working.phase === 'building') return 'UNFORMED · TALK ME INTO EXISTENCE';
    return `${working.currentGenome.mode.toUpperCase()} · ${working.currentGenome.components.length} PARTS`;
  }, [working.phase, working.currentGenome]);

  return (
    <section className="mr-slop-terminal" aria-label="Mr. Slop conversation">
      <header className="slop-chat-header">
        <div className="slop-chat-brand">
          <span>MR.</span> <strong>SLOP</strong>
          <small>{working.name} · {componentLabel}</small>
        </div>
        <div className="slop-chat-actions">
          {onNewSpecimen && (
            <button type="button" onClick={onNewSpecimen} aria-label="New specimen"><FilePlus2 size={16} /></button>
          )}
          {onOpenSpecimens && (
            <button type="button" onClick={onOpenSpecimens} aria-label="Saved specimens"><Archive size={16} /></button>
          )}
          <button type="button" onClick={() => exportAll('txt')} aria-label="Export conversation as text"><Download size={16} /></button>
        </div>
      </header>

      <MutationStatus
        infections={working.infections}
        traits={working.acquiredTraits}
        onRemoveInfection={infectionId => {
          try {
            commit(removeInfection(working, infectionId, 'removed by user'));
          } catch {
            setTransmissionError('That infection is no longer active.');
          }
        }}
        onPromoteInfection={infectionId => openMutationDecision(
          { type: 'promote-infection', targetId: infectionId },
          working,
        )}
        onRetireTrait={traitId => openMutationDecision(
          { type: 'retire-trait', targetId: traitId },
          working,
        )}
      />

      <div className="slop-chat-log" ref={scrollRef}>
        {working.messages.length === 0 && (
          <div className="slop-empty-chat">
            <strong>{working.phase === 'building' ? 'Tell me what you have in mind.' : 'Specimen awake.'}</strong>
            <p>
              {working.phase === 'building'
                ? 'Vague is fine. We can talk through what kind of brain I should build.'
                : 'Talk normally. The installed genome is active underneath the conversation.'}
            </p>
          </div>
        )}

        {working.messages.map(message => {
          const artifactSaved = working.artifacts.some(artifact => artifact.messageId === message.id);
          return (
            <article
              key={message.id}
              className={`slop-message ${message.role === Role.USER ? 'from-user' : message.role === Role.MODEL ? 'from-slop' : 'from-system'}`}
            >
              <div className="slop-message-label">
                {message.role === Role.USER ? 'YOU' : message.role === Role.MODEL ? 'MR. SLOP' : 'SYSTEM'}
              </div>
              <div className="slop-message-body">
                {message.role === Role.MODEL ? <ParsedMessage content={message.content} /> : <span>{message.content}</span>}
              </div>
              {message.attachments?.length ? (
                <div className="slop-message-files">
                  {message.attachments.map(attachment => <span key={attachment.id}><Paperclip size={10} /> {attachment.name}</span>)}
                </div>
              ) : null}
              {message.role === Role.MODEL && (
                <div className="slop-message-actions">
                  <button
                    type="button"
                    aria-label="Save artifact"
                    onClick={() => saveReplyArtifact(message)}
                    disabled={artifactSaved}
                  >
                    <BookmarkPlus size={12} /> {artifactSaved ? 'SAVED' : 'SAVE ARTIFACT'}
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {isProcessing && <div className="slop-thinking">MR. SLOP IS POKING IT WITH A STICK...</div>}

        {activeChoice && !activeDecision && (
          <ChoiceCard event={activeChoice} onSelect={choose} />
        )}

        {activeMutationProposal && !activeDecision && (
          <MutationCard
            proposal={activeMutationProposal}
            preferredTurns={preferredMutationTurns}
            onTryTurns={turns => startProposedInfection(activeMutationProposal, { mode: 'turns', turns })}
            onIndefinite={() => startProposedInfection(activeMutationProposal, { mode: 'indefinite' })}
            onReviewPersistent={() => reviewPersistentProposal(activeMutationProposal)}
            onDismiss={() => {
              setActiveMutationProposal(null);
              setPreferredMutationTurns(undefined);
            }}
          />
        )}

        {transmissionError && (
          <div className="slop-chat-error" role="alert">
            <span>{transmissionError}</span>
            {failedTurn && <button type="button" onClick={retry} disabled={isProcessing}>RETRY</button>}
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="pending-attachments">
          {attachments.map(attachment => (
            <span key={attachment.id}>
              <Paperclip size={11} /> {attachment.name}
              <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== attachment.id))}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      <footer className="slop-composer">
        <input ref={fileInputRef} type="file" hidden onChange={onFile} />
        <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach file"><Paperclip size={17} /></button>
        <button type="button" onClick={toggleMic} aria-label={isListening ? 'Stop listening' : 'Voice input'}>
          {isListening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Talk to Mr. Slop..."
          rows={1}
          disabled={isProcessing && !abortRef.current}
        />
        {isProcessing && abortRef.current ? (
          <button
            type="button"
            className="stop-send"
            aria-label="Stop"
            onClick={() => abortRef.current?.abort()}
          >
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          <button type="button" className="send-button" aria-label="Send" onClick={() => void send()}>
            <Send size={17} /> <span>SEND</span>
          </button>
        )}
      </footer>

      {activeDecision && (
        <StructuralDecisionModal
          event={activeDecision}
          busy={isProcessing}
          error={structuralError}
          onApprove={option => {
            if (pendingMutationAction) applyApprovedMutation();
            else void applyStructural(option);
          }}
          onCancel={() => {
            setActiveDecision(null);
            setPendingMutationAction(null);
            setStructuralError(null);
          }}
          onAnswerInChat={() => {
            setActiveDecision(null);
            setPendingMutationAction(null);
            setStructuralError(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      )}

      {activeDecision && !pendingMutationAction && structuralError && currentDecisionOption?.mode === 'fuse' && (
        <button
          type="button"
          className="stack-fallback-floating"
          onClick={() => void applyStructural(currentDecisionOption, true)}
        >
          USE STACK INSTEAD
        </button>
      )}
    </section>
  );
};

export default MrSlopTerminal;
