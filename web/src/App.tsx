import { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { GeneratorIsland } from './components/layout/GeneratorIsland';
import { QueueView } from './components/views/QueueView';
import { LibraryView } from './components/views/LibraryView';
import { BatchView } from './components/views/BatchView';
import { ArchiveView } from './components/views/ArchiveView';
import { PublishView } from './components/views/PublishView';
import { Lightbox } from './components/lightbox/Lightbox';
import { ToastContainer } from './components/ui/Toast';
import { CompareBar } from './components/ui/CompareBar';
import { DragLayer } from './components/ui/DragLayer';
import { SelectionActionBar } from './components/ui/SelectionActionBar';
import { useStore } from './stores/store';
import { fetchLibrary, fetchGeneratedImages } from './api/server';

function App() {
  const currentView = useStore((s) => s.currentView);
  const setLibrary = useStore((s) => s.setLibrary);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);

  // Load library and generated images on app startup
  // Note: Batch sync is triggered by Zustand's onRehydrateStorage callback
  // after localStorage state is restored, ensuring batches are synced correctly
  useEffect(() => {
    fetchLibrary().then(setLibrary).catch(console.error);
    fetchGeneratedImages().then(setGeneratedImages).catch(console.error);
  }, [setLibrary, setGeneratedImages]);

  const renderView = () => {
    switch (currentView) {
      case 'queue':
        return <QueueView />;
      case 'library':
        return <LibraryView />;
      case 'batch':
        return <BatchView />;
      case 'archive':
        return <ArchiveView />;
      case 'publish':
        return <PublishView />;
      default:
        return <QueueView />;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-void">
      {/* Sidebar - renders as drawer on mobile, inline on desktop */}
      <Sidebar />

      {/* Main content - full width on mobile, flex with sidebar on desktop */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header />
        <main className="flex-1 flex overflow-hidden bg-bg">
          {renderView()}
        </main>
      </div>

      {/* Floating generator island - hide in publish view */}
      {currentView !== 'publish' && <GeneratorIsland />}

      {/* Lightbox */}
      <Lightbox />

      {/* Compare bar - hidden on very small screens */}
      <div className="hidden sm:block">
        <CompareBar />
      </div>

      {/* Toast notifications */}
      <ToastContainer />

      {/* Custom drag preview layer */}
      <DragLayer />

      {/* Selection action bar - appears when multiple images selected */}
      <SelectionActionBar />
    </div>
  );
}

export default App;
