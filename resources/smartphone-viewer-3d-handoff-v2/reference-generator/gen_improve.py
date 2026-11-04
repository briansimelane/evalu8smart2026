import base64
TEAMS={1:'#10b981',2:'#3b82f6',3:'#1e293b',4:'#eab308',5:'#ef4444'}
def ink(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return '#0f172a' if (r*299+g*587+b*114)/1000>=135 else '#ffffff'
PACK='<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>'
FLASK='<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>'
TRUCK='<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
def glyph_box(cx,cy,size,fill,stroke,paths):
    s=size/24*0.62
    return (f'<rect x="{cx-size/2}" y="{cy-size/2}" width="{size}" height="{size}" rx="{size*.24}" fill="{fill}" stroke="{stroke}" stroke-width="3" filter="url(#soft)"/>'
            f'<rect x="{cx-size/2+6}" y="{cy-size/2+5}" width="{size-12}" height="{size*.28}" rx="{size*.14}" fill="#fff" opacity=".2"/>'
            f'<g transform="translate({cx-12*s*1.45:.1f},{cy-12*s*1.45:.1f}) scale({s*1.45:.3f})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{paths}</g>')
def price_box(cx,cy,size,sign):
    c='#10b981' if sign=='+' else '#ef4444'
    o=(f'<rect x="{cx-size/2}" y="{cy-size/2}" width="{size}" height="{size}" rx="{size*.24}" fill="#e11d2e" stroke="#9f1239" stroke-width="3" filter="url(#soft)"/>'
       f'<text x="{cx}" y="{cy+size*.17}" font-size="{size*.5}" font-weight="900" text-anchor="middle" fill="#fff">$</text>'
       f'<circle cx="{cx+size*.38}" cy="{cy+size*.38}" r="{size*.2}" fill="#0f172a" stroke="{c}" stroke-width="3"/>'
       f'<path d="M{cx+size*.38-size*.1},{cy+size*.38} h{size*.2}{"" if sign=="-" else f" M{cx+size*.38},{cy+size*.38-size*.1} v{size*.2}"}" stroke="{c}" stroke-width="3.5" stroke-linecap="round"/>')
    return o
def slot(kind,cx,cy,size=84):
    if kind=='Price Plus': return price_box(cx,cy,size,'+')
    if kind=='Product': return glyph_box(cx,cy,size,'#475569','#1e293b',PACK)
    if kind=='Research': return glyph_box(cx,cy,size,'#7c3aed','#5b21b6',FLASK)
    if kind=='Logistic': return glyph_box(cx,cy,size,'#06b6d4','#0891b2',TRUCK)
    if kind=='Price and Product':
        return price_box(cx-size*.44,cy,size*.68,'-')+glyph_box(cx+size*.44,cy,size*.68,'#475569','#1e293b',PACK)
LBL={'Price Plus':'Price +$1','Product':'+1 Product','Research':'+1 Research','Logistic':'+1 Logistics','Price and Product':'Price −$1, +1 Product'}
CARDS=[(5,'Price and Product','Product',2),(1,'Research','Research',4),(2,'Logistic','Price Plus',1),(3,'Research','Price Plus',None),(4,'Logistic','Research',None)]
bg=base64.b64encode(open('22_midgame-v11.png','rb').read()).decode()
o=[]; A=o.append
A('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Inter,Helvetica,Arial,sans-serif">')
A('''<defs><filter id="blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0b1226" flood-opacity=".45"/></filter>
<filter id="soft"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0b1226" flood-opacity=".25"/></filter>
<linearGradient id="hd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d97706"/><stop offset="1" stop-color="#facc15"/></linearGradient></defs>''')
A(f'<image href="data:image/png;base64,{bg}" width="1920" height="1080" filter="url(#blur)"/><rect width="1920" height="1080" fill="#0b1226" opacity=".55"/>')
X,Y,W,H=150,70,1620,940
A(f'<rect x="{X}" y="{Y}" width="{W}" height="{H}" rx="28" fill="#fff" filter="url(#sh)"/>')
A(f'<path d="M{X},{Y+28} a28,28 0 0 1 28,-28 h{W-56} a28,28 0 0 1 28,28 v82 h-{W} z" fill="url(#hd)"/>')
A(f'<text x="{X+44}" y="{Y+52}" font-size="13" font-weight="900" fill="#78350f" letter-spacing="3">CLASS: SMARTPHONE INC</text><text x="{X+44}" y="{Y+92}" font-size="38" font-weight="900" fill="#1c1917" letter-spacing="1">IMPROVEMENTS</text>')
A(f'<rect x="{X+400}" y="{Y+60}" width="132" height="34" rx="17" fill="#fff" fill-opacity=".45" stroke="#78350f" stroke-opacity=".5"/><text x="{X+466}" y="{Y+83}" font-size="15" font-weight="900" text-anchor="middle" fill="#1c1917" letter-spacing="1">ROUND 4</text>')
A(f'<text x="{X+570}" y="{Y+84}" font-size="16" font-weight="700" fill="#44250a">Teams claim one card each, in turn order</text>')
A(f'<circle cx="{X+W-52}" cy="{Y+58}" r="22" fill="#1c1917" fill-opacity=".18"/><path d="M{X+W-60},{Y+50} l16,16 M{X+W-44},{Y+50} l-16,16" stroke="#1c1917" stroke-width="3.5" stroke-linecap="round"/>')
# pool
px0=X+40; py0=Y+150
A(f'<text x="{px0}" y="{py0+4}" font-size="13" font-weight="900" fill="#94a3b8" letter-spacing="2">CARD POOL</text>')
CW,CH,G=172,520,16
for i,(cid,a,b,claimer) in enumerate(CARDS):
    x=px0+i*(CW+G); y=py0+20
    col=TEAMS[claimer] if claimer else '#10b981'
    A(f'<rect x="{x}" y="{y}" width="{CW}" height="{CH}" rx="20" fill="{"#f8fafc" if claimer else "#fff"}" stroke="{col}" stroke-width="{4 if claimer else 3}" {"" if claimer else "stroke-dasharray=\"0\""} filter="url(#soft)"/>')
    A(f'<text x="{x+CW/2}" y="{y+34}" font-size="13" font-weight="900" text-anchor="middle" fill="#94a3b8" letter-spacing="2">CARD {cid}</text>')
    op=.5 if claimer else 1
    A(f'<g opacity="{op}">')
    for k,kind in enumerate((a,b)):
        sy=y+60+k*168
        A(f'<rect x="{x+14}" y="{sy}" width="{CW-28}" height="152" rx="14" fill="#f1f5f9" stroke="#e2e8f0"/>')
        A(slot(kind,x+CW/2,sy+62,84 if kind!='Price and Product' else 80))
        A(f'<text x="{x+CW/2}" y="{sy+138}" font-size="{12 if kind=="Price and Product" else 15}" font-weight="900" text-anchor="middle" fill="#0f172a">{LBL[kind]}</text>')
    A('</g>')
    if claimer:
        A(f'<rect x="{x+10}" y="{y+CH-62}" width="{CW-20}" height="46" rx="12" fill="{col}"/><text x="{x+CW/2}" y="{y+CH-33}" font-size="14" font-weight="900" text-anchor="middle" fill="{ink(col)}">CLAIMED · TEAM {claimer}</text>')
    else:
        A(f'<rect x="{x+10}" y="{y+CH-62}" width="{CW-20}" height="46" rx="12" fill="#ecfdf5" stroke="#10b981" stroke-width="2.5"/><text x="{x+CW/2}" y="{y+CH-33}" font-size="16" font-weight="900" text-anchor="middle" fill="#047857">AVAILABLE</text>')
# turn order panel
tx=X+1000; ty=py0
A(f'<text x="{tx}" y="{ty+4}" font-size="13" font-weight="900" fill="#94a3b8" letter-spacing="2">TURN ORDER</text>')
ROWS=[(2,'done',1,'Card 5'),(4,'done',1,'Card 1'),(1,'done',1,'Card 2'),(5,'now',1,'Choosing now'),(3,'none',0,'No improvement points')]
for i,(t,st,pts,txt) in enumerate(ROWS):
    y=ty+20+i*100; col=TEAMS[t]; w=580
    act=st=='now'
    A(f'<rect x="{tx}" y="{y}" width="{w}" height="88" rx="16" fill="{"#fffbeb" if act else "#f8fafc"}" stroke="{"#f59e0b" if act else "#e2e8f0"}" stroke-width="{4 if act else 1.5}" {"filter=\"url(#soft)\"" if act else ""}/>')
    A(f'<text x="{tx+34}" y="{y+54}" font-size="26" font-weight="900" text-anchor="middle" fill="#94a3b8">{i+1}</text>')
    A(f'<rect x="{tx+66}" y="{y+24}" width="130" height="40" rx="12" fill="{col}" filter="url(#soft)"/><text x="{tx+131}" y="{y+51}" font-size="18" font-weight="900" text-anchor="middle" fill="{ink(col)}">Team {t}</text>')
    # points chip
    A(f'<rect x="{tx+212}" y="{y+26}" width="72" height="36" rx="10" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/><text x="{tx+248}" y="{y+52}" font-size="18" font-weight="900" text-anchor="middle" fill="{"#0f172a" if pts else "#cbd5e1"}">{pts} pt{"s" if pts!=1 else ""}</text>')
    if st=='done':
        A(f'<circle cx="{tx+316}" cy="{y+44}" r="14" fill="#10b981"/><path d="M{tx+309},{y+44} l5,5 l9,-10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="{tx+342}" y="{y+51}" font-size="17" font-weight="800" fill="#334155">Claimed {txt}</text>')
    elif act:
        A(f'<circle cx="{tx+316}" cy="{y+44}" r="14" fill="#f59e0b"/><circle cx="{tx+316}" cy="{y+44}" r="22" fill="none" stroke="#f59e0b" stroke-width="3" opacity=".45"/><text x="{tx+346}" y="{y+51}" font-size="17" font-weight="900" fill="#b45309">{txt}…</text>')
    else:
        A(f'<text x="{tx+300}" y="{y+51}" font-size="16" font-weight="700" font-style="italic" fill="#94a3b8">{txt}</text>')
# legend strip
ly=Y+H-150
A(f'<line x1="{X+36}" y1="{ly-14}" x2="{X+W-36}" y2="{ly-14}" stroke="#e2e8f0" stroke-width="2"/><text x="{X+44}" y="{ly+14}" font-size="13" font-weight="900" fill="#94a3b8" letter-spacing="2">WHAT THE ICONS DO</text>')
items=[('Price Plus','Price +$1'),('Price and Product','Price −$1 and +1 Product'),('Product','+1 Product'),('Research','+1 Research icon'),('Logistic','+1 Logistics icon')]
lx=X+44
for kind,txt in items:
    big=kind=='Price and Product'
    A(slot(kind,lx+(50 if big else 22),ly+66,40 if not big else 38))
    A(f'<text x="{lx+(96 if big else 54)}" y="{ly+72}" font-size="15" font-weight="800" fill="#334155">{txt}</text>')
    lx+= (96 if big else 54)+len(txt)*8.4+34
A('</svg>')
open('24_improvements-modal.svg','w').write('\n'.join(o))
