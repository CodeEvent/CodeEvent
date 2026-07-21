import React from 'react';
import { EditDeleteRow } from 'topspiagge-design-system';

export const InListRow = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 320 }}>
    <span style={{ fontWeight: 700, color: '#233044', fontSize: 14 }}>Listino Alta stagione</span>
    <EditDeleteRow onEdit={() => {}} onDelete={() => {}} />
  </div>
);
