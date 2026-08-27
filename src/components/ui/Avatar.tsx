function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-10 w-10 rounded-[10px] text-sm',
} as const;

export function Avatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string;
  size?: keyof typeof SIZE_CLASSES;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`flex-shrink-0 object-cover ${SIZE_CLASSES[size]}`}
      />
    );
  }
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center bg-accent font-display font-bold text-accent-contrast ${SIZE_CLASSES[size]}`}
    >
      {initials(name)}
    </div>
  );
}
