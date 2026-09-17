import React, { useState } from 'react';
import { Atom, Dices, FlaskConical, MessageCircleMore, Sparkles } from 'lucide-react';

export type BuildRoute = 'surprise' | 'idea' | 'parts' | 'specimen';

interface BuildMeScreenProps {
  specimenCount: number;
  onChoose: (route: BuildRoute) => void;
}

const ROUTES: Array<{
  id: BuildRoute;
  label: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'surprise',
    label: 'SURPRISE ME',
    description: 'Assemble a strange but structurally useful starting brain for me.',
    accent: 'cyan',
    icon: <Dices size={20} />,
  },
  {
    id: 'idea',
    label: 'I HAVE AN IDEA',
    description: 'Tell Mr. Slop what you have in mind and build him through conversation.',
    accent: 'pink',
    icon: <MessageCircleMore size={20} />,
  },
  {
    id: 'parts',
    label: 'LET ME PICK THE PARTS',
    description: 'Open the explicit minds, operators, seeds, and mechanisms shelf.',
    accent: 'violet',
    icon: <FlaskConical size={20} />,
  },
  {
    id: 'specimen',
    label: 'START FROM A SPECIMEN',
    description: 'Reopen or clone one of the little freaks you already made.',
    accent: 'lime',
    icon: <Atom size={20} />,
  },
];

const BuildMeScreen: React.FC<BuildMeScreenProps> = ({ specimenCount, onChoose }) => {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<BuildRoute | null>(null);

  const choose = (route: BuildRoute) => {
    if (route === 'specimen' && specimenCount === 0) return;
    setSelected(route);
    onChoose(route);
  };

  return (
    <section className="build-screen" aria-label="Mr. Slop builder">
      <div className="slop-aura slop-aura-one" />
      <div className="slop-aura slop-aura-two" />
      <div className="slop-aura slop-aura-three" />

      <div className="build-shell">
        <div className="brand-kicker">
          <Sparkles size={14} /> CONVERSATIONAL INSTABILITY LAB
        </div>

        <h1 className="slop-title" aria-label="Mr. Slop">
          <span>MR.</span> <strong>SLOP</strong>
        </h1>

        <p className="slop-subtitle">
          Build a brain. Talk to the thing that comes out.
        </p>

        {!expanded ? (
          <button className="build-me-button" onClick={() => setExpanded(true)}>
            <span>BUILD ME</span>
            <span className="build-me-arrow">→</span>
          </button>
        ) : (
          <div className="route-panel" aria-live="polite">
            <div className="route-panel-heading">
              <span>HOW DO YOU WANT TO START?</span>
              <small>Pick one. We talk from there.</small>
            </div>

            <div className="route-grid">
              {ROUTES.map(route => {
                const disabled = route.id === 'specimen' && specimenCount === 0;
                const active = selected === route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(route.id)}
                    className={`route-card route-${route.accent} ${active ? 'route-selected' : ''}`}
                  >
                    <span className="route-icon">{route.icon}</span>
                    <span className="route-copy">
                      <strong>{route.label}</strong>
                      <small>{route.description}</small>
                      {disabled && <em>No saved specimens yet.</em>}
                    </span>
                    <span className="route-arrow">↗</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="slop-status-row" aria-hidden="true">
          <span className="status-pink">IDENTITY</span>
          <span className="status-cyan">IDEAS</span>
          <span className="status-lime">MUTATION</span>
          <span className="status-violet">GENOME</span>
          <span className="status-orange">COLLISION</span>
        </div>
      </div>
    </section>
  );
};

export default BuildMeScreen;
