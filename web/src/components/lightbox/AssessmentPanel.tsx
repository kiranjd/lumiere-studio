import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useStore } from '../../stores/store';
import { assessImageEnhanced, type EnhancedAssessment } from '../../api/assessment';
import { Button } from '../ui/Button';

interface AssessmentPanelProps {
  file: string;
  prompt?: string;
  onClose: () => void;
  onApplyFix: (fix: string) => void;
}

export function AssessmentPanel({ file, prompt, onClose, onApplyFix }: AssessmentPanelProps) {
  const selectedRefs = useStore((s) => s.selectedRefs);
  const assessments = useStore((s) => s.assessments);
  const setAssessment = useStore((s) => s.setAssessment);
  const addToast = useStore((s) => s.addToast);

  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setLocalAssessment] = useState<EnhancedAssessment | null>(
    (assessments[file] as EnhancedAssessment) || null
  );

  const handleAssess = async (withRefs: boolean) => {
    setIsAssessing(true);
    try {
      const result = await assessImageEnhanced({
        file,
        prompt,
        referenceFiles: withRefs ? selectedRefs : [],
      });
      setLocalAssessment(result);
      setAssessment(file, result);
      addToast({ message: `Assessed: ${result.scores.overall}/10`, type: 'success' });
    } catch (e) {
      addToast({ message: 'Assessment failed', type: 'error' });
      console.error(e);
    }
    setIsAssessing(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-ok';
    if (score >= 6) return 'text-gold';
    if (score >= 4) return 'text-amber';
    return 'text-err';
  };


  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'excellent': return 'bg-ok text-void';
      case 'good': return 'bg-gold text-void';
      case 'iterate': return 'bg-amber text-void';
      case 'reject': return 'bg-err text-void';
      default: return 'bg-bg-4 text-text';
    }
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-96 h-full bg-bg-2 border-l border-border flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-text">Assessment</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-bg-3 text-text-3 hover:text-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!assessment ? (
          // No assessment yet - show action buttons
          <div className="p-4 space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-bg-3 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-text font-medium mb-2">Assess this image</h4>
              <p className="text-text-3 text-sm mb-6">
                Get detailed feedback on realism, social media readiness, and improvement suggestions.
              </p>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleAssess(false)}
              isLoading={isAssessing}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quick Assessment
            </Button>

            {selectedRefs.length > 0 && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleAssess(true)}
                isLoading={isAssessing}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Compare with {selectedRefs.length} ref{selectedRefs.length > 1 ? 's' : ''}
              </Button>
            )}

            <p className="text-xs text-text-3 text-center">
              Select reference images in the library for character consistency analysis
            </p>
          </div>
        ) : (
          // Show assessment results
          <div className="p-4 space-y-4">
            {/* Verdict header */}
            <div className="flex items-center gap-3">
              <span className={cn('px-3 py-1 rounded-full text-sm font-bold uppercase', getVerdictStyle(assessment.verdict))}>
                {assessment.verdict}
              </span>
              <span className={cn('text-2xl font-bold', getScoreColor(assessment.scores.overall))}>
                {assessment.scores.overall}/10
              </span>
            </div>

            {/* Headline */}
            <p className="text-text font-medium">{assessment.headline}</p>

            {/* Score breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <ScoreCard label="Realism" score={assessment.scores.realism} />
              <ScoreCard label="Social" score={assessment.scores.socialReady} />
              {assessment.scores.consistency != null && (
                <ScoreCard label="Match" score={assessment.scores.consistency} />
              )}
            </div>

            {/* Character consistency */}
            {assessment.consistency && (
              <Section title="Character Match" icon="👤" color="purple">
                <div className="mb-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-text-3">Similarity</span>
                    <span className="text-purple font-medium">{assessment.consistency.match}%</span>
                  </div>
                  <div className="h-2 bg-bg-4 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple transition-all"
                      style={{ width: `${assessment.consistency.match}%` }}
                    />
                  </div>
                </div>
                {assessment.consistency.preserved.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-ok mb-1">Preserved:</p>
                    <ul className="text-xs text-text-2 space-y-0.5">
                      {assessment.consistency.preserved.map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {assessment.consistency.drifted.length > 0 && (
                  <div>
                    <p className="text-xs text-err mb-1">Drifted:</p>
                    <ul className="text-xs text-text-2 space-y-0.5">
                      {assessment.consistency.drifted.map((d, i) => (
                        <li key={i}>• {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {/* Technical analysis */}
            <Section title="Technical" icon="🔍" color="blue">
              {assessment.technical.strengths.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-ok mb-1">Strengths:</p>
                  <ul className="text-xs text-text-2 space-y-0.5">
                    {assessment.technical.strengths.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assessment.technical.issues.length > 0 && (
                <div>
                  <p className="text-xs text-err mb-1">Issues:</p>
                  <ul className="text-xs text-text-2 space-y-0.5">
                    {assessment.technical.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* Social media */}
            <Section title="Social Media" icon="📱" color="gold">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-bg-4 rounded text-xs text-text-2">
                    Best for: {assessment.social.platform}
                  </span>
                </div>
                {assessment.social.captionIdea && (
                  <div className="p-2 bg-bg-3 rounded-lg">
                    <p className="text-xs text-text-3 mb-1">Caption idea:</p>
                    <p className="text-sm text-text italic">"{assessment.social.captionIdea}"</p>
                  </div>
                )}
                {assessment.social.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {assessment.social.hashtags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-dim text-blue text-xs rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* Improvements */}
            <Section title="Improvements" icon="✨" color="gold">
              {assessment.improvements.quickFixes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-text-3 mb-2">Quick fixes:</p>
                  <div className="space-y-1.5">
                    {assessment.improvements.quickFixes.map((fix, i) => (
                      <button
                        key={i}
                        onClick={() => onApplyFix(fix)}
                        className="w-full text-left p-2 rounded-lg bg-bg-3 hover:bg-gold-dim
                                 text-xs text-text-2 hover:text-gold transition-colors"
                      >
                        {fix}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {assessment.improvements.creativeSuggestions.length > 0 && (
                <div>
                  <p className="text-xs text-text-3 mb-2">Creative ideas:</p>
                  <div className="space-y-1.5">
                    {assessment.improvements.creativeSuggestions.map((idea, i) => (
                      <button
                        key={i}
                        onClick={() => onApplyFix(idea)}
                        className="w-full text-left p-2 rounded-lg bg-bg-3 hover:bg-purple-dim
                                 text-xs text-text-2 hover:text-purple transition-colors"
                      >
                        💡 {idea}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Iteration prompt */}
            {assessment.iterationPrompt && (
              <Section title="Ready-to-use Prompt" icon="📝" color="ok">
                <button
                  onClick={() => onApplyFix(assessment.iterationPrompt)}
                  className="w-full text-left p-3 rounded-lg bg-ok-dim border border-ok/20
                           text-sm text-text hover:bg-ok/20 transition-colors"
                >
                  {assessment.iterationPrompt}
                </button>
              </Section>
            )}

            {/* Re-assess button */}
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => handleAssess(selectedRefs.length > 0)}
                isLoading={isAssessing}
              >
                Re-assess {selectedRefs.length > 0 ? 'with refs' : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Helper components
function ScoreCard({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 8) return 'text-ok bg-ok-dim';
    if (s >= 6) return 'text-gold bg-gold-dim';
    if (s >= 4) return 'text-amber bg-amber-dim';
    return 'text-err bg-err-dim';
  };

  return (
    <div className={cn('rounded-lg p-2 text-center', getColor(score))}>
      <div className="text-lg font-bold">{score}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: string;
  color: 'blue' | 'gold' | 'purple' | 'ok';
  children: React.ReactNode;
}) {
  const borderColors = {
    blue: 'border-blue/20',
    gold: 'border-gold/20',
    purple: 'border-purple/20',
    ok: 'border-ok/20',
  };

  return (
    <div className={cn('p-3 rounded-lg bg-bg-3 border', borderColors[color])}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <h4 className="text-xs font-medium text-text uppercase tracking-wide">{title}</h4>
      </div>
      {children}
    </div>
  );
}
