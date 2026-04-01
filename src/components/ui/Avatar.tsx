interface AvatarProps {
  name: string
  avatar?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

const dotSizes = {
  sm: 'w-2 h-2 -bottom-0.5 -right-0.5',
  md: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  lg: 'w-3 h-3 bottom-0 right-0',
  xl: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getColor(name: string) {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-500',
    'from-indigo-500 to-blue-600',
    'from-teal-500 to-green-600',
  ]
  let hash = 0
  for (const c of name) hash = hash * 31 + c.charCodeAt(0)
  return colors[Math.abs(hash) % colors.length]
}

export default function Avatar({ name, avatar, size = 'md', online }: AvatarProps) {
  return (
    <div className="relative shrink-0">
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover ring-2 ring-slate-700`}
        />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${getColor(name)} flex items-center justify-center font-bold text-white shrink-0`}>
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute ${dotSizes[size]} rounded-full border-2 border-surface-900 ${online ? 'bg-accent-500 online-dot' : 'bg-slate-600'}`} />
      )}
    </div>
  )
}
