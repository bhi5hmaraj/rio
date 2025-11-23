import { create } from 'zustand';
import type { Annotation, RioSettings } from './types';

interface RioStore {
  // Annotations
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  setAnnotations: (annotations: Annotation[]) => void;
  loadAnnotations: (conversationId: string) => Promise<void>;

  // Settings
  settings: RioSettings;
  updateSettings: (settings: Partial<RioSettings>) => void;
  setSettings: (settings: RioSettings) => void;
  loadSettings: () => Promise<void>;

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

  setAnnotations: (annotations) => set({ annotations }),

  loadAnnotations: async (conversationId) => {
    try {
      const result = await chrome.storage.local.get('annotations');
      const allAnnotations = result.annotations || {};
      const conversationAnnotations = allAnnotations[conversationId] || [];
      set({ annotations: conversationAnnotations });
    } catch (error) {
      console.error('Rio: Failed to load annotations', error);
    }
  },

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    })),

  setSettings: (settings) => set({ settings }),

  loadSettings: async () => {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        set({ settings: result.settings });
      }
    } catch (error) {
      console.error('Rio: Failed to load settings', error);
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
