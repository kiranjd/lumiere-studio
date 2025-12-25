import { useState, useEffect, useRef } from 'react';

interface InstagramPreviewProps {
  imageUrl: string;
  caption: string;
  hashtags: string;
  username?: string;
  avatarUrl?: string;
}

export function InstagramPreview({
  imageUrl,
  caption,
  hashtags,
  username = 'naina.ai',
  avatarUrl,
}: InstagramPreviewProps) {
  const [imageAspect, setImageAspect] = useState<'square' | 'portrait' | 'landscape'>('square');
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Detect image aspect ratio
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      if (ratio > 1.2) {
        setImageAspect('landscape'); // 1.91:1 max
      } else if (ratio < 0.85) {
        setImageAspect('portrait'); // 4:5
      } else {
        setImageAspect('square'); // 1:1
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const fullCaption = `${caption}${caption && hashtags ? '\n\n' : ''}${hashtags}`;
  const timeAgo = 'Just now';

  return (
    <div className="bg-black rounded-2xl overflow-hidden max-w-[375px] mx-auto border border-neutral-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
          <div className="w-full h-full rounded-full bg-black p-[2px]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-white">
                N
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{username}</p>
        </div>
        <button className="text-white p-1">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Image */}
      <div
        className={`relative bg-neutral-900 ${
          imageAspect === 'portrait' ? 'aspect-[4/5]' :
          imageAspect === 'landscape' ? 'aspect-[1.91/1]' :
          'aspect-square'
        }`}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button onClick={() => setLiked(!liked)} className="text-white">
              {liked ? (
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              )}
            </button>
            {/* Comment */}
            <button className="text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
            </button>
            {/* Share */}
            <button className="text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          {/* Save */}
          <button onClick={() => setSaved(!saved)} className="text-white">
            {saved ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Likes */}
        <p className="text-sm font-semibold text-white mb-1">
          {liked ? '1 like' : 'Be the first to like this'}
        </p>

        {/* Caption */}
        {fullCaption && (
          <div className="text-sm text-white">
            <span className="font-semibold">{username}</span>{' '}
            <span className="whitespace-pre-wrap">
              {fullCaption.split(/(#\w+)/g).map((part, i) =>
                part.startsWith('#') ? (
                  <span key={i} className="text-[#E0F1FF]">{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </span>
          </div>
        )}

        {/* Time */}
        <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-wide">
          {timeAgo}
        </p>
      </div>

      {/* Comment input */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-t border-neutral-800">
        <button className="text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.5}/>
            <path stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <circle cx="9" cy="10" r="1" fill="currentColor"/>
            <circle cx="15" cy="10" r="1" fill="currentColor"/>
          </svg>
        </button>
        <input
          type="text"
          placeholder="Add a comment..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none"
          disabled
        />
        <button className="text-[#0095F6] text-sm font-semibold opacity-50">
          Post
        </button>
      </div>
    </div>
  );
}
