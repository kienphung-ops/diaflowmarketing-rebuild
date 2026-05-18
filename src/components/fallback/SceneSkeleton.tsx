export function SceneSkeleton() {
  return (
    <div className="w-screen h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-3">Loading</p>
        <p className="text-white/70 text-2xl font-light tracking-widest animate-pulse">
          Meet your AI teammates
        </p>
      </div>
      <div className="flex gap-10 mt-4">
        {['mia', 'iris', 'leo'].map((name) => (
          <div key={name} className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 animate-pulse" />
            <div className="w-4 h-6 rounded bg-white/10 animate-pulse" />
            <div className="w-4 h-8 rounded bg-white/10 animate-pulse" />
            <div className="w-20 h-2.5 rounded bg-white/10 animate-pulse" />
            <div className="w-14 h-2 rounded bg-white/8 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
