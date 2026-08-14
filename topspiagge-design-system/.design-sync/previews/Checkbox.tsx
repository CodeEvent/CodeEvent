import React, { useState } from 'react';
import { Checkbox } from 'topspiagge-design-system';

export const Unchecked = () => <Checkbox checked={false} onToggle={() => {}} label="Sono uno studente" />;

export const Checked = () => (
  <Checkbox
    checked
    onToggle={() => {}}
    label="Ho letto e accetto la politica di acconto e cancellazione"
  />
);

export const Interactive = () => {
  const [checked, setChecked] = useState(false);
  return <Checkbox checked={checked} onToggle={() => setChecked((v) => !v)} label="Cliente studente" />;
};
