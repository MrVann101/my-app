export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] px-7 py-8 md:block">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[var(--leaf)] text-lg font-bold text-white">B</span>
            <span className="text-lg font-semibold tracking-tight">bitewise</span>
          </div>
          <nav className="mt-16 space-y-2 text-sm font-medium" aria-label="Primary navigation">
            <a className="block rounded-xl bg-[#e4efe4] px-4 py-3 text-[var(--leaf-deep)]" href="#today">Today</a>
            <a className="block rounded-xl px-4 py-3 text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]" href="#log">Log food</a>
            <a className="block rounded-xl px-4 py-3 text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]" href="#plans">Meal plans</a>
            <a className="block rounded-xl px-4 py-3 text-[var(--ink-muted)] hover:bg-[var(--surface-muted)]" href="#profile">Profile</a>
          </nav>
          <p className="mt-auto pt-48 text-xs leading-5 text-[var(--ink-muted)]">Nutrition estimates are for tracking, not medical advice.</p>
        </aside>

        <main className="w-full px-5 pb-28 pt-6 sm:px-8 md:px-12 md:pb-12 md:pt-10">
          <header className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--leaf)]">Monday, September 7</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Good morning, Alex.</h1>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">A clear view of today, one meal at a time.</p>
            </div>
            <button className="grid size-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold shadow-sm" aria-label="Open profile">A</button>
          </header>

          <section id="today" className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-[2rem] bg-[var(--leaf-deep)] p-6 text-white shadow-[0_18px_45px_rgba(30,77,54,0.16)] sm:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#bdd6bd]">Remaining today</p>
                  <p className="mt-3 text-6xl font-semibold tracking-[-0.06em] sm:text-7xl">1,240</p>
                  <p className="mt-2 text-sm text-[#bdd6bd]">of 2,050 kcal target</p>
                </div>
                <div className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#d8ead6]">On track</div>
              </div>
              <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[39%] rounded-full bg-[var(--sun)]" /></div>
              <div className="mt-3 flex justify-between text-xs text-[#bdd6bd]"><span>810 kcal logged</span><span>39%</span></div>
            </div>

            <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <div className="flex items-center justify-between"><p className="font-semibold">Macros</p><span className="text-xs text-[var(--ink-muted)]">today</span></div>
              <div className="mt-6 space-y-5">
                <Macro label="Protein" value="62g" target="128g" color="var(--leaf)" width="48%" />
                <Macro label="Carbs" value="91g" target="205g" color="var(--sun)" width="44%" />
                <Macro label="Fat" value="28g" target="68g" color="var(--coral)" width="41%" />
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between"><div><p className="font-semibold">Your rhythm</p><p className="mt-1 text-sm text-[var(--ink-muted)]">Small consistency adds up.</p></div><span className="text-3xl">7</span></div>
              <p className="mt-6 text-sm font-medium text-[var(--leaf)]">day streak</p>
              <div className="mt-4 grid grid-cols-7 gap-2">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div key={`${day}-${index}`} className="text-center"><div className={`mx-auto grid size-8 place-items-center rounded-full text-xs ${index < 6 ? "bg-[#dcebdc] text-[var(--leaf-deep)]" : "border border-dashed border-[var(--line)] text-[var(--ink-muted)]"}`}>{index < 6 ? "✓" : "·"}</div><span className="mt-2 block text-[10px] text-[var(--ink-muted)]">{day}</span></div>)}</div>
            </div>
            <div id="log" className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
              <div className="flex items-center justify-between"><div><p className="font-semibold">Today&apos;s meals</p><p className="mt-1 text-sm text-[var(--ink-muted)]">Nothing logged for dinner yet.</p></div><button className="rounded-full bg-[var(--leaf)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--leaf-deep)]">+ Log food</button></div>
              <div className="mt-6 border-t border-[var(--line)] pt-5 text-sm"><div className="flex items-center justify-between"><span className="text-[var(--ink-muted)]">Breakfast</span><span className="font-medium">420 kcal</span></div><div className="mt-4 flex items-center justify-between"><span className="text-[var(--ink-muted)]">Lunch</span><span className="font-medium">390 kcal</span></div></div>
            </div>
          </section>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-[var(--surface)]/95 px-6 py-3 backdrop-blur md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-md justify-between text-center text-[11px] font-medium text-[var(--ink-muted)]"><a className="text-[var(--leaf)]" href="#today"><span className="block text-lg">⌂</span>Today</a><a href="#log"><span className="block text-lg">+</span>Log</a><a href="#plans"><span className="block text-lg">▦</span>Plans</a><a href="#profile"><span className="block text-lg">○</span>Profile</a></div></nav>
    </div>
  );
}

function Macro({ label, value, target, color, width }: { label: string; value: string; target: string; color: string; width: string }) {
  return <div><div className="flex justify-between text-sm"><span className="text-[var(--ink-muted)]">{label}</span><span className="font-medium">{value} <span className="font-normal text-[var(--ink-muted)]">/ {target}</span></span></div><div className="mt-2 h-2 rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full" style={{ backgroundColor: color, width }} /></div></div>;
}
