import React, { useState } from 'react';
import { Booking, Customer } from '../../types';
import { CustomerBookingScreen, EditBookingContext } from './CustomerBookingScreen';
import { ManageBookingScreen } from './ManageBookingScreen';
import { ModeSelectScreen } from './ModeSelectScreen';

type Screen = 'landing' | 'booking' | 'manage';

interface Props {
  onStaffLogin: () => void;
}

// Owns the customer-side landing/booking/manage handoff with plain useState, consistent
// with how the booking wizard already manages its own internal steps -- no nested navigator
// needed here, the only route that genuinely needs a distinct URL is /operator.
export const CustomerApp: React.FC<Props> = ({ onStaffLogin }) => {
  const [screen, setScreen] = useState<Screen>('landing');
  const [editContext, setEditContext] = useState<EditBookingContext | null>(null);
  const [initialDates, setInitialDates] = useState<{ startOffset?: number; days?: number }>({});

  const goToLanding = () => {
    setScreen('landing');
    setEditContext(null);
    setInitialDates({});
  };

  if (screen === 'manage') {
    return (
      <ManageBookingScreen
        onBack={goToLanding}
        onEdit={(bookings: Booking[], customer: Customer) => {
          setEditContext({ bookings, customer });
          setScreen('booking');
        }}
      />
    );
  }

  if (screen === 'booking') {
    return (
      <CustomerBookingScreen
        editContext={editContext}
        onExitToLanding={goToLanding}
        onManage={() => {
          setEditContext(null);
          setScreen('manage');
        }}
        initialStartOffset={initialDates.startOffset}
        initialDays={initialDates.days}
      />
    );
  }

  return (
    <ModeSelectScreen
      onBook={(startOffset, days) => {
        setInitialDates({ startOffset, days });
        setEditContext(null);
        setScreen('booking');
      }}
      onManage={() => setScreen('manage')}
      onStaffLogin={onStaffLogin}
    />
  );
};
