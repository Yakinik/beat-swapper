const PATHS = {
  play: 'M8 5.5v13l11-6.5z',
  stop: 'M6.5 6.5h11v11h-11z',
  loop: 'M4 11a7 7 0 0 1 7-7h9M17 1l3 3-3 3M20 13a7 7 0 0 1-7 7H4M7 23l-3-3 3-3',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  file: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9zM13 3v6h6',
  shift: 'M4 12h13M12 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  warn: 'M12 4 2 20h20zM12 10v5M12 18v.5',
} as const

export type IconName = keyof typeof PATHS

const FILLED: readonly IconName[] = ['play', 'stop']

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const filled = FILLED.includes(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
