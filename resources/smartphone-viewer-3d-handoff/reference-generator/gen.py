import re, math, json, random
src=open('/home/claude/evalu8smart2026/src/data/customers.ts').read()
CUST={}
for m in re.finditer(r"region:\s*'([^']+)',\s*customers:\s*\[(.*?)\]\s*\}", src, re.S):
    L=[]
    for c in re.findall(r"\{[^}]*\}", m.group(2)):
        t=re.search(r"type:\s*'(\w+)'",c).group(1)
        p=re.search(r"price:\s*(\d+)",c); te=re.search(r"technology:\s*'([^']+)'",c)
        L.append((t, int(p.group(1)) if p else None, te.group(1) if te else None))
    CUST[m.group(1)]=L

POS={'Canada':(77,20),'USA':(40,210),'Caribbean':(77,400),'South America':(66,590),'Europe':(520,20),'Emirates':(600,210),'North Africa':(500,400),'RSA':(557,590),'CIS':(1026,20),'China':(1000,210),'India':(1026,400),'Australia':(1026,590)}
MAXT={'Canada':3,'Europe':5,'CIS':4,'USA':5,'Emirates':3,'China':5,'Caribbean':3,'North Africa':4,'India':4,'South America':4,'RSA':3,'Australia':4}
COST={'Canada':2,'Europe':4,'CIS':3,'USA':4,'Emirates':2,'China':4,'Caribbean':2,'North Africa':3,'India':3,'South America':3,'RSA':2,'Australia':3}
UNIT=80; LW=1520; LH=810; DS=1.12
RECT={}
for n,(l,t) in POS.items():
    w=max(280,len(CUST[n])*52+42)
    RECT[n]=((l+w/2-LW/2)/UNIT, ((t+82.5-LH/2)/UNIT)*DS, w/UNIT, 165/UNIT)
ROUTES=[('CIS','China',0),('China','India',0),('India','Australia',0),('RSA','Australia',0),('North Africa','Europe',0),('Emirates','RSA',.9),('India','Emirates',-.7),('Europe','CIS',0),('South America','RSA',0),('Caribbean','South America',0),('Caribbean','USA',0),('Canada','USA',0),('USA','Europe',.5),('USA','South America',.9),('North Africa','South America',-.5),('Emirates','North Africa',0),('North Africa','China',.8)]
TEAMS={1:'#10b981',2:'#3b82f6',3:'#1e293b',4:'#eab308',5:'#ef4444'}
def ink(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return '#0f172a' if (r*299+g*587+b*114)/1000>=135 else '#ffffff'
# mock game state (round 3, sales phase)
OFFICES={'North Africa':[1],'South America':[2],'Australia':[3],'India':[4],'CIS':[5],'USA':[2,3],'Europe':[1,4],'China':[5,4],'Canada':[1],'Emirates':[3],'RSA':[2],'Caribbean':[]}
INPROG={'Europe':[(5,.5)],'China':[(1,.66)],'Australia':[(2,.33)],'India':[(3,.5)]}
SOLD={('Canada',0):1,('USA',0):2,('USA',1):3,('USA',2):2,('Europe',0):1,('Europe',1):4,('CIS',0):5,('CIS',1):5,('China',0):4,('India',0):4,('India',1):4,('Australia',0):3,('Australia',1):3,('North Africa',0):1,('North Africa',1):1,('South America',0):2,('Emirates',0):3,('RSA',0):2,('Caribbean',0):2}
CONTROL={'USA':[(2,5),(3,3)],'Europe':[(1,4)],'CIS':[(5,3)],'India':[(4,3)],'Canada':[(1,2)],'Australia':[(3,3)],'South America':[(2,3)]}
PRICES={8:[],7:[],6:[],5:[2],4:[1,4,5],3:[3],2:[]}

PRESETS=json.load(open('presets.json'))

def render(P):
    cam=P['camera']; a=math.radians(cam['azimuth']*0.3); e=math.radians(cam['elevation']); pf=0.02 if cam['persp'] else 0
    I=P['island']; dep=I['depth']
    def pr(x,z,y=0):
        X=x*math.cos(a)-z*math.sin(a); Z=x*math.sin(a)+z*math.cos(a)
        q=1+Z*pf
        return (X*q, Z*math.sin(e)*q - y*math.cos(e)*q)
    # fit
    pts=[]
    for n,(cx,cz,w,d) in RECT.items():
        for sx in (-1,1):
            for sz in (-1,1):
                for y in (0,dep+P['sky']['h']):
                    pts.append(pr(cx+sx*w/2,cz+sz*d/2,y))
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    k=min(1480/(max(xs)-min(xs)),770/(max(ys)-min(ys)))
    ox=900-k*(max(xs)+min(xs))/2; oy=530-k*(max(ys)+min(ys))/2
    def S(x,z,y=0):
        px,py=pr(x,z,y); return (ox+px*k, oy+py*k)
    o=[]
    A=o.append
    A(f'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Inter,Helvetica,Arial,sans-serif">')
    A('<defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">'+''.join(f'<stop offset="{i/(len(P["bg"])-1)}" stop-color="{c}"/>' for i,c in enumerate(P['bg']))+'</linearGradient>')
    A('<filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.22"/></filter>')
    A('<filter id="glow"><feGaussianBlur stdDeviation="4"/></filter><filter id="soft" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.18"/></filter></defs>')
    A('<rect width="1920" height="1080" fill="url(#bg)"/>')
    g=P['ground']
    # ground
    gx0,gx1,gz0,gz1=-14,14,-8,8
    if g['kind'] in('plane','grid','wood','water'):
        poly=[S(gx0,gz0),S(gx1,gz0),S(gx1,gz1),S(gx0,gz1)]
        if g['kind']!='water':
            A(f'<polygon points="{" ".join(f"{x:.0f},{y:.0f}" for x,y in poly)}" fill="{g["color"]}" opacity="{0.0 if g["kind"]=="plane" and P.get("noplane") else 1}"/>')
    if g['kind']=='grid':
        for i in range(-14,15):
            p1=S(i,gz0);p2=S(i,gz1);A(f'<line x1="{p1[0]:.0f}" y1="{p1[1]:.0f}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" stroke="{g["line"]}" stroke-width="1" opacity=".7"/>')
        for j in range(-8,9):
            p1=S(gx0,j);p2=S(gx1,j);A(f'<line x1="{p1[0]:.0f}" y1="{p1[1]:.0f}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" stroke="{g["line"]}" stroke-width="1" opacity=".7"/>')
    if g['kind']=='wood':
        for j in range(-8,9):
            p1=S(gx0,j*1.0);p2=S(gx1,j*1.0);A(f'<line x1="{p1[0]:.0f}" y1="{p1[1]:.0f}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" stroke="{g["line"]}" stroke-width="3" opacity=".65"/>')
        random.seed(3)
        for _ in range(60):
            x=random.uniform(-13,13); z=random.uniform(-8,8); p1=S(x,z);p2=S(x+random.uniform(1,3),z+0.02)
            A(f'<line x1="{p1[0]:.0f}" y1="{p1[1]:.0f}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" stroke="#6b4426" stroke-width="1.5" opacity=".35"/>')
    if g['kind']=='water':
        for n,(cx,cz,w,d) in RECT.items():
            for r in (0.35,0.7,1.1):
                c=S(cx,cz); 
                A(f'<ellipse cx="{c[0]:.0f}" cy="{c[1]:.0f}" rx="{(w/2+r)*k*math.cos(a)*1.0:.0f}" ry="{(d/2+r)*k*math.sin(e):.0f}" fill="none" stroke="#ffffff" stroke-width="2" opacity="{0.45-r*0.25:.2f}"/>')
    # routes
    R=P['route']; dash=' stroke-dasharray="14 12"' if R['dashed'] else ''
    centers={n:(r[0],r[1]) for n,r in RECT.items()}
    paths=[]
    for (u,v,off) in ROUTES:
        (x1,z1),(x2,z2)=centers[u],centers[v]
        mx,mz=(x1+x2)/2,(z1+z2)/2; dx,dz=x2-x1,z2-z1; L=math.hypot(dx,dz) or 1
        cx_,cz_=mx-dz/L*off*2.2, mz+dx/L*off*2.2
        pts=[]
        for i in range(41):
            t=i/40
            x=(1-t)**2*x1+2*(1-t)*t*cx_+t*t*x2; z=(1-t)**2*z1+2*(1-t)*t*cz_+t*t*z2
            pts.append((x,z))
        paths.append(pts)
        d='M'+' L'.join(f'{S(x,z,0.03)[0]:.1f},{S(x,z,0.03)[1]:.1f}' for x,z in pts)
        if R['glow']: A(f'<path d="{d}" fill="none" stroke="{R["color"]}" stroke-width="{R["w"]*k*0.9:.0f}" opacity=".35" filter="url(#glow)"/>')
        A(f'<path d="{d}" fill="none" stroke="{R["color"]}" stroke-width="{R["w"]*k*0.55:.1f}" stroke-linecap="round"{dash}/>')
    # collect islands sorted back to front
    def inside(x,z,pad=0.15):
        for n,(cx,cz,w,d) in RECT.items():
            if abs(x-cx)<w/2+pad and abs(z-cz)<d/2+pad: return True
        return False
    # island drawing
    def poly(pts,fill,stroke='none',sw=0,op=1,extra=''):
        return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" opacity="{op}" {extra}/>'
    def box(cx,cz,w,d,y0,y1,top,side,front=None,stroke='none',sw=0,op=1):
        x0,x1_,z0,z1=cx-w/2,cx+w/2,cz-d/2,cz+d/2
        s=''
        # right side face (x1)
        if math.sin(a)>=0 or True:
            s+=poly([S(x1_,z0,y1),S(x1_,z1,y1),S(x1_,z1,y0),S(x1_,z0,y0)],side,stroke,sw,op)
        s+=poly([S(x0,z1,y1),S(x1_,z1,y1),S(x1_,z1,y0),S(x0,z1,y0)],front or side,stroke,sw,op)
        s+=poly([S(x0,z0,y1),S(x1_,z0,y1),S(x1_,z1,y1),S(x0,z1,y1)],top,stroke,sw,op)
        return s
    def shade(h,f):
        h=h.lstrip('#'); r,g_,b=[int(h[i:i+2],16) for i in (0,2,4)]
        return '#%02x%02x%02x'%tuple(max(0,min(255,int(c*f))) for c in (r,g_,b))
    rng=random.Random(5)
    order=sorted(RECT.items(), key=lambda kv: kv[1][1])
    carriers=[]
    for name,(cx,cz,w,d) in order:
        shadow = P['light']['shadows'] and I['mat'] not in('blueprint','glass')
        # shadow blob
        if shadow:
            p=[S(cx-w/2+.15,cz-d/2+.2,0),S(cx+w/2+.35,cz-d/2+.2,0),S(cx+w/2+.35,cz+d/2+.3,0),S(cx-w/2+.15,cz+d/2+.3,0)]
            A(poly(p,'#000000',op=0.16,extra='filter="url(#glow)"'))
        mat=I['mat']
        op=I.get('op',1)
        stroke=I['edge'] if mat in('blueprint','glass') else 'none'
        sw=2.5 if mat in('blueprint','glass') else 0
        side=I['side']; top=I['top']
        if mat=='blueprint':
            A(box(cx,cz,w,d,0,dep,top,side,side,stroke,sw,op))
        elif mat=='glass':
            A(box(cx,cz,w,d,0,dep,top,side,shade(side,.95),stroke,sw,op))
        else:
            A(box(cx,cz,w,d,0,dep*0.78,shade(side,1.0),shade(side,.88),shade(side,.95),'none',0,1))
            A(box(cx,cz,w+.02,d+.02,dep*0.78,dep,top,shade(top,.9),shade(top,.95),I['edge'] if I['edge'] else 'none',1.5,1))
        if I['round']>0.1:
            pass
        # skyline decor on front & back strips
        sk=P['sky']; n_=0
        if sk['kind']!='none':
            rr=random.Random(hash(name)%1000)
            slots=[]
            for i in range(int(w/0.55)):
                slots.append((cx-w/2+0.3+i*0.55+rr.uniform(-.05,.05), cz+d/2-0.2))
                pass
            slots.sort(key=lambda s:s[1])
            for (sx,sz) in slots:
                if rr.random()<0.35: continue
                col=rr.choice(sk['colors']); hh=rr.uniform(.35,1.0)*sk['h']
                y0=dep; kind=sk['kind']
                if kind=='city':
                    A(box(sx,sz,.34,.2,y0,y0+hh,shade(col,1.04),shade(col,.82),shade(col,.92)))
                elif kind=='voxel':
                    for j in range(max(1,int(hh/.18))):
                        A(box(sx,sz,.22,.2,y0+j*.18,y0+(j+1)*.18,shade(col,1.08),shade(col,.78),shade(col,.9)))
                elif kind=='houses':
                    A(box(sx,sz,.3,.2,y0,y0+hh*.6,shade(col,1.05),shade(col,.85),shade(col,.95)))
                    r0=S(sx-.17,sz+.1,y0+hh*.6);r1=S(sx+.17,sz+.1,y0+hh*.6);r2=S(sx,sz+.1,y0+hh*.6+.2)
                    A(poly([r0,r1,r2],'#e8546b'))
                elif kind=='trees':
                    b=S(sx,sz,y0); t=S(sx,sz,y0+hh)
                    A(f'<rect x="{b[0]-2:.0f}" y="{t[1]+hh*k*.35:.0f}" width="4" height="{hh*k*.4:.0f}" fill="#8b5a2b"/>')
                    for lv in range(3):
                        c1=S(sx,sz,y0+hh*(0.45+lv*.22)); wd=(.2-lv*.04)*k
                        A(poly([(c1[0]-wd,c1[1]+hh*k*.18),(c1[0]+wd,c1[1]+hh*k*.18),(c1[0],c1[1]-hh*k*.18)],shade(col,1+lv*.08)))
                elif kind=='pegs':
                    A(box(sx,sz,.14,.14,y0,y0+hh*.8,shade(col,1.1),shade(col,.8),shade(col,.95)))
        # --- info layer (chips) ---
        def chip_rect(x,y,w_,h_,fill,stroke='none',sw=0,rx=9,sh=True):
            return f'<rect x="{x-w_/2:.1f}" y="{y-h_/2:.1f}" width="{w_}" height="{h_}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {"filter=\"url(#soft)\"" if sh else ""}/>'
        tag=P['tag']
        tp=S(cx-w/2+.14,cz-d/2+.17,dep+.02)
        tw=40+len(name)*9.5
        A(f'<g><rect x="{tp[0]:.0f}" y="{tp[1]-15:.0f}" width="{tw:.0f}" height="30" rx="9" fill="{tag["bg"]}" stroke="{tag["border"]}" stroke-width="1.5" filter="url(#soft)"/>')
        A(f'<rect x="{tp[0]+4:.0f}" y="{tp[1]-11:.0f}" width="30" height="22" rx="6" fill="#e2e8f0"/><text x="{tp[0]+19:.0f}" y="{tp[1]+5:.0f}" font-size="14" font-weight="800" text-anchor="middle" fill="#0f172a">{COST[name]}</text>')
        A(f'<text x="{tp[0]+40:.0f}" y="{tp[1]+5:.0f}" font-size="15" font-weight="900" fill="{tag["fg"]}" letter-spacing=".5">{name.upper()}</text></g>')
        # offices
        mt=MAXT[name]; offs=OFFICES.get(name,[]); prog=INPROG.get(name,[])
        slots=[S(cx+w/2-.3-(mt-1-i)*.46, cz-d/2+.22, dep+.02) for i in range(mt)]
        items=[('o',t) for t in offs]+[('p',t) for t in prog]
        items=items[:mt]
        items+= [('e',None)]*(mt-len(items))
        for (kind,tt),sp in zip(items,slots):
            if kind=='o':
                col=TEAMS[tt]
                # tower
                bx=sp
                A(f'<rect x="{bx[0]-9:.0f}" y="{bx[1]-22:.0f}" width="18" height="26" rx="3" fill="{shade(col,.8)}" opacity=".9"/>')
                A(f'<circle cx="{sp[0]:.0f}" cy="{sp[1]-12:.0f}" r="15" fill="{col}" stroke="#fbbf24" stroke-width="3" filter="url(#soft)"/><text x="{sp[0]:.0f}" y="{sp[1]-7:.0f}" font-size="14" font-weight="900" text-anchor="middle" fill="{ink(col)}">{tt}</text>')
            elif kind=='p':
                col=TEAMS[tt[0]]; fr=tt[1]
                c=(sp[0],sp[1]-12)
                A(f'<circle cx="{c[0]:.0f}" cy="{c[1]:.0f}" r="14" fill="#e2e8f0" stroke="{col}" stroke-width="3"/>')
                ang=fr*2*math.pi; x2=c[0]+14*math.sin(ang); y2=c[1]-14*math.cos(ang); lg=1 if fr>.5 else 0
                A(f'<path d="M{c[0]:.0f},{c[1]:.0f} L{c[0]:.0f},{c[1]-14:.0f} A14,14 0 {lg} 1 {x2:.1f},{y2:.1f} Z" fill="{col}"/>')
            else:
                A(f'<circle cx="{sp[0]:.0f}" cy="{sp[1]-12:.0f}" r="13" fill="#ffffff" fill-opacity=".55" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/><text x="{sp[0]:.0f}" y="{sp[1]-7:.0f}" font-size="13" font-weight="900" text-anchor="middle" fill="#94a3b8">+</text>')
        # customers
        for i,(ct,cp,ctech) in enumerate(CUST[name]):
            p0=S(cx-w/2+.42+i*.65, cz+.3, dep)
            buyer=SOLD.get((name,i))
            lift=14 if buyer else 0
            # pedestal
            col='#dc2626' if ct=='price' else '#7c3aed'
            ped=shade(col,.75)
            A(f'<ellipse cx="{p0[0]:.0f}" cy="{p0[1]+4:.0f}" rx="22" ry="8" fill="{ped}" opacity=".85"/>')
            if buyer: A(f'<ellipse cx="{p0[0]:.0f}" cy="{p0[1]+4:.0f}" rx="24" ry="9" fill="none" stroke="{TEAMS[buyer]}" stroke-width="3"/>')
            cy=p0[1]-24-lift
            A(chip_rect(p0[0],cy,44,44,col,TEAMS[buyer] if buyer else shade(col,.75),3 if buyer else 1.5,11))
            lab=f'${cp}' if ct=='price' else {'GPS':'GPS','Wifi':'WiFi','Gaming':'GAME','Battery':'BAT','NFC':'NFC','4G':'4G'}.get(ctech,ctech)
            A(f'<text x="{p0[0]:.0f}" y="{cy+(6 if ct=="price" else 5):.0f}" font-size="{16 if ct=="price" else 12}" font-weight="900" text-anchor="middle" fill="#fff">{lab}</text>')
            if buyer:
                A(f'<circle cx="{p0[0]:.0f}" cy="{cy+27:.0f}" r="12" fill="{TEAMS[buyer]}" stroke="#fff" stroke-width="2.5"/><text x="{p0[0]:.0f}" y="{cy+32:.0f}" font-size="12" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[buyer])}">{buyer}</text>')
        for j,(tm,pts_) in enumerate(CONTROL.get(name,[])):
            cp_=S(cx+w/2+.02,cz-d/2-.02,dep+.1)
            r=17 if j==0 else 13
            A(f'<circle cx="{cp_[0]-j*36:.0f}" cy="{cp_[1]-2:.0f}" r="{r}" fill="{TEAMS[tm]}" stroke="{"#fbbf24" if j==0 else "#fff"}" stroke-width="{4 if j==0 else 2.5}" filter="url(#soft)"/><text x="{cp_[0]-j*36:.0f}" y="{cp_[1]+3:.0f}" font-size="{13 if j==0 else 11}" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[tm])}">{pts_}</text>')
        if name=='South America':
            sp=S(cx,cz+.3,dep+.2)
            A(f'<rect x="{sp[0]-w*k*0.45:.0f}" y="{sp[1]-17:.0f}" width="{w*k*0.9:.0f}" height="34" rx="9" fill="#dc2626" stroke="#fff" stroke-width="2" filter="url(#soft)"/><text x="{sp[0]-w*k*0.45+14:.0f}" y="{sp[1]+5:.0f}" font-size="14" font-weight="900" fill="#fff" letter-spacing="1">● BLOCKED</text><text x="{sp[0]+w*k*0.45-12:.0f}" y="{sp[1]+4:.0f}" font-size="11" font-weight="800" text-anchor="end" fill="#fecaca">5 Wildcards Needed</text>')
            A(poly([S(cx-w/2,cz-d/2,dep+.01),S(cx+w/2,cz-d/2,dep+.01),S(cx+w/2,cz+d/2,dep+.01),S(cx-w/2,cz+d/2,dep+.01)],'none','#dc2626',4,1))
    # wrap arrows
    def pill(x,y,txt):
        wd=26+len(txt)*7.4
        return f'<rect x="{x-wd/2:.0f}" y="{y-11:.0f}" width="{wd:.0f}" height="22" rx="11" fill="#0f172a" stroke="#cbd5e1"/><text x="{x:.0f}" y="{y+4:.0f}" font-size="11" font-weight="800" text-anchor="middle" fill="#fff" letter-spacing=".5">{txt}</text>'
    for (reg,off,lab) in [('Australia',0,'TO USA'),('Australia',.6,'TO CARIBBEAN'),('India',0,'TO CANADA'),('CIS',0,'TO CANADA')]:
        cx,cz,w,d=RECT[reg]; a1=S(cx+w/2,cz+off,dep*.6); a2=S(cx+w/2+.7,cz+off,dep*.6)
        A(f'<line x1="{a1[0]:.0f}" y1="{a1[1]:.0f}" x2="{a2[0]:.0f}" y2="{a2[1]:.0f}" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><polygon points="{a2[0]-4:.0f},{a2[1]-9:.0f} {a2[0]+12:.0f},{a2[1]:.0f} {a2[0]-4:.0f},{a2[1]+9:.0f}" fill="#0f172a"/>')
        A(pill((a1[0]+a2[0])/2+4,a1[1]-20,lab))
    for (reg,off,lab) in [('USA',0,'FROM AUSTRALIA'),('Caribbean',0,'FROM AUSTRALIA'),('Canada',.5,'FROM INDIA'),('Canada',-.5,'FROM CIS')]:
        cx,cz,w,d=RECT[reg]; a1=S(cx-w/2-.7,cz+off,dep*.6); a2=S(cx-w/2,cz+off,dep*.6)
        A(f'<line x1="{a1[0]:.0f}" y1="{a1[1]:.0f}" x2="{a2[0]:.0f}" y2="{a2[1]:.0f}" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><polygon points="{a2[0]-12:.0f},{a2[1]-9:.0f} {a2[0]+3:.0f},{a2[1]:.0f} {a2[0]-12:.0f},{a2[1]+9:.0f}" fill="#0f172a"/>')
        A(pill((a1[0]+a2[0])/2-6,a1[1]-20,lab))
    # carriers (placed in gaps)
    C=P['carrier']
    for idx,pts in enumerate(paths):
        gaps=[(x,z) for (x,z) in pts[4:-4] if not inside(x,z,.05)]
        if not gaps: continue
        for j in range(C['n']):
            x,z=gaps[min(len(gaps)-1,int((len(gaps)*(0.3+0.4*j+0.17*(idx%3)))%len(gaps)))]
            c=S(x,z,0.1); col=C['color']; ac=C['accent']
            kd=C['kind']
            if kd=='truck':
                A(f'<g transform="translate({c[0]:.0f},{c[1]:.0f})" filter="url(#soft)"><rect x="-22" y="-16" width="30" height="18" rx="3" fill="{ac}" stroke="{col}" stroke-width="2"/><rect x="8" y="-13" width="14" height="15" rx="3" fill="{col}"/><circle cx="-12" cy="4" r="4.5" fill="#1e293b"/><circle cx="14" cy="4" r="4.5" fill="#1e293b"/></g>')
            elif kd=='ship':
                A(f'<g transform="translate({c[0]:.0f},{c[1]:.0f})" filter="url(#soft)"><polygon points="-26,-6 26,-6 18,8 -20,8" fill="{col}" stroke="#94a3b8"/><rect x="-10" y="-18" width="16" height="12" fill="{ac}"/><rect x="-4" y="-26" width="6" height="8" fill="#94a3b8"/></g>')
            elif kd=='train':
                A(f'<g transform="translate({c[0]:.0f},{c[1]:.0f})" filter="url(#soft)"><rect x="-26" y="-12" width="22" height="14" rx="3" fill="{col}"/><rect x="-2" y="-12" width="22" height="14" rx="3" fill="{ac}"/><circle cx="-18" cy="4" r="3.5" fill="#222"/><circle cx="12" cy="4" r="3.5" fill="#222"/></g>')
            elif kd=='drone':
                A(f'<g transform="translate({c[0]:.0f},{c[1]-26:.0f})"><ellipse cx="0" cy="34" rx="12" ry="4" fill="#000" opacity=".25"/><rect x="-9" y="-5" width="18" height="10" rx="4" fill="{col}"/><line x1="-18" y1="-7" x2="-4" y2="-4" stroke="{ac}" stroke-width="3"/><line x1="18" y1="-7" x2="4" y2="-4" stroke="{ac}" stroke-width="3"/><circle cx="0" cy="0" r="18" fill="none" stroke="{col}" stroke-width="1" opacity=".5"/></g>')
            else:
                A(f'<circle cx="{c[0]:.0f}" cy="{c[1]-4:.0f}" r="9" fill="{col}" stroke="{ac}" stroke-width="3"/>')
    # sparkles
    if P['ambient']!='none':
        rr=random.Random(9)
        for _ in range(70):
            A(f'<circle cx="{rr.uniform(150,1650):.0f}" cy="{rr.uniform(130,920):.0f}" r="{rr.uniform(1,3.2):.1f}" fill="{P["spark"]}" opacity="{rr.uniform(.3,.9):.2f}"/>')
    # ---------- HUD panels ----------
    pa=P['panel']
    def panel(x,y,w,h,r=0):
        return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="#ffffff" fill-opacity="{pa}" />'
    A(panel(0,0,1920,120)); A('<line x1="0" y1="120" x2="1920" y2="120" stroke="#cbd5e1"/>')
    A('<text x="26" y="46" font-size="12" font-weight="900" fill="#64748b" letter-spacing="1.5">CLASS: SMARTPHONE INC</text><text x="26" y="86" font-size="34" font-weight="900" fill="#0f172a">ROUND 3</text>')
    A('<text x="215" y="62" font-size="12" font-weight="900" fill="#475569" letter-spacing="1.5">TURN ORDER:</text>')
    for i,t in enumerate([2,4,1,5,3]):
        x=330+i*112
        A(f'<rect x="{x}" y="46" width="102" height="30" rx="8" fill="{TEAMS[t]}"/><text x="{x+51}" y="66" font-size="12" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{i+1}. Team {t}</text>')
    ph=['PLANNING','PRODUCTION','IMPROVEMENTS','RESEARCH','LOGISTICS','SALES','CONTROL','SCORING']
    x=895
    for i,t in enumerate(ph):
        wd=22+len(t)*7.6+36
        act=(i==5); 
        A(f'<rect x="{x}" y="42" width="{wd:.0f}" height="40" rx="12" fill="{"#f5f3ff" if act else "#ffffff"}" stroke="{"#7c3aed" if act else "#cbd5e1"}" stroke-width="{2.5 if act else 1}" opacity="{1 if i>=5 else .5}"/><circle cx="{x+20}" cy="62" r="9" fill="{"#7c3aed" if act else "#94a3b8"}"/><text x="{x+36}" y="67" font-size="12" font-weight="900" fill="#0f172a" letter-spacing="1">{i+1}. {t}</text>')
        x+=wd+6
    # unsold chips
    A(f'<rect x="640" y="96" width="330" height="34" rx="10" fill="#fff" stroke="#94a3b8" stroke-width="1.5" filter="url(#soft)"/><text x="654" y="118" font-size="11" font-weight="900" fill="#475569" letter-spacing="1">UNSOLD PRODUCTS:</text>')
    for i,t in enumerate([1,2,3,4,5]):
        A(f'<rect x="{800+i*34}" y="101" width="30" height="24" rx="7" fill="{TEAMS[t]}"/><text x="{815+i*34}" y="118" font-size="12" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{t}:{[1,0,2,1,0][i]}</text>')
    # left ladder
    A(panel(0,120,140,810)); A('<text x="70" y="155" font-size="17" font-weight="900" text-anchor="middle" fill="#0f172a" letter-spacing="2">PRICE</text><line x1="16" y1="168" x2="124" y2="168" stroke="#94a3b8" stroke-width="2"/>')
    for i,pv in enumerate([8,7,6,5,4,3,2]):
        y=225+i*90
        A(f'<rect x="20" y="{y-22}" width="44" height="44" rx="11" fill="#dc2626" filter="url(#soft)"/><text x="42" y="{y+7}" font-size="18" font-weight="900" text-anchor="middle" fill="#fff">${pv}</text>')
        for j,t in enumerate(PRICES[pv]):
            A(f'<circle cx="{86+(j%2)*26}" cy="{y-10+(j//2)*26}" r="12" fill="{TEAMS[t]}" stroke="#fff" stroke-width="2"/><text x="{86+(j%2)*26}" y="{y-6+(j//2)*26}" font-size="11" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{t}</text>')
        if i<6: A(f'<line x1="16" y1="{y+45}" x2="124" y2="{y+45}" stroke="#cbd5e1"/>')
    # right panel
    A(panel(1660,120,260,810)); A('<text x="1678" y="158" font-size="10" font-weight="900" fill="#64748b" letter-spacing="1.5">MARKETPLACE</text><text x="1678" y="186" font-size="20" font-weight="900" fill="#0f172a">IMPROVEMENTS</text>')
    for i,(i1,i2) in enumerate([('Research','Price+'),('Logistic','Research'),('Price&Prod','Product')]):
        y=215+i*74
        A(f'<rect x="1678" y="{y}" width="224" height="62" rx="12" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/><circle cx="1712" cy="{y+31}" r="16" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/><circle cx="1760" cy="{y+31}" r="16" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><text x="1832" y="{y+36}" font-size="12" font-weight="800" fill="#475569" text-anchor="middle">{"AVAILABLE" if i<2 else "Team 2"}</text>')
    # bottom tech
    A(panel(0,930,1920,150)); A('<line x1="0" y1="930" x2="1920" y2="930" stroke="#cbd5e1"/><text x="26" y="978" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">RESEARCH &amp; DEVELOPMENT</text><text x="26" y="1010" font-size="25" font-weight="900" fill="#0f172a">TECHNOLOGIES</text><text x="26" y="1032" font-size="12" font-style="italic" font-weight="700" fill="#64748b">Patents &amp; Team Progress</text>')
    for i,(tn,pt) in enumerate([('GPS',6),('WIFI',6),('GAMING',8),('BATTERY',8),('NFC',10),('4G',12)]):
        x=285+i*266
        A(f'<rect x="{x}" y="944" width="250" height="122" rx="12" fill="#fff" stroke="#94a3b8" stroke-width="2"/><text x="{x+14}" y="974" font-size="14" font-weight="900" fill="#0f172a">{tn}</text><rect x="{x+16+len(tn)*11}" y="962" width="44" height="18" rx="4" fill="#fffbeb" stroke="#fde68a"/><text x="{x+38+len(tn)*11}" y="975" font-size="10" font-weight="900" text-anchor="middle" fill="#b45309">{pt} pts</text>')
        for t in range(1,6):
            full=(t+i)%3==0
            c=(x+26+(t-1)*34,1022)
            if full: A(f'<circle cx="{c[0]}" cy="{c[1]}" r="13" fill="{TEAMS[t]}" stroke="#fff" stroke-width="2"/><text x="{c[0]}" y="{c[1]+5}" font-size="13" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">✓</text>')
            else:
                A(f'<circle cx="{c[0]}" cy="{c[1]}" r="13" fill="#e2e8f0" stroke="{TEAMS[t]}" stroke-width="3"/>')
                A(f'<path d="M{c[0]},{c[1]} L{c[0]},{c[1]-13} A13,13 0 0 1 {c[0]+13},{c[1]} Z" fill="{TEAMS[t]}"/>')
    # label
    A(f'<rect x="1660" y="940" width="0" height="0"/>')
    A('</svg>')
    return '\n'.join(o)

import sys
for P in PRESETS:
    svg=render(P)
    open(f"{P['n']:02d}_{P['id']}.svg",'w').write(svg)
    print('wrote',P['id'],len(svg))
