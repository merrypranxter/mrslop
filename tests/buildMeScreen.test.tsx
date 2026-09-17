import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import BuildMeScreen from '../components/BuildMeScreen';

describe('BuildMeScreen', () => {
  it('starts with a single BUILD ME invitation and reveals the four start routes', () => {
    render(<BuildMeScreen specimenCount={0} onChoose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /mr\. slop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /build me/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /surprise me/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /build me/i }));

    expect(screen.getByRole('button', { name: /surprise me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i have an idea/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /let me pick the parts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start from a specimen/i })).toBeDisabled();
  });

  it('hands the chosen route back to the app', () => {
    const onChoose = vi.fn();
    render(<BuildMeScreen specimenCount={2} onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: /build me/i }));
    fireEvent.click(screen.getByRole('button', { name: /i have an idea/i }));

    expect(onChoose).toHaveBeenCalledWith('idea');
  });
});
