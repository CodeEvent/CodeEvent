import React, { useState } from 'react';
import { Stepper } from 'topspiagge-design-system';

export const GuestCounters = () => {
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  return (
    <div style={{ background: '#F4F6F9', borderRadius: 10, padding: '0 12px', maxWidth: 320 }}>
      <Stepper label="Adulti" value={adults} min={1} onChange={setAdults} />
      <div style={{ height: 1, background: '#E3E7EE' }} />
      <Stepper label="Bambini 5–15 anni" value={kids} onChange={setKids} />
    </div>
  );
};

export const AtLimits = () => (
  <div style={{ background: '#F4F6F9', borderRadius: 10, padding: '0 12px', maxWidth: 320 }}>
    <Stepper label="Lettini" value={0} max={4} onChange={() => {}} />
    <div style={{ height: 1, background: '#E3E7EE' }} />
    <Stepper label="Sdraio" value={4} max={4} onChange={() => {}} />
  </div>
);
