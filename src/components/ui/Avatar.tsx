interface AvatarProps {
  name: string
  avatar?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
}

const SIZES = {
  xs:  { box: 'w-6 h-6',   text: 'text-[9px]',  dot: 'w-2 h-2 -right-0.5 -bottom-0.5' },
  sm:  { box: 'w-8 h-8',   text: 'text-xs',     dot: 'w-2.5 h-2.5 -right-0.5 -bottom-0.5' },
  md:  { box: 'w-10 h-10', text: 'text-sm',     dot: 'w-3 h-3 right-0 bottom-0' },
  lg:  { box: 'w-12 h-12', text: 'text-base',   dot: 'w-3.5 h-3.5 right-0 bottom-0' },
  xl:  { box: 'w-16 h-16', text: 'text-xl',     dot: 'w-4 h-4 right-0.5 bottom-0.5' },
}

const COLORS = [
  'bg-gradient-to-br from-violet-500 to-purple-600',
  'bg-gradient-to-br from-brand-500 to-indigo-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-red-500',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-cyan-500 to-blue-600',
  'bg-gradient-to-br from-amber-500 to-orange-500',
]

const getColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length]

export default function Avatar({ name, avatar, size = 'md', online }: AvatarProps) {
  const { box, text, dot } = SIZES[size]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={`relative inline-flex shrink-0 ${box}`}>
      {avatar ? (
        <img src={avatar} alt={name} className={`${box} rounded-full object-cover`} />
      ) : (
        <div className={`${box} ${getColor(name)} rounded-full flex items-center justify-center font-bold ${text} text-white`}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute ${dot} rounded-full border-2 border-surface-900 ${online ? 'bg-emerald-500' : 'bg-slate-600'}`} />
      )}
    </div>
  )
}
