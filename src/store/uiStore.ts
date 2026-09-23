import { create } from 'zustand';

interface UIState {
  isOnline: boolean;
  activeModal: string | null;
  setIsOnline: (isOnline: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOnline: true,
  activeModal: null,

  setIsOnline: (isOnline) => set({ isOnline }),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
}));
