import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Factory,
  Globe2,
  Layers3,
  Map,
  Network,
  Package,
  Route,
  Smartphone,
  Sparkles,
  Trophy,
  Truck,
  Wifi,
  Zap,
} from "lucide-react";

type Concept = {
  id: number;
  name: string;
  strap: string;
  why: string;
  strengths: string[];
  r3f: string;
  accent: string;
  motif: "city" | "world" | "campus" | "orbit" | "logistics" | "hex" | "tower" | "arena" | "rooms" | "hybrid";
};

const concepts: Concept[] = [
  {
    id: 1,
    name: "Global Smart City",
    strap: "A living miniature world where each region becomes a district.",
    why: "Closest to the WareTrack inspiration: the class watches a miniature economy rather than a flat board.",
    strengths: ["Strong projector readability", "Regions feel physical", "Sales can animate as moving phones / trucks"],
    r3f: "Best use of R3F. District meshes, roads, labels, animated delivery routes and camera fly-to.",
    accent: "#2563eb",
    motif: "city",
  },
  {
    id: 2,
    name: "Holographic World Table",
    strap: "A premium strategy-room table with the world floating above it.",
    why: "Keeps the board-game feel, but turns it into a modern executive command centre.",
    strengths: ["Elegant and premium", "Easy to preserve current board logic", "Good for executive education"],
    r3f: "R3F globe / plane mesh, emissive region borders, HTML labels via drei, subtle orbit camera.",
    accent: "#7c3aed",
    motif: "world",
  },
  {
    id: 3,
    name: "Innovation Campus",
    strap: "Each team owns a campus; market regions sit around a shared central plaza.",
    why: "Makes R&D, production, logistics and sales visibly different physical places.",
    strengths: ["Very teachable", "Shows systems thinking", "Excellent phase-by-phase animation"],
    r3f: "Campus buildings scale with investment. Research labs light up as technologies complete.",
    accent: "#059669",
    motif: "campus",
  },
  {
    id: 4,
    name: "Orbital Market Network",
    strap: "Regions orbit a central smartphone core, connected by dynamic trade lanes.",
    why: "Visually distinctive and makes market reach / control immediately visible.",
    strengths: ["Clean and futuristic", "Routes are easy to follow", "Works well with 10+ regions"],
    r3f: "Instanced region nodes, curved Bezier links, bloom on active sales / logistics.",
    accent: "#9333ea",
    motif: "orbit",
  },
  {
    id: 5,
    name: "Logistics Diorama",
    strap: "A tabletop world of factories, roads, depots, ports and market hubs.",
    why: "Pushes the WareTrack visual language furthest while remaining relevant to Smartphone Inc.",
    strengths: ["Highly animated", "Great logistics storytelling", "Immediate cause-and-effect"],
    r3f: "Vehicles travel along splines; factories emit product crates; offices unlock new lanes.",
    accent: "#ea580c",
    motif: "logistics",
  },
  {
    id: 6,
    name: "Hex Strategy World",
    strap: "A modular hex landscape with markets, technology and control layered into tiles.",
    why: "Feels like a premium digital board game while improving spatial clarity.",
    strengths: ["Game-like", "Scales well", "Clear ownership and control"],
    r3f: "Hex tiles as instanced meshes. Height, glow and decals show market value and team control.",
    accent: "#ca8a04",
    motif: "hex",
  },
  {
    id: 7,
    name: "Market Towers",
    strap: "Every region is a vertical tower; floors fill as teams gain presence and control.",
    why: "Turns abstract control points into something the whole room can read instantly.",
    strengths: ["Best distance readability", "Scores become physical", "Low visual clutter"],
    r3f: "Each region tower grows / fills by team; animated floor bands represent offices, sales and control.",
    accent: "#dc2626",
    motif: "tower",
  },
  {
    id: 8,
    name: "Competitive Arena",
    strap: "Teams occupy corners of an arena and compete for markets in the centre.",
    why: "Emphasises rivalry, turn order and scoring — ideal when competition is the energy driver.",
    strengths: ["Strong drama", "Excellent scoring moments", "Team colours dominate"],
    r3f: "Team bases, animated score pylons, spotlight camera for major events and phase transitions.",
    accent: "#db2777",
    motif: "arena",
  },
  {
    id: 9,
    name: "Strategy Rooms",
    strap: "A cutaway office building with rooms for planning, production, research, logistics and sales.",
    why: "Makes the operating model visible and directly links decisions to business functions.",
    strengths: ["Very intuitive for teaching", "Strong phase structure", "Easy to explain"],
    r3f: "Camera moves room-to-room by phase. Objects in each room update from live game state.",
    accent: "#0891b2",
    motif: "rooms",
  },
  {
    id: 10,
    name: "Hybrid Command Map",
    strap: "Your current 2D viewer retained as a glass HUD over a subtle 3D world.",
    why: "Lowest implementation risk and the best migration path from the current viewer.",
    strengths: ["Preserves current UX", "Can ship incrementally", "3D adds atmosphere without hiding data"],
    r3f: "R3F is the spatial layer; existing React viewer components remain as HTML overlays.",
    accent: "#4f46e5",
    motif: "hybrid",
  },
];

const teamDots = ["#22c55e", "#3b82f6", "#111827", "#f59e0b"];

function MiniScene({ concept }: { concept: Concept }) {
  const cards = useMemo(
    () => [
      { l: "Canada", x: 16, y: 24, v: 5 },
      { l: "Europe", x: 42, y: 17, v: 4 },
      { l: "China", x: 70, y: 31, v: 8 },
      { l: "RSA", x: 43, y: 62, v: 3 },
      { l: "Australia", x: 75, y: 65, v: 7 },
    ],
    []
  );

  if (concept.motif === "city" || concept.motif === "logistics" || concept.motif === "campus") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-white/55 [transform:skewY(-4deg)] origin-bottom-left" />
        <div className="absolute left-[8%] top-[18%] h-2 w-[82%] rotate-[-12deg] rounded-full bg-slate-300/60" />
        <div className="absolute left-[15%] top-[60%] h-2 w-[70%] rotate-[8deg] rounded-full bg-slate-300/60" />
        {[18, 35, 56, 73].map((x, i) => (
          <div key={x} className="absolute" style={{ left: `${x}%`, top: `${32 + (i % 2) * 19}%` }}>
            <div
              className="relative h-16 w-20 rounded-md border border-white/80 shadow-lg"
              style={{ background: i % 2 ? "#e2e8f0" : "#dbeafe", transform: "skewY(-5deg)" }}
            >
              <div className="absolute -top-3 left-2 h-3 w-16 rounded-t bg-slate-300" />
              <div className="absolute bottom-1 left-2 flex gap-1">
                {[0, 1, 2].map((d) => <span key={d} className="h-3 w-3 rounded-full" style={{ background: teamDots[d] }} />)}
              </div>
            </div>
          </div>
        ))}
        <Truck className="absolute left-[41%] top-[52%] h-8 w-8 text-blue-600 drop-shadow" />
        <Factory className="absolute left-[70%] top-[21%] h-10 w-10 text-slate-700" />
        <Smartphone className="absolute left-[12%] top-[26%] h-7 w-7 text-purple-600" />
      </div>
    );
  }

  if (concept.motif === "world" || concept.motif === "orbit") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-slate-950">
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-300/40 bg-gradient-to-br from-blue-500/40 via-cyan-400/20 to-purple-500/40 shadow-[0_0_60px_rgba(59,130,246,.28)]" />
        {[0,1,2].map((r)=>(
          <div key={r} className="absolute left-1/2 top-1/2 rounded-full border border-white/15" style={{ width: 210 + r*72, height: 95 + r*45, transform: `translate(-50%,-50%) rotate(${r*22}deg)` }} />
        ))}
        {cards.map((c, i) => (
          <div key={c.l} className="absolute rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold text-white backdrop-blur"
            style={{ left: `${c.x}%`, top: `${c.y}%`, boxShadow: `0 0 22px ${teamDots[i%4]}55` }}>
            {c.l} · {c.v}
          </div>
        ))}
        <Smartphone className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white" />
      </div>
    );
  }

  if (concept.motif === "hex") {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="absolute inset-5 grid grid-cols-5 gap-2 rotate-[-4deg]">
          {Array.from({length:20}).map((_,i)=>(
            <div key={i} className="aspect-square bg-white shadow-sm border border-slate-300 flex items-center justify-center"
              style={{ clipPath:"polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)", background: i%6===0 ? concept.accent+"33" : "#fff" }}>
              {i%4===0 && <span className="h-3 w-3 rounded-full" style={{background:teamDots[i%4]}} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (concept.motif === "tower") {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-slate-100">
        <div className="absolute inset-x-6 bottom-7 flex items-end justify-between gap-3">
          {[44,72,58,86,64,76].map((h,i)=>(
            <div key={i} className="relative flex-1 rounded-t border border-slate-300 bg-white shadow-md" style={{height:h+"%"}}>
              <div className="absolute inset-x-0 bottom-0 rounded-t" style={{height:`${35+i*8}%`, background:teamDots[i%4]+"cc"}} />
              <div className="absolute -top-5 inset-x-0 text-center text-[9px] font-black text-slate-600">{["CAN","EUR","USA","CHN","RSA","AUS"][i]}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (concept.motif === "arena") {
    return (
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute left-1/2 top-1/2 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-8 border-slate-700 bg-slate-900 shadow-inner" />
        {teamDots.map((c,i)=><div key={c} className="absolute h-14 w-14 rounded-2xl border-4 border-white/70 shadow-xl" style={{background:c,left:i%2? "78%":"8%",top:i<2?"13%":"70%"}} />)}
        <Trophy className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-amber-400" />
      </div>
    );
  }

  if (concept.motif === "rooms") {
    return (
      <div className="absolute inset-0 bg-slate-100 p-5">
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-2">
          {[
            ["PLAN", Layers3],["MAKE", Factory],["IMPROVE", Sparkles],["R&D", Zap],["MOVE", Route],["SELL", Smartphone]
          ].map(([label, Icon]: any, i)=>(
            <div key={label} className="relative overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <Icon className="absolute left-3 top-3 h-7 w-7" style={{color:concept.accent}} />
              <div className="absolute bottom-2 left-3 text-[10px] font-black tracking-widest text-slate-500">{label}</div>
              <div className="absolute right-3 top-3 flex gap-1">{teamDots.slice(0,(i%4)+1).map(c=><span key={c} className="h-2 w-2 rounded-full" style={{background:c}} />)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-blue-50">
      <div className="absolute inset-6 rounded-[28px] border border-slate-300 bg-white/65 shadow-xl backdrop-blur">
        <div className="absolute left-5 top-5 right-5 h-9 rounded-lg bg-slate-900" />
        <div className="absolute left-5 top-20 bottom-5 w-12 rounded-lg bg-white shadow" />
        <div className="absolute right-5 top-20 bottom-5 w-16 rounded-lg bg-white shadow" />
        <div className="absolute left-24 right-28 top-20 bottom-5 rounded-2xl border border-blue-200 bg-blue-100/50">
          {cards.map((c,i)=><div key={c.l} className="absolute h-9 w-16 rounded-lg bg-white shadow border border-slate-200 text-[8px] font-bold flex items-center justify-center"
            style={{left:`${c.x-8}%`,top:`${c.y-10}%`}}>{c.l}</div>)}
          <div className="absolute left-1/2 top-1/2 h-24 w-40 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-blue-400/50" />
          <Network className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

export default function ViewerConcepts() {
  const [selected, setSelected] = useState(1);
  const active = concepts.find((c) => c.id === selected)!;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-6 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[.22em] text-blue-600">Smartphone Inc Viewer Lab</div>
            <h1 className="text-2xl font-black tracking-tight">10 reimagined viewer directions</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Inspired by the isometric operations-dashboard style you shared, but designed around Smartphone Inc's regions, prices, technology, logistics, sales and control mechanics.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 lg:flex">
            <Sparkles className="h-4 w-4 text-purple-600" /> Concept gallery · no live game data changed
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-7">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {concepts.map((concept) => (
            <button key={concept.id} onClick={() => setSelected(concept.id)}
              className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${selected===concept.id ? "ring-2 ring-offset-2" : "border-slate-200"}`}
              style={selected===concept.id ? {borderColor:concept.accent, ["--tw-ring-color" as any]:concept.accent}:undefined}>
              <div className="relative aspect-[16/10] overflow-hidden"><MiniScene concept={concept} /></div>
              <div className="p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Option {concept.id}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{background:concept.accent}} />
                </div>
                <h2 className="font-black leading-tight">{concept.name}</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{concept.strap}</p>
              </div>
            </button>
          ))}
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.45fr_.75fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[.18em]" style={{color:active.accent}}>Selected direction</div>
                <h2 className="text-2xl font-black">{active.name}</h2>
              </div>
              <div className="rounded-xl px-3 py-2 text-xs font-black text-white" style={{background:active.accent}}>OPTION {active.id}</div>
            </div>
            <div className="relative aspect-[16/8] min-h-[420px]"><MiniScene concept={active} /></div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Why it works</h3>
              <p className="mt-3 text-base font-semibold leading-relaxed text-slate-700">{active.why}</p>
              <div className="mt-5 space-y-2">
                {active.strengths.map((s)=><div key={s} className="flex gap-2 text-sm text-slate-600"><span className="mt-2 h-1.5 w-1.5 rounded-full" style={{background:active.accent}} />{s}</div>)}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-300"><Globe2 className="h-4 w-4"/>React Three Fiber direction</div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{active.r3f}</p>
            </div>
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
              <div className="text-xs font-black uppercase tracking-wider text-blue-700">My shortlist</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700"><b>#1 Global Smart City</b> for the strongest “wow” factor, <b>#3 Innovation Campus</b> for teaching clarity, and <b>#10 Hybrid Command Map</b> as the safest implementation path.</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-700">Next step <ArrowRight className="h-4 w-4" /> build one as a live R3F proof-of-concept using your current Firebase game state.</div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
