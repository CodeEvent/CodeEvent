import React from 'react';
import { spacing } from '../tokens';
import { IconButton } from './IconButton';

export interface EditDeleteRowProps {
  onEdit: () => void;
  onDelete: () => void;
}

export const EditDeleteRow: React.FC<EditDeleteRowProps> = ({ onEdit, onDelete }) => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: spacing.sm }}>
    <IconButton variant="edit" onPress={onEdit} />
    <IconButton variant="delete" onPress={onDelete} />
  </div>
);
