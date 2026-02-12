import { useEffect } from 'react';
import { useStore } from '../../stores/store';
import { ImageCard, ProcessingCard } from '../cards/ImageCard';
import { fetchGeneratedImages } from '../../api/server';
import { MODELS } from '../../utils/constants';
import { Onboarding } from '../ui/Onboarding';

export function QueueView() {
  const queue = useStore((s) => s.queue);
  const generatedImages = useStore((s) => s.generatedImages);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);
  const generatedLoading = useStore((s) => s.generatedLoading);
  const setGeneratedLoading = useStore((s) => s.setGeneratedLoading);
  const openLightbox = useStore((s) => s.openLightbox);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const toggleRef = useStore((s) => s.toggleRef);
  const assessments = useStore((s) => s.assessments);
  const compareImages = useStore((s) => s.compareImages);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const incognitoImages = useStore((s) => s.incognitoImages);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const viewingIncognitoCollection = useStore((s) => s.viewingIncognitoCollection);

  // Load generated images on mount
  useEffect(() => {
    const load = async () => {
      setGeneratedLoading(true);
      try {
        const images = await fetchGeneratedImages();
        setGeneratedImages(images);
      } catch (e) {
        console.error('Failed to load generated images:', e);
      }
      setGeneratedLoading(false);
    };
    load();
  }, []);

  // Filter queue to only show active items (pending/processing)
  const activeQueue = queue.filter(
    (q) => q.status === 'pending' || q.status === 'processing'
  );

  // Filter images based on incognito mode and viewing state
  const visibleImages = viewingIncognitoCollection
    ? generatedImages.filter((img) => incognitoImages.includes(img.file))
    : incognitoMode
      ? generatedImages
      : generatedImages.filter((img) => !incognitoImages.includes(img.file));

  const hasContent = activeQueue.length > 0 || visibleImages.length > 0;

  const handleOpenLightbox = (index: number) => {
    const images = visibleImages.map((img) => ({
      file: img.file,
      prompt: img.prompt,
      model: img.model,
    }));
    openLightbox(images, index, 'queue');
  };

  if (generatedLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-3 text-sm">Loading images...</p>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return <Onboarding />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-32">
      {/* Processing queue - horizontal row at top */}
      {activeQueue.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-border">
          {activeQueue.map((item) => {
            const model = MODELS.find((m) => m.id === item.model);
            return (
              <ProcessingCard
                key={item.id}
                model={model?.name || item.model}
                status={item.status as 'pending' | 'processing'}
              />
            );
          })}
        </div>
      )}

      {/* Generated images - uniform grid flowing left-to-right */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {visibleImages.map((img, index) => (
          <div
            key={img.file}
            className="aspect-[3/4] rounded-lg overflow-hidden"
            style={{
              animation: index < 20
                ? `scale-in 0.3s ease-out ${Math.min(index * 0.02, 0.3)}s backwards`
                : undefined,
            }}
          >
            <ImageCard
              file={img.file}
              index={index}
              onOpen={() => handleOpenLightbox(index)}
              onSelect={() => toggleRef(img.file)}
              isSelected={selectedRefs.includes(img.file)}
              isComparing={compareImages.includes(img.file)}
              onToggleCompare={() => toggleCompare(img.file)}
              assessment={assessments[img.file]}
              prompt={img.prompt}
              model={img.model}
              fixedAspect
            />
          </div>
        ))}
      </div>
    </div>
  );
}
