import base64
TEAMS={1:'#10b981',2:'#3b82f6',3:'#1e293b',4:'#eab308',5:'#ef4444'}
NAME={1:'Team 1',2:'Team 2',3:'Team 3',4:'Team 4',5:'Team 5'}
def ink(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return '#0f172a' if (r*299+g*587+b*114)/1000>=135 else '#ffffff'
# sample data: start, revenue, control, patents(list), gain this round
D={4:dict(s=6,r=58,c=9,p=['GAMING'],pp=4,g=14),1:dict(s=3,r=49,c=12,p=['GPS','WIFI'],pp=8,g=11),
   2:dict(s=4,r=52,c=11,p=[],pp=0,g=12),5:dict(s=7,r=41,c=10,p=[],pp=0,g=9),3:dict(s=5,r=44,c=8,p=[],pp=0,g=8)}
tot={t:d['s']+d['r']+d['c']+d['pp'] for t,d in D.items()}
rank=sorted(D,key=lambda t:-tot[t])
bg=base64.b64encode(open('22_midgame-v11.png','rb').read()).decode()
o=[]; A=o.append
A('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Inter,Helvetica,Arial,sans-serif">')
A('''<defs><filter id="blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0b1226" flood-opacity=".45"/></filter>
<filter id="soft"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1226" flood-opacity=".25"/></filter>
<linearGradient id="hd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#3b5bdb"/></linearGradient></defs>''')
A(f'<image href="data:image/png;base64,{bg}" width="1920" height="1080" filter="url(#blur)"/>')
A('<rect width="1920" height="1080" fill="#0b1226" opacity=".55"/>')
X,Y,W,H=150,70,1620,940
A(f'<rect x="{X}" y="{Y}" width="{W}" height="{H}" rx="28" fill="#ffffff" filter="url(#sh)"/>')
A(f'<path d="M{X},{Y+28} a28,28 0 0 1 28,-28 h{W-56} a28,28 0 0 1 28,28 v82 h-{W} z" fill="url(#hd)"/>')
A(f'<text x="{X+44}" y="{Y+52}" font-size="13" font-weight="900" fill="#bfd0ff" letter-spacing="3">CLASS: SMARTPHONE INC</text>')
A(f'<text x="{X+44}" y="{Y+92}" font-size="38" font-weight="900" fill="#fff" letter-spacing="1">SCOREBOARD</text>')
A(f'<rect x="{X+330}" y="{Y+60}" width="132" height="34" rx="17" fill="#ffffff" fill-opacity=".18" stroke="#fff" stroke-opacity=".5"/><text x="{X+396}" y="{Y+83}" font-size="15" font-weight="900" text-anchor="middle" fill="#fff" letter-spacing="1">ROUND 6</text>')
# close button
A(f'<circle cx="{X+W-52}" cy="{Y+58}" r="22" fill="#fff" fill-opacity=".2"/><path d="M{X+W-60},{Y+50} l16,16 M{X+W-44},{Y+50} l-16,16" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>')
# legend
LEG=[('Start value','#94a3b8'),('Revenue','#38bdf8'),('Control points','#8b5cf6'),('Patents','#f59e0b')]
lx=X+44
for t,c in LEG:
    A(f'<rect x="{lx}" y="{Y+138}" width="16" height="16" rx="5" fill="{c}"/><text x="{lx+24}" y="{Y+151}" font-size="14" font-weight="700" fill="#475569">{t}</text>'); lx+=len(t)*8.6+60
A(f'<text x="{X+W-44}" y="{Y+151}" font-size="13" font-weight="700" text-anchor="end" fill="#94a3b8">Wildcard and directive bonuses are added at game end</text>')
# column headers
cols=[('START',760),('REVENUE',900),('CONTROL',1040),('PATENTS',1215),('THIS ROUND',1395)]
hy=Y+205
for t,cx in cols:
    A(f'<text x="{X+cx-150+ (0)}" y="{hy}" font-size="12" font-weight="900" text-anchor="middle" fill="#94a3b8" letter-spacing="1.5">{t}</text>')
A(f'<text x="{X+44}" y="{hy}" font-size="12" font-weight="900" fill="#94a3b8" letter-spacing="1.5">RANK / TEAM</text>')
A(f'<text x="{X+W-70}" y="{hy}" font-size="12" font-weight="900" text-anchor="end" fill="#94a3b8" letter-spacing="1.5">TOTAL</text>')
A(f'<line x1="{X+36}" y1="{hy+14}" x2="{X+W-36}" y2="{hy+14}" stroke="#e2e8f0" stroke-width="2"/>')
mx=max(tot.values())
RH=124
for i,t in enumerate(rank):
    d=D[t]; y=hy+28+i*RH; col=TEAMS[t]; lead=i==0
    A(f'<rect x="{X+30}" y="{y}" width="{W-60}" height="{RH-12}" rx="18" fill="{"#fffbeb" if lead else "#f8fafc"}" stroke="{"#fbbf24" if lead else "#e2e8f0"}" stroke-width="{3 if lead else 1.5}"/>')
    # rank medal
    mc=['#fbbf24','#cbd5e1','#d6a36b','#e2e8f0','#e2e8f0'][i]
    A(f'<circle cx="{X+80}" cy="{y+50}" r="26" fill="{mc}" stroke="#fff" stroke-width="3" filter="url(#soft)"/><text x="{X+80}" y="{y+60}" font-size="26" font-weight="900" text-anchor="middle" fill="#0f172a">{i+1}</text>')
    A(f'<rect x="{X+126}" y="{y+30}" width="150" height="40" rx="12" fill="{col}" filter="url(#soft)"/><text x="{X+201}" y="{y+57}" font-size="19" font-weight="900" text-anchor="middle" fill="{ink(col)}">{NAME[t]}</text>')
    # numbers
    def num(cx,v,c='#0f172a',sz=28):
        A(f'<text x="{X+cx-150}" y="{y+60}" font-size="{sz}" font-weight="900" text-anchor="middle" fill="{c}">{v}</text>')
    num(760,d['s'],'#64748b'); num(900,d['r'],'#0284c7'); num(1040,d['c'],'#7c3aed')
    # patents
    if d['p']:
        px_=X+1215-150-(len(d['p'])*70)/2+4
        for k,pn in enumerate(d['p']):
            A(f'<rect x="{px_+k*70:.0f}" y="{y+34}" width="64" height="26" rx="13" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/><text x="{px_+k*70+32:.0f}" y="{y+52}" font-size="11" font-weight="900" text-anchor="middle" fill="#b45309">{pn}</text>')
        A(f'<text x="{px_+len(d["p"])*70+4:.0f}" y="{y+46}" font-size="20" font-weight="900" fill="#d97706">+{d["pp"]}</text>')
    else:
        A(f'<text x="{X+1215-150}" y="{y+60}" font-size="22" font-weight="700" text-anchor="middle" fill="#cbd5e1">—</text>')
    A(f'<path d="M{X+1395-150-26},{y+56} l9,-10 l9,10 z" fill="#10b981"/><text x="{X+1395-150+4}" y="{y+60}" font-size="24" font-weight="900" fill="#059669">+{d["g"]}</text>')
    # total + stacked bar
    A(f'<text x="{X+W-70}" y="{y+52}" font-size="44" font-weight="900" text-anchor="end" fill="#0f172a">{tot[t]}</text><text x="{X+W-70}" y="{y+72}" font-size="11" font-weight="900" text-anchor="end" fill="#94a3b8" letter-spacing="1.5">POINTS</text>')
    bx=X+126; bw=1204; by=y+84; unit=bw/mx; cx_=bx
    for v,c in [(d['s'],'#94a3b8'),(d['r'],'#38bdf8'),(d['c'],'#8b5cf6'),(d['pp'],'#f59e0b')]:
        if v>0:
            w=v*unit; A(f'<rect x="{cx_:.1f}" y="{by}" width="{w:.1f}" height="14" fill="{c}"/>'); cx_+=w
    A(f'<rect x="{bx}" y="{by}" width="{bw}" height="14" rx="7" fill="none" stroke="#e2e8f0"/>')
A(f'<text x="{X+W//2}" y="{Y+H-24}" font-size="14" font-weight="700" text-anchor="middle" fill="#94a3b8">Click anywhere outside or press Esc to close</text>')
A('</svg>')
open('23_scoreboard-modal.svg','w').write('\n'.join(o))
