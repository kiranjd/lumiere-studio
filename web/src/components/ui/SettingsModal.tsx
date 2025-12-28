import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { useStore } from '../../stores/store';

export function SettingsModal() {
  const apiKeys = useStore((s) => s.apiKeys);
  const setApiKey = useStore((s) => s.setApiKey);
  const showSettings = useStore((s) => s.showSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const addToast = useStore((s) => s.addToast);

  const [openrouter, setOpenrouter] = useState(apiKeys.openrouter);
  const [openai, setOpenai] = useState(apiKeys.openai);
  const [replicate, setReplicate] = useState(apiKeys.replicate);

  if (!showSettings) return null;

  const handleSave = () => {
    setApiKey('openrouter', openrouter);
    setApiKey('openai', openai);
    setApiKey('replicate', replicate);
    addToast({ message: 'API keys saved locally', type: 'success' });
    setShowSettings(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-lg mx-4"
      >
        <h2 className="text-xl font-semibold text-white mb-1">Settings</h2>
        <p className="text-sm text-zinc-400 mb-6">
          API keys are stored locally in your browser. They never leave your device.
        </p>

        <div className="space-y-4">
          {/* OpenRouter */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              OpenRouter API Key
              <span className="text-zinc-500 font-normal ml-2">
                (for Gemini image generation)
              </span>
            </label>
            <input
              type="password"
              value={openrouter}
              onChange={(e) => setOpenrouter(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
            >
              Get OpenRouter key →
            </a>
          </div>

          {/* OpenAI */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              OpenAI API Key
              <span className="text-zinc-500 font-normal ml-2">
                (for GPT Image)
              </span>
            </label>
            <input
              type="password"
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
            >
              Get OpenAI key →
            </a>
          </div>

          {/* Replicate */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Replicate API Token
              <span className="text-zinc-500 font-normal ml-2">
                (for Z-Image Turbo)
              </span>
            </label>
            <input
              type="password"
              value={replicate}
              onChange={(e) => setReplicate(e.target.value)}
              placeholder="r8_..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <a
              href="https://replicate.com/account/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
            >
              Get Replicate token →
            </a>
          </div>
        </div>

        <div className="mt-6 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <p className="text-xs text-zinc-400">
            <span className="text-green-400">✓</span> Keys are stored in localStorage only
            <br />
            <span className="text-green-400">✓</span> API calls go directly from your browser
            <br />
            <span className="text-green-400">✓</span> No server-side storage of credentials
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowSettings(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
          >
            Save Keys
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
