import React from 'react';
import { StepProgressBar } from 'topspiagge-design-system';

const steps = ['Mappa', 'Dettagli', 'Riepilogo'];

export const FirstStep = () => <StepProgressBar steps={steps} currentIndex={0} />;

export const MiddleStep = () => <StepProgressBar steps={steps} currentIndex={1} />;

export const LastStep = () => <StepProgressBar steps={steps} currentIndex={2} />;
