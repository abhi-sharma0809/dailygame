import { AnimatePresence, motion } from 'framer-motion';

/**
 * The explorer: a small patched airship with a lantern gondola.
 * Drawn around (0,0) facing right. `mood` drives reactions.
 */
export type ExplorerMood = 'idle' | 'travel' | 'cheer' | 'celebrate';

export function Explorer({ mood = 'idle', facing = 1, reducedMotion = false, burstKey = 0 }: { mood?: ExplorerMood; facing?: 1 | -1; reducedMotion?: boolean; burstKey?: number }) {
  const bob = reducedMotion ? undefined : { y: mood === 'celebrate' ? [0, -16, 0, -8, 0] : [0, -4, 0] };
  const bobT = mood === 'celebrate' ? { duration: 1.2, ease: 'easeOut' as const } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const };
  return (
    <g>
      {/* ground shadow */}
      <ellipse cx="0" cy="34" rx="16" ry="3.5" fill="#05090D" opacity="0.35" />
      <motion.g animate={bob} transition={bobT}>
        <motion.g
          animate={!reducedMotion && mood === 'celebrate' ? { rotate: [0, -12, 12, -6, 0] } : !reducedMotion && mood === 'cheer' ? { rotate: [0, -6, 4, 0] } : { rotate: 0 }}
          transition={{ duration: 1.1 }}
          style={{ transformOrigin: '0px 0px' }}
        >
          <g transform={`scale(${facing} 1)`}>
            {/* rigging */}
            <path d="M-12 8 L-8 20 M12 8 L8 20 M0 10 L0 20" stroke="#26323A" strokeWidth="1" />
            {/* envelope */}
            <ellipse cx="0" cy="-4" rx="25" ry="15" fill="#F0E6D1" stroke="#26323A" strokeWidth="1.6" />
            <clipPath id="ks-env"><ellipse cx="0" cy="-4" rx="25" ry="15" /></clipPath>
            <g clipPath="url(#ks-env)">
              <rect x="-25" y="-19" width="8" height="30" fill="#C8693F" />
              <rect x="-4" y="-19" width="8" height="30" fill="#D9AD63" />
              <rect x="17" y="-19" width="8" height="30" fill="#C8693F" />
              <ellipse cx="6" cy="2" rx="26" ry="12" fill="#26323A" opacity="0.18" />
              <ellipse cx="-8" cy="-12" rx="10" ry="4" fill="#FFFFFF" opacity="0.45" />
            </g>
            {/* patch */}
            <rect x="8" y="-14" width="7" height="6" fill="#89B7CE" stroke="#26323A" strokeWidth="0.8" transform="rotate(12 11 -11)" />
            {/* tail fin */}
            <path d="M-24 -4 L-34 -14 L-32 -4 L-34 6 Z" fill="#78936B" stroke="#26323A" strokeWidth="1.2" />
            {/* gondola */}
            <path d="M-11 20 L11 20 L8 28 L-8 28 Z" fill="#8C6B4F" stroke="#26323A" strokeWidth="1.4" />
            <circle cx="0" cy="24" r="2.2" fill="#FCE7B8" />
            {/* propeller */}
            <g transform="translate(-13 24)">
              <ellipse rx="1.5" ry="6" fill="#26323A" className={reducedMotion ? undefined : 'anim-spin'} />
            </g>
            {/* pennant */}
            <path d="M8 20 L8 13 L16 15.5 L8 18" fill="#D9AD63" stroke="#26323A" strokeWidth="0.8" />
          </g>
        </motion.g>
      </motion.g>

      {/* reaction sparkles */}
      <AnimatePresence>
        {burstKey > 0 && (mood === 'celebrate' || mood === 'cheer') && !reducedMotion && (
          <motion.g key={burstKey} initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, delay: 0.4 }}>
            {Array.from({ length: mood === 'celebrate' ? 14 : 7 }, (_, i) => {
              const a = (i / (mood === 'celebrate' ? 14 : 7)) * Math.PI * 2;
              const d = mood === 'celebrate' ? 54 : 34;
              return (
                <motion.path
                  key={i}
                  d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z"
                  fill={i % 2 ? '#ECCB8B' : '#F8F3E8'}
                  initial={{ x: 0, y: -4, scale: 0.4 }}
                  animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - 4, scale: mood === 'celebrate' ? 1.6 : 1.1, rotate: 90 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
              );
            })}
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
}
