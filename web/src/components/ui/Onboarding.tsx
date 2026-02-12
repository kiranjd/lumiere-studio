import { motion } from 'framer-motion';
import { useStore } from '../../stores/store';

// Sample images to show what the app can do
const SAMPLE_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop',
    prompt: 'Portrait with golden hour lighting',
  },
  {
    url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=500&fit=crop',
    prompt: 'Elegant studio portrait',
  },
  {
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
    prompt: 'Natural light portrait',
  },
  {
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop',
    prompt: 'Casual lifestyle shot',
  },
];

export function Onboarding() {
  const setShowSettings = useStore((s) => s.setShowSettings);
  const apiKeys = useStore((s) => s.apiKeys);

  const hasApiKeys = apiKeys.openrouter || apiKeys.openai;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI Image Generation
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Generate Consistent Character Images
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Create variations of the same character across different poses, expressions, and styles.
            Use reference images to maintain consistency.
          </p>
        </motion.div>

        {/* Sample gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4 text-center">
            Example Outputs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SAMPLE_IMAGES.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 relative group"
              >
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-xs text-zinc-300 line-clamp-2">{img.prompt}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4 text-center">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: '1. Select References',
                desc: 'Choose up to 4 reference images to guide the AI',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
                title: '2. Write a Prompt',
                desc: 'Describe the variation you want to create',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: '3. Generate',
                desc: 'AI creates new images maintaining character consistency',
              },
            ].map((step, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-zinc-700/50 flex items-center justify-center mx-auto mb-3 text-purple-400">
                  {step.icon}
                </div>
                <h3 className="font-medium text-white mb-1">{step.title}</h3>
                <p className="text-sm text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* API Keys CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`p-6 rounded-2xl border ${
            hasApiKeys
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-amber-500/5 border-amber-500/20'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              hasApiKeys ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {hasApiKeys ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-medium text-white mb-1">
                {hasApiKeys ? 'API Keys Configured' : 'Add Your API Keys'}
              </h3>
              <p className="text-sm text-zinc-400">
                {hasApiKeys
                  ? 'You\'re ready to generate images. Keys are stored locally in your browser.'
                  : 'Bring your own keys from OpenRouter or OpenAI. Keys stay in your browser—never sent to our servers.'}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors shrink-0 ${
                hasApiKeys
                  ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  : 'bg-purple-500 text-white hover:bg-purple-400'
              }`}
            >
              {hasApiKeys ? 'Manage Keys' : 'Add API Keys'}
            </button>
          </div>
        </motion.div>

        {/* Models info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-zinc-500 mb-3">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-zinc-400">
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-sm">Gemini 3 Pro</span>
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-sm">GPT Image 1.5</span>
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-sm">Z-Image Turbo</span>
          </div>
        </motion.div>

        {/* Keyboard shortcut hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Cmd</kbd>
            <span>+</span>
            <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">Enter</kbd>
            <span className="ml-2">to generate</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
