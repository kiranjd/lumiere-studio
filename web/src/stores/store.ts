import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ViewType,
  QueueItem,
  GeneratedImage,
  LibraryImage,
  Batch,
  Assessment,
  LightboxState,
  Toast,
  PromptTemplate,
} from '../types';
import { BATCH_COLORS, MODELS } from '../utils/constants';
import { syncBatches, saveBatches, fetchBatches, fetchIncognitoImages, saveIncognitoImages } from '../api/server';

interface StudioStore {
  // View state
  currentView: ViewType;
  setView: (view: ViewType) => void;

  // Library
  library: LibraryImage[];
  libraryLoading: boolean;
  libraryFilter: string;
  setLibrary: (images: LibraryImage[]) => void;
  setLibraryLoading: (loading: boolean) => void;
  setLibraryFilter: (filter: string) => void;

  // Selected references (for generation)
  selectedRefs: string[];
  toggleRef: (file: string) => void;
  clearRefs: () => void;
  setRefs: (refs: string[]) => void;

  // Generation queue
  queue: QueueItem[];
  addToQueue: (items: QueueItem[]) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  // Generated images (from server)
  generatedImages: GeneratedImage[];
  generatedLoading: boolean;
  setGeneratedImages: (images: GeneratedImage[]) => void;
  setGeneratedLoading: (loading: boolean) => void;

  // Selected models for generation
  selectedModels: string[];
  toggleModel: (modelId: string) => void;
  setSelectedModels: (models: string[]) => void;

  // Generation settings
  prompt: string;
  setPrompt: (prompt: string) => void;
  aspect: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  setAspect: (aspect: '1:1' | '16:9' | '9:16' | '4:3' | '3:4') => void;
  quality: 'low' | 'medium' | 'high';
  setQuality: (quality: 'low' | 'medium' | 'high') => void;
  quantity: number;
  setQuantity: (quantity: number) => void;

  // Batches (persisted)
  batches: Batch[];
  activeBatchId: string | null;
  createBatch: (name: string) => string;
  renameBatch: (id: string, name: string) => void;
  deleteBatch: (id: string) => void;
  addImageToBatch: (batchId: string, file: string) => void;
  removeImageFromBatch: (batchId: string, file: string) => void;
  setActiveBatch: (id: string | null) => void;

  // Assessments (persisted)
  assessments: Record<string, Assessment>;
  setAssessment: (file: string, assessment: Assessment) => void;
  getAssessment: (file: string) => Assessment | undefined;

  // Lightbox
  lightbox: LightboxState;
  openLightbox: (images: LightboxState['images'], index: number, source: LightboxState['source']) => void;
  closeLightbox: () => void;
  setLightboxIndex: (index: number) => void;
  setLightboxImages: (images: LightboxState['images']) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // UI state
  zoom: number;
  setZoom: (zoom: number) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeGenerations: number;
  incrementGenerations: (count: number) => void;
  decrementGenerations: (count: number) => void;

  // Comparison mode
  compareImages: string[];
  toggleCompare: (file: string) => void;
  clearCompare: () => void;
  openCompare: () => void;

  // Prompt history (persisted)
  promptHistory: string[];
  addToHistory: (prompt: string) => void;

  // Prompt templates (persisted)
  promptTemplates: PromptTemplate[];
  addPromptTemplate: (name: string, prompt: string) => void;
  deletePromptTemplate: (id: string) => void;

  // Incognito mode (for hiding NSFW images)
  incognitoImages: string[];
  incognitoMode: boolean;
  viewingIncognitoCollection: boolean;
  toggleIncognito: (file: string) => void;
  setIncognitoMode: (mode: boolean) => void;
  setViewingIncognitoCollection: (viewing: boolean) => void;
  initIncognitoSync: () => Promise<void>;

  // Batch sync
  batchSyncStatus: 'idle' | 'syncing' | 'error';
  batchSyncError: string | null;
  initBatchSync: () => Promise<void>;
  _saveBatchesToServer: () => void;
}

// Track if we've already triggered a sync this session
let hasSyncedThisSession = false;

// Force sync after HMR or initial load - runs after store is created
const triggerDelayedSync = () => {
  setTimeout(() => {
    if (!hasSyncedThisSession) {
      hasSyncedThisSession = true;
      const state = useStore.getState();
      console.log('Triggering delayed batch sync...');
      state.initBatchSync();
    }
  }, 500); // Small delay to ensure store is fully initialized
};

export const useStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      // View state
      currentView: 'queue',
      setView: (view) => set({ currentView: view }),

      // Library
      library: [],
      libraryLoading: false,
      libraryFilter: '',
      setLibrary: (images) => set({ library: images }),
      setLibraryLoading: (loading) => set({ libraryLoading: loading }),
      setLibraryFilter: (filter) => set({ libraryFilter: filter }),

      // Selected references
      selectedRefs: [],
      toggleRef: (file) =>
        set((state) => {
          const refs = state.selectedRefs;
          if (refs.includes(file)) {
            return { selectedRefs: refs.filter((r) => r !== file) };
          }
          if (refs.length >= 4) {
            // Max 4 refs
            return state;
          }
          return { selectedRefs: [...refs, file] };
        }),
      clearRefs: () => set({ selectedRefs: [] }),
      setRefs: (refs) => set({ selectedRefs: refs.slice(0, 4) }),

      // Generation queue
      queue: [],
      addToQueue: (items) =>
        set((state) => ({ queue: [...items, ...state.queue] })),
      updateQueueItem: (id, updates) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      removeFromQueue: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),
      clearQueue: () => set({ queue: [] }),

      // Generated images
      generatedImages: [],
      generatedLoading: false,
      setGeneratedImages: (images) => set({ generatedImages: images }),
      setGeneratedLoading: (loading) => set({ generatedLoading: loading }),

      // Selected models
      selectedModels: ['google/gemini-2.5-pro-preview'],
      toggleModel: (modelId) =>
        set((state) => {
          const models = state.selectedModels;
          if (models.includes(modelId)) {
            if (models.length === 1) return state; // Keep at least one
            return { selectedModels: models.filter((m) => m !== modelId) };
          }
          return { selectedModels: [...models, modelId] };
        }),
      setSelectedModels: (models) => set({ selectedModels: models }),

      // Generation settings
      prompt: '',
      setPrompt: (prompt) => set({ prompt }),
      aspect: '1:1',
      setAspect: (aspect) => set({ aspect }),
      quality: 'low', // Default to low for cheaper experimentation
      setQuality: (quality) => set({ quality }),
      quantity: 1,
      setQuantity: (quantity) => set({ quantity: Math.max(1, Math.min(8, quantity)) }),

      // Batches
      batches: [],
      activeBatchId: null,
      createBatch: (name) => {
        const id = `batch-${Date.now()}`;
        const colorIndex = get().batches.length % BATCH_COLORS.length;
        set((state) => ({
          batches: [
            ...state.batches,
            {
              id,
              name,
              color: BATCH_COLORS[colorIndex],
              images: [],
              createdAt: Date.now(),
            },
          ],
        }));
        get()._saveBatchesToServer();
        return id;
      },
      renameBatch: (id, name) => {
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id === id ? { ...b, name } : b
          ),
        }));
        get()._saveBatchesToServer();
      },
      deleteBatch: (id) => {
        set((state) => ({
          batches: state.batches.filter((b) => b.id !== id),
          activeBatchId: state.activeBatchId === id ? null : state.activeBatchId,
        }));
        get()._saveBatchesToServer();
      },
      addImageToBatch: (batchId, file) => {
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id === batchId && !b.images.some((img) => img.file === file)
              ? { ...b, images: [...b.images, { file, addedAt: Date.now() }] }
              : b
          ),
        }));
        get()._saveBatchesToServer();
      },
      removeImageFromBatch: (batchId, file) => {
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id === batchId
              ? { ...b, images: b.images.filter((img) => img.file !== file) }
              : b
          ),
        }));
        get()._saveBatchesToServer();
      },
      setActiveBatch: (id) =>
        set({ activeBatchId: id, currentView: id ? 'batch' : 'queue' }),

      // Assessments
      assessments: {},
      setAssessment: (file, assessment) =>
        set((state) => ({
          assessments: { ...state.assessments, [file]: assessment },
        })),
      getAssessment: (file) => get().assessments[file],

      // Lightbox
      lightbox: {
        isOpen: false,
        images: [],
        currentIndex: 0,
        source: 'queue',
      },
      openLightbox: (images, index, source) =>
        set({
          lightbox: { isOpen: true, images, currentIndex: index, source },
        }),
      closeLightbox: () =>
        set((state) => ({
          lightbox: { ...state.lightbox, isOpen: false },
        })),
      setLightboxIndex: (index) =>
        set((state) => ({
          lightbox: { ...state.lightbox, currentIndex: index },
        })),
      setLightboxImages: (images) =>
        set((state) => ({
          lightbox: { ...state.lightbox, images },
        })),

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = `toast-${Date.now()}`;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 3000);
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // UI state
      zoom: 1,
      setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2, zoom)) }),
      // Initialize sidebar closed on mobile/tablet (< 1024px), open on desktop
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      activeGenerations: 0,
      incrementGenerations: (count) => set((state) => ({ activeGenerations: state.activeGenerations + count })),
      decrementGenerations: (count) => set((state) => ({ activeGenerations: Math.max(0, state.activeGenerations - count) })),

      // Comparison mode
      compareImages: [],
      toggleCompare: (file) =>
        set((state) => {
          const isSelected = state.compareImages.includes(file);
          if (isSelected) {
            return { compareImages: state.compareImages.filter((f) => f !== file) };
          }
          // Limit to 4 images for comparison
          if (state.compareImages.length >= 4) {
            return state;
          }
          return { compareImages: [...state.compareImages, file] };
        }),
      clearCompare: () => set({ compareImages: [] }),
      openCompare: () => {
        const state = get();
        if (state.compareImages.length < 2) return;
        // Open lightbox with compare images
        const images = state.compareImages.map((file) => ({
          file,
          prompt: state.library.find((l) => l.file === file)?.prompt ||
                  state.generatedImages.find((g) => g.file === file)?.prompt,
        }));
        state.openLightbox(images, 0, 'library');
      },

      // Prompt history
      promptHistory: [],
      addToHistory: (prompt) =>
        set((state) => {
          const history = state.promptHistory.filter((p) => p !== prompt);
          return { promptHistory: [prompt, ...history].slice(0, 50) };
        }),

      // Prompt templates (with starter defaults)
      promptTemplates: [
        { id: 'default-1', name: 'Portrait', prompt: 'elegant portrait, soft studio lighting, natural expression', createdAt: 0 },
        { id: 'default-2', name: 'Candid', prompt: 'candid moment, natural light, authentic emotion', createdAt: 0 },
        { id: 'default-3', name: 'Artistic', prompt: 'artistic portrait, creative lighting, dramatic shadows', createdAt: 0 },
      ],
      addPromptTemplate: (name, prompt) =>
        set((state) => ({
          promptTemplates: [
            ...state.promptTemplates,
            { id: `template-${Date.now()}`, name, prompt, createdAt: Date.now() },
          ],
        })),
      deletePromptTemplate: (id) =>
        set((state) => ({
          promptTemplates: state.promptTemplates.filter((t) => t.id !== id),
        })),

      // Incognito mode (for hiding NSFW images)
      incognitoImages: [],
      incognitoMode: false,
      viewingIncognitoCollection: false,
      toggleIncognito: (file) => {
        const state = get();
        const newImages = state.incognitoImages.includes(file)
          ? state.incognitoImages.filter((f) => f !== file)
          : [...state.incognitoImages, file];
        set({ incognitoImages: newImages });
        // Save to server
        saveIncognitoImages(newImages).catch(console.error);
      },
      setIncognitoMode: (mode) => set({ incognitoMode: mode, viewingIncognitoCollection: false }),
      setViewingIncognitoCollection: (viewing) => set({ viewingIncognitoCollection: viewing }),
      initIncognitoSync: async () => {
        try {
          const serverImages = await fetchIncognitoImages();
          const localImages = get().incognitoImages;
          // Merge local and server (union)
          const merged = [...new Set([...localImages, ...serverImages])];
          set({ incognitoImages: merged });
          // Save merged back to server
          if (merged.length !== serverImages.length) {
            saveIncognitoImages(merged).catch(console.error);
          }
        } catch (e) {
          console.error('Failed to sync incognito images:', e);
        }
      },

      // Batch sync
      batchSyncStatus: 'idle',
      batchSyncError: null,
      initBatchSync: async () => {
        set({ batchSyncStatus: 'syncing', batchSyncError: null });
        try {
          const localBatches = get().batches;
          // Sync local batches with server (merges both)
          const result = await syncBatches(localBatches);
          set({ batches: result.batches, batchSyncStatus: 'idle' });
          console.log(`Batch sync complete: ${result.merged_count} batches`);
        } catch (error) {
          console.error('Batch sync failed:', error);
          set({ batchSyncStatus: 'error', batchSyncError: String(error) });
          // On error, try to at least fetch server batches
          try {
            const serverBatches = await fetchBatches();
            if (serverBatches.length > 0) {
              // Merge manually: keep local batches, add server-only batches
              const localIds = new Set(get().batches.map(b => b.id));
              const newBatches = serverBatches.filter(b => !localIds.has(b.id));
              if (newBatches.length > 0) {
                set((state) => ({ batches: [...state.batches, ...newBatches] }));
              }
            }
          } catch {
            // Ignore secondary error
          }
        }
      },
      _saveBatchesToServer: () => {
        // Debounced save - called after batch mutations
        const batches = get().batches;
        saveBatches(batches).catch((error) => {
          console.error('Failed to save batches to server:', error);
        });
      },
    }),
    {
      name: 'lumiere-studio',
      partialize: (state) => ({
        // Only persist these fields
        batches: state.batches,
        assessments: state.assessments,
        selectedRefs: state.selectedRefs,
        selectedModels: state.selectedModels,
        promptHistory: state.promptHistory,
        promptTemplates: state.promptTemplates,
        incognitoImages: state.incognitoImages,
        zoom: state.zoom,
        aspect: state.aspect,
        quality: state.quality,
        quantity: state.quantity,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after Zustand has restored state from localStorage
        // This is the right time to sync with server
        if (state && !hasSyncedThisSession) {
          hasSyncedThisSession = true;
          console.log('Zustand rehydrated, syncing...');

          // Migrate: clean up stale model IDs that no longer exist
          const validModelIds = new Set(MODELS.map(m => m.id));
          const cleanedModels = state.selectedModels.filter(id => validModelIds.has(id));
          if (cleanedModels.length !== state.selectedModels.length) {
            console.log('Migrating stale model IDs:', state.selectedModels, '->', cleanedModels);
            state.setSelectedModels(cleanedModels.length > 0 ? cleanedModels : [MODELS[0].id]);
          }

          state.initBatchSync();
          state.initIncognitoSync();
        }
      },
    }
  )
);

// Trigger sync after store creation (handles HMR case where onRehydrateStorage doesn't fire)
triggerDelayedSync();
