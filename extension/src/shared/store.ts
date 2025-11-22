import { create } from 'zustand';
import type { Annotation, RioSettings } from './types';

interface RioStore {
  // Annotations
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;

  // Settings
  settings: RioSettings;
  updateSettings: (settings: Partial<RioSettings>) => void;

  // UI State
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useRioStore = create<RioStore>((set) => ({
  // Initial state
  annotations: [],
  settings: {
    aiConfig: {
      litellmEndpoint: 'http://localhost:4000',
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.5-flash',
    },
    preferences: {
      autoFactCheck: false,
      showHUD: true,
      highlightStyle: 'underline',
    },
  },
  isLoading: false,

  // Actions
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),

  clearAnnotations: () => set({ annotations: [] }),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
