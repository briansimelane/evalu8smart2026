import math, random
src=open('gen.py').read().split("PRESETS=json")[0]
exec(src)  # CUST, POS, MAXT, COST, RECT, ROUTES, TEAMS, ink, OFFICES, INPROG, SOLD, CONTROL, PRICES

def shade(h,f):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16) for i in (0,2,4)]
    return '#%02x%02x%02x'%tuple(max(0,min(255,int(c*f))) for c in (r,g,b))
def poly(pts,fill,stroke='none',sw=0,op=1,extra=''):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" opacity="{op}" {extra}/>'

# ---------- landmarks: (x,y)=base centre on screen, s=height px ----------
def tree(x,y,s,c='#2f8f4e'):
    r=s*0.34
    return (f'<rect x="{x-s*.04:.1f}" y="{y-s*.35:.1f}" width="{s*.08:.1f}" height="{s*.35:.1f}" fill="#6b4a2b"/>'
            f'<circle cx="{x:.1f}" cy="{y-s*.55:.1f}" r="{r:.1f}" fill="{shade(c,.82)}"/>'
            f'<circle cx="{x-r*.35:.1f}" cy="{y-s*.62:.1f}" r="{r*.8:.1f}" fill="{c}"/>'
            f'<circle cx="{x-r*.45:.1f}" cy="{y-s*.7:.1f}" r="{r*.38:.1f}" fill="{shade(c,1.25)}"/>')
def pine(x,y,s,c='#2c7a4b'):
    o=f'<rect x="{x-s*.03:.1f}" y="{y-s*.2:.1f}" width="{s*.06:.1f}" height="{s*.2:.1f}" fill="#6b4a2b"/>'
    for i in range(3):
        w=s*(.34-i*.07); yy=y-s*.15-i*s*.26
        o+=poly([(x-w,yy),(x+w,yy),(x,yy-s*.42)],shade(c,1+i*.12))
    return o
def palm(x,y,s):
    o=f'<path d="M{x:.1f},{y:.1f} Q{x+s*.12:.1f},{y-s*.5:.1f} {x+s*.05:.1f},{y-s:.1f}" stroke="#a9794a" stroke-width="{s*.07:.1f}" fill="none" stroke-linecap="round"/>'
    tx,ty=x+s*.05,y-s
    for ang in (-150,-110,-70,-30,10,40):
        a=math.radians(ang); o+=f'<path d="M{tx:.1f},{ty:.1f} q{math.cos(a)*s*.35:.1f},{math.sin(a)*s*.2-s*.12:.1f} {math.cos(a)*s*.5:.1f},{math.sin(a)*s*.3+s*.1:.1f}" stroke="#2e9b57" stroke-width="{s*.09:.1f}" fill="none" stroke-linecap="round"/>'
    return o
def bldg(x,y,w,h,c='#cfd9ee'):
    o=poly([(x-w/2,y),(x+w/2,y),(x+w/2,y-h),(x-w/2,y-h)],c)
    o+=poly([(x+w/2,y),(x+w/2+w*.28,y-w*.12),(x+w/2+w*.28,y-h-w*.12),(x+w/2,y-h)],shade(c,.8))
    o+=poly([(x-w/2,y-h),(x+w/2,y-h),(x+w/2+w*.28,y-h-w*.12),(x-w/2+w*.28,y-h-w*.12)],shade(c,1.08))
    for r in range(int(h//9)):
        for cc in range(max(1,int(w//8))):
            o+=f'<rect x="{x-w/2+3+cc*8:.1f}" y="{y-h+4+r*9:.1f}" width="4" height="5" fill="#8fb4e8" opacity=".75"/>'
    return o
def lm_canada(x,y,s):
    o=poly([(x-s*.9,y),(x-s*.45,y-s*.55),(x-s*.15,y)],'#9db4cf')+poly([(x-s*.45,y-s*.55),(x-s*.33,y-s*.37),(x-s*.45,y-s*.4),(x-s*.57,y-s*.37)],'#ffffff')
    o+=poly([(x+s*.2,y),(x+s*.75,y-s*.5),(x+s*1.0,y)],'#8aa5c4')+poly([(x+s*.75,y-s*.5),(x+s*.64,y-s*.35),(x+s*.75,y-s*.38),(x+s*.86,y-s*.35)],'#fff')
    o+=poly([(x-s*.09,y),(x+s*.09,y),(x+s*.02,y-s*.75),(x-s*.02,y-s*.75)],'#cfd6e0')
    o+=f'<rect x="{x-s*.02:.1f}" y="{y-s*1.15:.1f}" width="{s*.04:.1f}" height="{s*.4:.1f}" fill="#b9c3d2"/><ellipse cx="{x:.1f}" cy="{y-s*.82:.1f}" rx="{s*.17:.1f}" ry="{s*.07:.1f}" fill="#e6ebf2" stroke="#9aa6b8"/>'
    o+=pine(x-s*.55,y+2,s*.5)+pine(x+s*.5,y+2,s*.55)
    return o
def lm_usa(x,y,s):
    o=bldg(x-s*.75,y,s*.28,s*.45)+bldg(x-s*.55,y,s*.22,s*.7,'#dbe4f4')+bldg(x+s*.55,y,s*.26,s*.6)+bldg(x+s*.78,y,s*.22,s*.4,'#e3ebf8')
    o+=poly([(x-s*.16,y),(x+s*.16,y),(x+s*.12,y-s*.2),(x-s*.12,y-s*.2)],'#c7ccd6')
    o+=poly([(x-s*.11,y-s*.2),(x+s*.11,y-s*.2),(x+s*.15,y-s*.55),(x-s*.05,y-s*.6)],'#7fcfba')
    o+=f'<circle cx="{x-s*.02:.1f}" cy="{y-s*.66:.1f}" r="{s*.07:.1f}" fill="#8fe0cb"/>'
    for a in (-60,-30,0,30,60): o+=f'<line x1="{x-s*.02:.1f}" y1="{y-s*.7:.1f}" x2="{x-s*.02+math.sin(math.radians(a))*s*.13:.1f}" y2="{y-s*.7-math.cos(math.radians(a))*s*.12:.1f}" stroke="#7fcfba" stroke-width="2"/>'
    o+=f'<path d="M{x+s*.08:.1f},{y-s*.5:.1f} L{x+s*.2:.1f},{y-s*.8:.1f}" stroke="#7fcfba" stroke-width="{s*.06:.1f}" stroke-linecap="round"/><ellipse cx="{x+s*.2:.1f}" cy="{y-s*.88:.1f}" rx="{s*.05:.1f}" ry="{s*.08:.1f}" fill="#ffd34d"/>'
    o+=tree(x-s*.95,y+2,s*.4)+tree(x+s*1.0,y+2,s*.42)
    return o
def lm_carib(x,y,s):
    o=f'<ellipse cx="{x:.1f}" cy="{y-s*.1:.1f}" rx="{s*1.1:.1f}" ry="{s*.34:.1f}" fill="#35c4e8"/><ellipse cx="{x:.1f}" cy="{y-s*.12:.1f}" rx="{s*.9:.1f}" ry="{s*.24:.1f}" fill="#6fe0f2" opacity=".7"/>'
    o+=palm(x-s*.9,y+4,s*.9)+palm(x+s*.95,y+6,s*.8)+palm(x+s*.7,y+2,s*.6)
    o+=poly([(x-s*.15,y-s*.1),(x+s*.2,y-s*.1),(x+s*.12,y-s*.02),(x-s*.1,y-s*.02)],'#fff')+poly([(x,y-s*.12),(x,y-s*.5),(x+s*.2,y-s*.14)],'#ff6b6b')
    return o
def lm_sam(x,y,s):
    o=f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{s*.9:.1f}" ry="{s*.25:.1f}" fill="#5fae52"/>'
    o+=poly([(x-s*.7,y),(x-s*.15,y-s*.65),(x+s*.15,y-s*.65),(x+s*.8,y)],'#4d9c47')
    o+=poly([(x-s*.08,y-s*.64),(x+s*.08,y-s*.64),(x+s*.06,y-s*.92),(x-s*.06,y-s*.92)],'#f4f1ea')
    o+=poly([(x-s*.3,y-s*.84),(x+s*.3,y-s*.84),(x+s*.3,y-s*.77),(x-s*.3,y-s*.77)],'#f4f1ea')+f'<circle cx="{x:.1f}" cy="{y-s*.97:.1f}" r="{s*.05:.1f}" fill="#f4f1ea"/>'
    o+=tree(x-s*.9,y+3,s*.45)+tree(x+s*.95,y+3,s*.45)
    return o
def lm_europe(x,y,s):
    o=bldg(x-s*.95,y,s*.3,s*.35,'#e8dcc8')+bldg(x+s*.9,y,s*.3,s*.4,'#e8dcc8')+bldg(x+s*.62,y,s*.22,s*.28,'#dfcfb5')
    c='#7d6a58'
    o+=poly([(x-s*.28,y),(x-s*.2,y),(x-s*.05,y-s*.45),(x-s*.02,y-s*.45)],c)+poly([(x+s*.28,y),(x+s*.2,y),(x+s*.05,y-s*.45),(x+s*.02,y-s*.45)],c)
    o+=poly([(x-s*.2,y-s*.28),(x+s*.2,y-s*.28),(x+s*.18,y-s*.22),(x-s*.18,y-s*.22)],shade(c,1.2))
    o+=poly([(x-s*.05,y-s*.45),(x+s*.05,y-s*.45),(x+s*.012,y-s*1.1),(x-s*.012,y-s*1.1)],c)
    o+=poly([(x-s*.09,y-s*.45),(x+s*.09,y-s*.45),(x+s*.09,y-s*.41),(x-s*.09,y-s*.41)],shade(c,1.2))
    o+=tree(x-s*.55,y+2,s*.38)+tree(x+s*.4,y+2,s*.36)
    return o
def lm_emirates(x,y,s):
    o=bldg(x-s*.75,y,s*.24,s*.55,'#cfe3f6')+bldg(x-s*.5,y,s*.2,s*.8,'#dbeafb')+bldg(x+s*.55,y,s*.22,s*.7,'#cfe3f6')+bldg(x+s*.8,y,s*.2,s*.5,'#dbeafb')
    o+=poly([(x-s*.16,y),(x+s*.16,y),(x+s*.12,y-s*.45),(x-s*.12,y-s*.45)],'#bcd4ee')+poly([(x-s*.12,y-s*.45),(x+s*.12,y-s*.45),(x+s*.08,y-s*.8),(x-s*.08,y-s*.8)],'#cfe3f6')
    o+=poly([(x-s*.08,y-s*.8),(x+s*.08,y-s*.8),(x+s*.04,y-s*1.05),(x-s*.04,y-s*1.05)],'#dbeafb')+f'<line x1="{x:.1f}" y1="{y-s*1.05:.1f}" x2="{x:.1f}" y2="{y-s*1.3:.1f}" stroke="#9fb3c9" stroke-width="2"/>'
    o+=palm(x-s*.95,y+3,s*.5)
    return o
def lm_nafrica(x,y,s):
    o=poly([(x-s*.9,y),(x-s*.3,y-s*.55),(x+s*.2,y)],'#e8c88a')+poly([(x-s*.3,y-s*.55),(x+s*.2,y),(x-s*.05,y)],'#c9a566')
    o+=poly([(x+s*.0,y),(x+s*.45,y-s*.38),(x+s*.85,y)],'#e8c88a')+poly([(x+s*.45,y-s*.38),(x+s*.85,y),(x+s*.65,y)],'#c9a566')
    o+=f'<rect x="{x-s*1.1:.1f}" y="{y-s*.42:.1f}" width="{s*.12:.1f}" height="{s*.42:.1f}" fill="#f4ecd8"/><polygon points="{x-s*1.1:.1f},{y-s*.42:.1f} {x-s*.98:.1f},{y-s*.42:.1f} {x-s*1.04:.1f},{y-s*.58:.1f}" fill="#2e9b8a"/>'
    o+=palm(x+s*.95,y+3,s*.8)+palm(x-s*.55,y+4,s*.55)
    return o
def lm_rsa(x,y,s):
    o=poly([(x-s*1.0,y),(x-s*.75,y-s*.5),(x-s*.5,y-s*.72),(x+s*.6,y-s*.72),(x+s*.85,y-s*.45),(x+s*1.05,y)],'#8c8f98')
    o+=poly([(x-s*.5,y-s*.72),(x+s*.6,y-s*.72),(x+s*.85,y-s*.45),(x-s*.75,y-s*.5)],'#a8abb4')
    o+=poly([(x-s*1.0,y),(x-s*.75,y-s*.5),(x-s*.5,y-s*.05)],'#5fae52',op=.9)+poly([(x+s*1.05,y),(x+s*.85,y-s*.45),(x+s*.55,y-s*.05)],'#5fae52',op=.9)
    o+=bldg(x-s*.3,y,s*.2,s*.3)+bldg(x+s*.1,y,s*.22,s*.4,'#dbe4f4')+bldg(x+s*.4,y,s*.18,s*.25)
    return o
def lm_cis(x,y,s):
    o=bldg(x-s*.95,y,s*.3,s*.35,'#f1d9d9')+bldg(x+s*.9,y,s*.3,s*.35,'#f1d9d9')
    o+=f'<rect x="{x-s*.5:.1f}" y="{y-s*.4:.1f}" width="{s*1.0:.1f}" height="{s*.4:.1f}" fill="#b8472f"/>'
    cols=['#d63a3a','#2e9b57','#f2b632','#3a6fd6','#d63a3a']
    for i,(dx,h,r) in enumerate([(-.38,.5,.12),(.38,.5,.12),(-.18,.62,.13),(.18,.62,.13),(0,.95,.17)]):
        cx_=x+s*dx; base=y-s*.4
        o+=f'<rect x="{cx_-r*s*.7:.1f}" y="{base-s*h*.55:.1f}" width="{r*s*1.4:.1f}" height="{s*h*.55:.1f}" fill="{shade(cols[i],.85)}"/>'
        o+=f'<path d="M{cx_-r*s:.1f},{base-s*h*.55:.1f} Q{cx_-r*s*1.2:.1f},{base-s*h*.9:.1f} {cx_:.1f},{base-s*h*1.2:.1f} Q{cx_+r*s*1.2:.1f},{base-s*h*.9:.1f} {cx_+r*s:.1f},{base-s*h*.55:.1f} Z" fill="{cols[i]}"/>'
        o+=f'<circle cx="{cx_:.1f}" cy="{base-s*h*1.22:.1f}" r="2.5" fill="#ffd34d"/>'
    return o
def lm_china(x,y,s):
    o=bldg(x-s*.9,y,s*.24,s*.6,'#e6edf9')+bldg(x-s*.65,y,s*.2,s*.85,'#d6e1f5')+bldg(x+s*.75,y,s*.22,s*.7,'#e6edf9')
    for i in range(5):
        w=s*(.34-i*.05); yy=y-i*s*.2
        o+=poly([(x-w*1.2,yy-s*.06),(x+w*1.2,yy-s*.06),(x+w*.9,yy-s*.2),(x-w*.9,yy-s*.2)],'#c8372d')
        o+=f'<rect x="{x-w*.7:.1f}" y="{yy-s*.06:.1f}" width="{w*1.4:.1f}" height="{s*.08:.1f}" fill="#f2c14e"/>'
    o+=f'<line x1="{x:.1f}" y1="{y-s*1.0:.1f}" x2="{x:.1f}" y2="{y-s*1.2:.1f}" stroke="#f2c14e" stroke-width="3"/>'
    o+=tree(x+s*.45,y+2,s*.4,'#3da66a')
    return o
def lm_india(x,y,s):
    o=f'<rect x="{x-s*.75:.1f}" y="{y-s*.16:.1f}" width="{s*1.5:.1f}" height="{s*.16:.1f}" fill="#efe9de"/>'
    o+=f'<rect x="{x-s*.4:.1f}" y="{y-s*.5:.1f}" width="{s*.8:.1f}" height="{s*.34:.1f}" fill="#fbf7ef"/>'
    o+=f'<path d="M{x-s*.28:.1f},{y-s*.5:.1f} Q{x-s*.32:.1f},{y-s*.95:.1f} {x:.1f},{y-s*1.0:.1f} Q{x+s*.32:.1f},{y-s*.95:.1f} {x+s*.28:.1f},{y-s*.5:.1f} Z" fill="#ffffff" stroke="#e5ddcc"/>'
    o+=f'<line x1="{x:.1f}" y1="{y-s*1.0:.1f}" x2="{x:.1f}" y2="{y-s*1.15:.1f}" stroke="#d9b45a" stroke-width="2"/>'
    for dx in (-.62,.62):
        o+=f'<rect x="{x+s*dx-s*.05:.1f}" y="{y-s*.75:.1f}" width="{s*.1:.1f}" height="{s*.6:.1f}" fill="#fbf7ef" stroke="#e5ddcc"/><circle cx="{x+s*dx:.1f}" cy="{y-s*.78:.1f}" r="{s*.07:.1f}" fill="#fff" stroke="#e5ddcc"/>'
    for dx in (-.2,.2): o+=f'<path d="M{x+s*dx-s*.07:.1f},{y-s*.16:.1f} v{-s*.14:.1f} q{s*.07:.1f},{-s*.1:.1f} {s*.14:.1f},0 v{s*.14:.1f} z" fill="#c9d4ea"/>'
    o+=tree(x-s*.95,y+2,s*.45)+tree(x+s*.95,y+2,s*.45)
    return o
def lm_aus(x,y,s):
    o=f'<ellipse cx="{x:.1f}" cy="{y-s*.05:.1f}" rx="{s*1.1:.1f}" ry="{s*.3:.1f}" fill="#3ab6ea"/><ellipse cx="{x+s*.2:.1f}" cy="{y-s*.1:.1f}" rx="{s*.9:.1f}" ry="{s*.2:.1f}" fill="#7fd9f5" opacity=".7"/>'
    o+=poly([(x-s*.6,y),(x+s*.6,y),(x+s*.6,y-s*.08),(x-s*.6,y-s*.08)],'#efe6d4')
    for i,(dx,r,h) in enumerate([(-.38,.3,.55),(-.12,.34,.7),(.14,.3,.58),(.36,.22,.4)]):
        o+=f'<path d="M{x+s*dx-s*r:.1f},{y-s*.08:.1f} Q{x+s*dx-s*r*.9:.1f},{y-s*h:.1f} {x+s*dx+s*r*.5:.1f},{y-s*h*.95:.1f} Q{x+s*dx+s*r*.6:.1f},{y-s*h*.35:.1f} {x+s*dx+s*r:.1f},{y-s*.08:.1f} Z" fill="#ffffff" stroke="#d6dde9"/>'
    o+=bldg(x-s*.95,y,s*.22,s*.4,'#dbe4f4')+tree(x+s*.95,y+2,s*.4)
    return o
LM={'Canada':lm_canada,'USA':lm_usa,'Caribbean':lm_carib,'South America':lm_sam,'Europe':lm_europe,'Emirates':lm_emirates,'North Africa':lm_nafrica,'RSA':lm_rsa,'CIS':lm_cis,'China':lm_china,'India':lm_india,'Australia':lm_aus}
EXTRA_TREES={'Canada':[.35],'USA':[],'Caribbean':[],'South America':[.5],'Europe':[.2,.8],'Emirates':[.2],'North Africa':[],'RSA':[.15,.85],'CIS':[.12,.9],'China':[.18,.88],'India':[],'Australia':[.12]}

OFFICES={'North Africa':[1,2],'South America':[2,5],'Australia':[3,2],'India':[4,3],'CIS':[5,1],'USA':[2,3,4],'Europe':[1,4,3],'China':[5,4,2],'Canada':[1,5],'Emirates':[3,1],'RSA':[2],'Caribbean':[4]}
INPROG={'Europe':[(5,.5)],'China':[(1,.66)],'Australia':[(1,.33)],'India':[(5,.5)],'North Africa':[(4,.25)],'Canada':[(3,.5)]}
SOLD={('Canada',0):1,('Canada',1):5,('Canada',2):1,('USA',0):2,('USA',1):3,('USA',2):2,('USA',3):4,('USA',4):4,('USA',5):3,('Europe',0):1,('Europe',1):4,('Europe',2):4,('Europe',3):1,('CIS',0):5,('CIS',1):5,('CIS',2):1,('China',0):4,('China',1):5,('China',2):4,('India',0):4,('India',1):4,('India',2):3,('Australia',0):3,('Australia',1):3,('Australia',2):2,('North Africa',0):1,('North Africa',1):1,('South America',0):2,('South America',1):5,('South America',2):2,('Emirates',0):3,('Emirates',1):1,('RSA',0):2,('RSA',1):2,('Caribbean',0):2,('Caribbean',1):4}
CONTROL={'USA':[(2,5),(3,3)],'Europe':[(1,4),(4,2)],'CIS':[(5,3)],'India':[(4,3)],'Canada':[(1,2)],'Australia':[(3,3)],'South America':[(2,3)],'China':[(5,4)],'North Africa':[(1,3)],'Emirates':[(3,2)]}
TS={'GPS':{'owner':1,'done':[1,2],'prog':{3:1,5:1}},
    'WIFI':{'owner':1,'done':[1,3],'prog':{2:1}},
    'GAMING':{'owner':4,'done':[4],'prog':{1:2,5:1}},
    'BATTERY':{'owner':None,'done':[],'prog':{2:3,5:1}},
    'NFC':{'owner':None,'done':[],'prog':{4:2}},
    '4G':{'owner':None,'done':[],'prog':{}}}
def render():
    e=math.radians(50)
    # fit
    pts=[]
    for n,(cx,cz,w,d) in RECT.items():
        for sx in (-1,1):
            for sz in (-1,1):
                for y in (0,1.55): pts.append((cx+sx*w/2,(cz+sz*d/2)*math.sin(e)-y*math.cos(e)))
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    k=min(1510/(max(xs)-min(xs)),765/(max(ys)-min(ys)))
    ox=1020-k*(max(xs)+min(xs))/2; oy=548-k*(max(ys)+min(ys))/2
    def S(x,z,y=0): return (ox+x*k, oy+(z*math.sin(e)-y*math.cos(e))*k)
    o=[]; A=o.append
    A('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Inter,Helvetica,Arial,sans-serif">')
    A('''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#eef3fb"/><stop offset=".5" stop-color="#e4ecf8"/><stop offset="1" stop-color="#dbe6f4"/></linearGradient>
<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd06a"/><stop offset="1" stop-color="#5faa45"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f9"/><stop offset=".35" stop-color="#c9d3e6"/><stop offset="1" stop-color="#8d9bb8"/></linearGradient>
<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9eef8"/></linearGradient>
<linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a66"/><stop offset="1" stop-color="#141c38"/></linearGradient>
<filter id="drop" x="-20%" y="-20%" width="140%" height="170%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#1e2c52" flood-opacity=".28"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#0f172a" flood-opacity=".25"/></filter>
<filter id="blur"><feGaussianBlur stdDeviation="9"/></filter></defs>''')
    A('<rect width="1920" height="1080" fill="url(#bg)"/>')
    # ghost tiles in background (hex outlines)
    rr=random.Random(4)
    for i in range(34):
        gx=rr.uniform(-9.5,10); gz=rr.uniform(-5,5); c=S(gx,gz,0)
        w=rr.uniform(1.2,2.4)*k; h=w*0.42
        A(poly([(c[0]-w/2,c[1]),(c[0]-w*.35,c[1]-h/2),(c[0]+w*.35,c[1]-h/2),(c[0]+w/2,c[1]),(c[0]+w*.35,c[1]+h/2),(c[0]-w*.35,c[1]+h/2)],'#f6f9fe',stroke='#d9e3f3',sw=2,op=.75))

    def geom(name):
        cx,cz,w,d=RECT[name]
        W=w*k; D=d*math.sin(e)*k*0.72; thick=0.52*math.cos(e)*k+10
        cxs=S(cx,cz,0.5)[0]; cys=S(cx,cz,0.5)[1]
        return dict(cx=cx,W=W,D=D,thick=thick,cxs=cxs,cys=cys,x0=cxs-W/2,x1=cxs+W/2,y0=cys-D/2,y1=cys+D/2)
    G={n:geom(n) for n in RECT}
    _bot=max(g['cys'] for g in G.values())
    for g in G.values():
        sh=-(_bot-g['cys'])*0.06   # spread rows upward: more room above each plate for its landmark
        g['cys']+=sh; g['y0']+=sh; g['y1']+=sh
    def pt(name,side,wx=None,fy=0.55):
        g=G[name]
        if side=='t': return ((ox+wx*k) if wx is not None else g['cxs'], g['y0']+4), (0,-1)
        if side=='b': return ((ox+wx*k) if wx is not None else g['cxs'], g['y1']+g['thick']*0.45), (0,1)
        if side=='l': return (g['x0'], g['y0']+g['D']*0.3+ (g['y1']-g['y0'])*0.4*fy), (-1,0)
        return (g['x1'], g['y0']+g['D']*0.3+ (g['y1']-g['y0'])*0.4*fy), (1,0)
    # (from, side, wx, fy), (to, side, wx, fy) -- taken from the classic RegionLayer connector list
    def X(name,off=0): return RECT[name][0]+off
    def SX(a,b,side=28): return (max(G[a]['x0'],G[b]['x0'])+side-ox)/k
    LINKS=[
     (('Canada','b',SX('Canada','USA')),('USA','t',SX('Canada','USA'))),
     (('USA','b',SX('USA','Caribbean')),('Caribbean','t',SX('USA','Caribbean'))),
     (('Caribbean','b',SX('Caribbean','South America')),('South America','t',SX('Caribbean','South America'))),
     (('USA','t',RECT['USA'][0]+RECT['USA'][2]*0.34),('Europe','l',None,0.0)),
     (('USA','b',RECT['USA'][0]+RECT['USA'][2]*0.3),('South America','r',None,0.0)),
     (('North Africa','l',None,0.2),('South America','r',None,0.9)),
     (('Europe','b',RECT['North Africa'][0]-RECT['North Africa'][2]*0.42),('North Africa','t',RECT['North Africa'][0]-RECT['North Africa'][2]*0.42)),
     (('Europe','r',None,0.5),('CIS','l',None,0.5)),
     (('Emirates','b',(min(G['Emirates']['x1'],G['North Africa']['x1'])-48-ox)/k),('North Africa','t',(min(G['Emirates']['x1'],G['North Africa']['x1'])-48-ox)/k)),
     (('North Africa','r',None,0.4),('China','l',None,0.5)),
     (('Emirates','r',None,0.4),('India','l',None,0.5)),
     (('Emirates','r',None,1.0),('RSA','r',None,0.5)),
     (('CIS','b',SX('CIS','China')),('China','t',SX('CIS','China'))),
     (('China','b',SX('China','India')),('India','t',SX('China','India'))),
     (('India','b',SX('India','Australia')),('Australia','t',SX('India','Australia'))),
     (('RSA','r',None,0.5),('Australia','l',None,0.5)),
     (('South America','r',None,0.5),('RSA','l',None,0.5)),
    ]
    def bez(p0,n0,p1,n1):
        dist=math.hypot(p1[0]-p0[0],p1[1]-p0[1]); h=max(30,dist*0.38)
        c0=(p0[0]+n0[0]*h,p0[1]+n0[1]*h); c1=(p1[0]+n1[0]*h,p1[1]+n1[1]*h)
        return [((1-t)**3*p0[0]+3*(1-t)**2*t*c0[0]+3*(1-t)*t*t*c1[0]+t**3*p1[0],(1-t)**3*p0[1]+3*(1-t)**2*t*c0[1]+3*(1-t)*t*t*c1[1]+t**3*p1[1]) for t in [i/60 for i in range(61)]]
    ports=[]; roadpts=[]; CN=[]; _A0=A; A=CN.append
    for L in LINKS:
        (n0,s0,wx0,*f0),(n1,s1,wx1,*f1)=L
        p0,v0=pt(n0,s0,wx0,(f0[0] if f0 else .55)); p1,v1=pt(n1,s1,wx1,(f1[0] if f1 else .55))
        pp=bez(p0,v0,p1,v1); roadpts.append((pp,p0,p1))
        d='M'+' L'.join(f'{a:.1f},{b:.1f}' for a,b in pp)
        A(f'<path d="{d}" fill="none" stroke="#0b1226" stroke-width="12" stroke-linecap="round" opacity=".35" transform="translate(0,6)" filter="url(#blur)"/>')
        A(f'<path d="{d}" fill="none" stroke="#1b2748" stroke-width="10" stroke-linecap="round"/><path d="{d}" fill="none" stroke="#5a6fa8" stroke-width="2" stroke-linecap="round" opacity=".8" transform="translate(0,-2.5)"/>')
        ports+= [p0,p1]
    A=_A0
    def inside_any(x,y):
        for n,g in G.items():
            if g['x0']-6<x<g['x1']+6 and g['y0']-12<y<g['y1']+g['thick']+6: return True
        return False
    def truck(x,y,ang):
        return (f'<g transform="translate({x:.1f},{y:.1f}) rotate({ang:.1f})" filter="url(#soft)">'
                '<rect x="-24" y="-17" width="30" height="19" rx="3" fill="#ffffff" stroke="#2f5bff" stroke-width="2"/><rect x="-24" y="-9" width="30" height="4" fill="#2f5bff"/>'
                '<path d="M8,-13 h10 l6,7 v8 h-16 z" fill="#2f5bff"/><rect x="11" y="-10" width="7" height="5" rx="1" fill="#cfe0ff"/>'
                '<circle cx="-14" cy="4" r="4.6" fill="#1e293b"/><circle cx="14" cy="4" r="4.6" fill="#1e293b"/></g>')
    ICO={'GPS':'<path d="M0,-8 a6,6 0 0 1 6,6 c0,5 -6,10 -6,10 c0,0 -6,-5 -6,-10 a6,6 0 0 1 6,-6z" fill="none" stroke="#7c3aed" stroke-width="2"/><circle cx="0" cy="-2" r="2" fill="none" stroke="#7c3aed" stroke-width="2"/>',
     'WIFI':'<path d="M-8,-2 a11,11 0 0 1 16,0 M-5,2 a7,7 0 0 1 10,0" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="6" r="1.6" fill="#7c3aed"/>',
     'GAMING':'<rect x="-9" y="-5" width="18" height="11" rx="5" fill="none" stroke="#7c3aed" stroke-width="2"/><path d="M-4,-1v4M-6,1h4" stroke="#7c3aed" stroke-width="1.6"/><circle cx="4" cy="0" r="1.2" fill="#7c3aed"/>',
     'BATTERY':'<rect x="-9" y="-4" width="16" height="9" rx="2" fill="none" stroke="#7c3aed" stroke-width="2"/><path d="M9,-1v3" stroke="#7c3aed" stroke-width="2"/>',
     'NFC':'<circle cx="0" cy="0" r="2" fill="#7c3aed"/><path d="M-5,-5 a7,7 0 0 0 0,10 M5,-5 a7,7 0 0 1 0,10 M-8,-8 a11,11 0 0 0 0,16 M8,-8 a11,11 0 0 1 0,16" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linecap="round"/>',
     '4G':'<path d="M-8,8v-3M-3,8v-6M2,8v-9M7,8v-12" stroke="#7c3aed" stroke-width="2.4" stroke-linecap="round"/>'}
    PL=[]; _A=A
    order=sorted(RECT.items(), key=lambda kv: kv[1][1])
    for name,(cx,cz,w,d) in order:
        A=_A
        g_=G[name]; W=g_['W']; D=g_['D']; thick=g_['thick']; cxs=g_['cxs']; cys=g_['cys']
        ch=0.55*k  # chamfer
        x0,x1_=cxs-W/2,cxs+W/2; y0,y1=cys-D/2,cys+D/2
        top=[(x0+ch,y0),(x1_-ch,y0),(x1_,y0+D*.35),(x1_,y1),(x0,y1),(x0,y0+D*.35)]
        # shadow
        A(poly([(a,b+thick+14) for a,b in top],'#223a6b',op=.28,extra='filter="url(#blur)"'))
        # side (stone) : extrude down
        side=[top[5],top[4],(x0,y1+thick),(x1_,y1+thick),top[3],top[2]]
        A(poly([(x0,y0+D*.35),(x0,y1+thick),(x1_,y1+thick),(x1_,y0+D*.35)],'url(#stone)',stroke='#aeb9d1',sw=1.5,extra='filter="url(#drop)"'))
        # lip highlight + grass
        A(poly(top,'#f5f8fd',stroke='#d3dcef',sw=2))
        inset=7
        gtop=[(a+(inset if a<cxs else -inset), b+(inset if b<cys else -inset)*0.8) for a,b in top]
        A(poly(gtop,'url(#grass)'))
        # paved front band
        A(poly([(x0+6,y1-D*.3),(x1_-6,y1-D*.3),(x1_-6,y1-6),(x0+6,y1-6)],'#e8edf6',op=.9))
        A(f'<clipPath id="cl_{name.replace(" ","")}"><rect x="{x0-2:.1f}" y="{y0-190:.1f}" width="{W+4:.1f}" height="{190+D:.1f}"/></clipPath><g clip-path="url(#cl_{name.replace(" ","")})">')
        # decor trees behind landmark
        rr2=random.Random(len(name)*7)
        for fr in EXTRA_TREES.get(name,[]):
            (pine if name in('Canada','CIS') else tree)(0,0,1)
            A((pine if name in('Canada','CIS') else tree)(x0+W*fr, y0+D*.5, 36))
        for i in range(4):
            tx=x0+W*([0.07,0.15,0.86,0.94][i]) + rr2.uniform(-5,5); ty=y0+D*rr2.uniform(.05,.3)
            if True: A(tree(tx,ty,rr2.uniform(20,27),rr2.choice(['#2f8f4e','#3da66a','#2a7f45'])))
        # landmark
        A(LM[name](cxs, y0+D*.12, 80))
        A('</g>')
        A=PL.append
        # --- glossy info plate ---
        n=len(CUST[name]); pw=max(n*46+30, 316); ph=88
        px=cxs-pw/2; py=y1-ph+22
        A(f'<rect x="{px:.1f}" y="{py:.1f}" width="{pw}" height="{ph}" rx="16" fill="url(#plate)" stroke="#cfd8ea" stroke-width="2" filter="url(#drop)"/>')
        A(f'<rect x="{px+6:.1f}" y="{py+4:.1f}" width="{pw-12}" height="{ph*.42:.0f}" rx="12" fill="#ffffff" opacity=".7"/>')
        # title row
        A(f'<rect x="{px+8:.1f}" y="{py+3:.1f}" width="80" height="34" rx="10" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/>')
        A(f'<rect x="{px+11:.1f}" y="{py+6:.1f}" width="28" height="28" rx="7" fill="#06b6d4" stroke="#0891b2" stroke-width="1.5"/>')
        A(f'<g transform="translate({px+14.5:.1f},{py+9.5:.1f}) scale(.88)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></g>')
        A(f'<text x="{px+65:.1f}" y="{py+28:.1f}" font-size="21" font-weight="900" fill="#0f172a" text-anchor="middle">{COST[name]}</text>')
        A(f'<text x="{px+100:.1f}" y="{py+26:.1f}" font-size="{12 if len(name)>11 else (14.5 if len(name)>9 else 17)}" font-weight="900" fill="#0f172a" letter-spacing=".2">{name.upper()}</text>')
        # offices
        mt=MAXT[name]; items=[('o',t) for t in OFFICES.get(name,[])]+[('p',t) for t in INPROG.get(name,[])]
        items=items[:mt]; items+=[('e',None)]*(mt-len(items))
        for i,(kd,tt) in enumerate(items):
            ox_=px+pw-17-(mt-1-i)*25; oy_=py+19
            if kd=='o':
                c=TEAMS[tt]; A(f'<circle cx="{ox_:.1f}" cy="{oy_}" r="11" fill="{c}" stroke="#fbbf24" stroke-width="2.5"/><text x="{ox_:.1f}" y="{oy_+4}" font-size="11" font-weight="900" text-anchor="middle" fill="{ink(c)}">{tt}</text>')
            elif kd=='p':
                c=TEAMS[tt[0]]; fr=tt[1]; ang=fr*2*math.pi; x2=ox_+11*math.sin(ang); y2=oy_-11*math.cos(ang); lg=1 if fr>.5 else 0
                A(f'<circle cx="{ox_:.1f}" cy="{oy_}" r="11" fill="#fff" stroke="{c}" stroke-width="2.5"/><path d="M{ox_:.1f},{oy_} L{ox_:.1f},{oy_-11} A11,11 0 {lg} 1 {x2:.1f},{y2:.1f} Z" fill="{c}"/>')
            else:
                A(f'<circle cx="{ox_:.1f}" cy="{oy_}" r="10" fill="#fff" stroke="#c3cbe0" stroke-width="2" stroke-dasharray="3 3"/>')
        # customers
        for i,(ct,cp,ctech) in enumerate(CUST[name]):
            ccx=px+13+19+i*46; ccy=py+58
            col='#e11d2e' if ct=='price' else '#7c3aed'
            buyer=SOLD.get((name,i))
            A(f'<rect x="{ccx-18:.1f}" y="{ccy-18}" width="36" height="36" rx="10" fill="{col}" stroke="{TEAMS[buyer] if buyer else shade(col,.8)}" stroke-width="{3.5 if buyer else 1.5}" filter="url(#soft)"/>')
            A(f'<rect x="{ccx-15:.1f}" y="{ccy-16}" width="30" height="12" rx="6" fill="#fff" opacity=".22"/>')
            if ct=='price':
                A(f'<text x="{ccx:.1f}" y="{ccy+6}" font-size="15" font-weight="900" text-anchor="middle" fill="#fff">${cp}</text>')
            else:
                A(f'<g transform="translate({ccx:.1f},{ccy}) scale(1.2)">{ICO[ctech.upper()].replace("#7c3aed","#fff")}</g>')
            if buyer:
                c=TEAMS[buyer]; A(f'<circle cx="{ccx:.1f}" cy="{ccy+18}" r="9.5" fill="{c}" stroke="#fff" stroke-width="2"/><text x="{ccx:.1f}" y="{ccy+22}" font-size="10" font-weight="900" text-anchor="middle" fill="{ink(c)}">{buyer}</text>')
        # control badges
        for j,(tm,pts_) in enumerate(CONTROL.get(name,[])):
            c=TEAMS[tm]; bx=px+pw+4-j*30; by=py-10
            A(f'<circle cx="{bx:.1f}" cy="{by}" r="{16 if j==0 else 12}" fill="{c}" stroke="{"#fbbf24" if j==0 else "#fff"}" stroke-width="{4 if j==0 else 2.5}" filter="url(#soft)"/><text x="{bx:.1f}" y="{by+4.5}" font-size="{13 if j==0 else 11}" font-weight="900" text-anchor="middle" fill="{ink(c)}">{pts_}</text>')
    A=_A
    for _p in CN: A(_p)
    for _p in PL: A(_p)
    # ---------- HUD ----------
    pa=0.92
    def panel(x,y,w,h): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" fill-opacity="{pa}"/>'
    A(panel(0,0,1920,120)); A('<line x1="0" y1="120" x2="1920" y2="120" stroke="#cdd6e8"/>')
    A('<text x="26" y="46" font-size="12" font-weight="900" fill="#64748b" letter-spacing="1.5">CLASS: SMARTPHONE INC</text><text x="26" y="86" font-size="34" font-weight="900" fill="#0f172a">ROUND 6</text>')
    A('<text x="215" y="62" font-size="12" font-weight="900" fill="#475569" letter-spacing="1.5">TURN ORDER:</text>')
    for i,t in enumerate([2,4,1,5,3]):
        x=330+i*100
        A(f'<rect x="{x}" y="46" width="94" height="30" rx="8" fill="{TEAMS[t]}"/><text x="{x+47}" y="66" font-size="12" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{i+1}. Team {t}</text>')
    ph_=[('PLANNING','#2563eb'),('PRODUCTION','#0f172a'),('IMPROVEMENTS','#eab308'),('RESEARCH','#7c3aed'),('LOGISTICS','#06b6d4'),('SALES','#059669'),('CONTROL','#4f46e5'),('SCORING','#f59e0b')]
    ACTIVE=5; x=850
    for i,(t,pc) in enumerate(ph_):
        wd=62+len(t)*7.3+(16 if i==ACTIVE else 0)
        st='active' if i==ACTIVE else ('past' if i<ACTIVE else 'future')
        if st=='active':
            A(f'<rect x="{x}" y="38" width="{wd:.0f}" height="48" rx="14" fill="#ffffff" stroke="{pc}" stroke-width="3" filter="url(#soft)"/>')
            A(f'<rect x="{x+8}" y="46" width="32" height="32" rx="9" fill="{pc}"/><text x="{x+24}" y="68" font-size="16" font-weight="900" text-anchor="middle" fill="{"#0f172a" if pc in("#eab308","#facc15") else "#fff"}">{i+1}</text>')
            A(f'<text x="{x+50}" y="67" font-size="12" font-weight="900" fill="#0f172a" letter-spacing=".8">{t}</text>')
        elif st=='past':
            A(f'<rect x="{x}" y="42" width="{wd:.0f}" height="40" rx="12" fill="{pc}" fill-opacity=".10" stroke="{pc}" stroke-opacity=".35" stroke-width="1.5"/>')
            A(f'<circle cx="{x+24}" cy="62" r="12" fill="{pc}" opacity=".85"/><path d="M{x+18},{62} l4.5,4.5 l8,-9" fill="none" stroke="{"#0f172a" if pc in("#eab308","#facc15") else "#fff"}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>')
            A(f'<text x="{x+44}" y="66.5" font-size="11" font-weight="800" fill="#475569" letter-spacing=".6">{t}</text>')
        else:
            A(f'<rect x="{x}" y="42" width="{wd:.0f}" height="40" rx="12" fill="#ffffff" fill-opacity=".7" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="1 0"/>')
            A(f'<circle cx="{x+24}" cy="62" r="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/><text x="{x+24}" y="66.5" font-size="12" font-weight="900" text-anchor="middle" fill="#94a3b8">{i+1}</text>')
            A(f'<text x="{x+44}" y="66.5" font-size="11" font-weight="800" fill="#94a3b8" letter-spacing=".6">{t}</text>')
        x+=wd+9
    A(f'<rect x="640" y="96" width="330" height="34" rx="10" fill="#fff" stroke="#94a3b8" stroke-width="1.5" filter="url(#soft)"/><text x="654" y="118" font-size="11" font-weight="900" fill="#475569" letter-spacing="1">UNSOLD PRODUCTS:</text>')
    for i,t in enumerate([1,2,3,4,5]):
        A(f'<rect x="{800+i*34}" y="101" width="30" height="24" rx="7" fill="{TEAMS[t]}"/><text x="{815+i*34}" y="118" font-size="12" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{t}:{[1,0,2,1,0][i]}</text>')
    A(panel(0,120,140,810)); A('<text x="70" y="155" font-size="17" font-weight="900" text-anchor="middle" fill="#0f172a" letter-spacing="2">PRICE</text><line x1="16" y1="168" x2="124" y2="168" stroke="#94a3b8" stroke-width="2"/>')
    for i,pv in enumerate([8,7,6,5,4,3,2]):
        y=225+i*90
        A(f'<rect x="20" y="{y-22}" width="44" height="44" rx="11" fill="#e11d2e" filter="url(#soft)"/><text x="42" y="{y+7}" font-size="18" font-weight="900" text-anchor="middle" fill="#fff">${pv}</text>')
        for j,t in enumerate(PRICES[pv]):
            A(f'<circle cx="{86+(j%2)*26}" cy="{y-10+(j//2)*26}" r="12" fill="{TEAMS[t]}" stroke="#fff" stroke-width="2"/><text x="{86+(j%2)*26}" y="{y-6+(j//2)*26}" font-size="11" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[t])}">{t}</text>')
        if i<6: A(f'<line x1="16" y1="{y+45}" x2="124" y2="{y+45}" stroke="#cbd5e1"/>')
    A(panel(0,930,1920,150)); A('<line x1="0" y1="930" x2="1920" y2="930" stroke="#cdd6e8"/><text x="26" y="978" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">RESEARCH &amp; DEVELOPMENT</text><text x="26" y="1010" font-size="25" font-weight="900" fill="#0f172a">TECHNOLOGIES</text><text x="26" y="1032" font-size="12" font-style="italic" font-weight="700" fill="#64748b">Patents &amp; Team Progress</text>')
    import math as _m
    SP={'GPS':3,'WIFI':3,'GAMING':4,'BATTERY':4,'NFC':5,'4G':6}
    for i,(tn,pt) in enumerate([('GPS',6),('WIFI',6),('GAMING',8),('BATTERY',8),('NFC',10),('4G',12)]):
        x=285+i*266
        A(f'<rect x="{x}" y="944" width="250" height="122" rx="12" fill="#fff" stroke="#9aa8c4" stroke-width="2"/>')
        A(f'<g transform="translate({x+24},968)">{ICO[tn]}</g><text x="{x+44}" y="974" font-size="14" font-weight="900" fill="#0f172a">{tn}</text>')
        cx0=x+46+len(tn)*10
        A(f'<rect x="{cx0}" y="961" width="56" height="20" rx="5" fill="#fffbeb" stroke="#fde68a"/><path d="M{cx0+8},966 h8 v4 a4,4 0 0 1 -8,0z M{cx0+12},975 v2 M{cx0+9},977 h6" fill="#f59e0b" stroke="#d97706" stroke-width="1.2"/><text x="{cx0+37}" y="975" font-size="10" font-weight="900" text-anchor="middle" fill="#b45309">{pt} pts</text>')
        ow=TS[tn]['owner']
        if ow:
            A(f'<rect x="{x+176}" y="960" width="60" height="22" rx="11" fill="{TEAMS[ow]}" stroke="#fbbf24" stroke-width="2"/><text x="{x+206}" y="975" font-size="10" font-weight="900" text-anchor="middle" fill="{ink(TEAMS[ow])}" letter-spacing=".4">TEAM {ow}</text>')
        else:
            A(f'<text x="{x+236}" y="972" font-size="9" font-weight="800" text-anchor="end" fill="#94a3b8" letter-spacing=".8">AVAILABLE</text>')
        A(f'<line x1="{x+14}" y1="988" x2="{x+236}" y2="988" stroke="#e2e8f0" stroke-width="1.5"/>')
        for t in range(1,6):
            cx=x+30+(t-1)*38; cy=1027; r=15; col=TEAMS[t]
            info=TS[tn]; ow=info['owner']; n=SP[tn]-(1 if ow else 0)
            if t in info['done']:
                A(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}" stroke="{"#fbbf24" if t==ow else "#fff"}" stroke-width="{3 if t==ow else 2}" filter="url(#soft)"/><path d="M{cx-6},{cy} l4,4.5 l8,-9" fill="none" stroke="{ink(col)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
            else:
                kfill=info['prog'].get(t,0)
                A(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{col}" stroke-width="2.4"/>')
                for kk in range(kfill):
                    a0=-_m.pi/2+2*_m.pi*kk/n; a1=-_m.pi/2+2*_m.pi*(kk+1)/n
                    A(f'<path d="M{cx},{cy} L{cx+r*_m.cos(a0):.1f},{cy+r*_m.sin(a0):.1f} A{r},{r} 0 0 1 {cx+r*_m.cos(a1):.1f},{cy+r*_m.sin(a1):.1f} Z" fill="{col}"/>')
                sp=''
                for kk in range(n):
                    a0=-_m.pi/2+2*_m.pi*kk/n
                    sp+=f'M{cx},{cy} L{cx+_m.cos(a0)*(r-1):.1f},{cy+_m.sin(a0)*(r-1):.1f} '
                A(f'<path d="{sp}" stroke="{"#fff" if kfill>0 else col}" stroke-width="1.8" fill="none" opacity=".9"/>')
    # wrap arrows: each arrow gets its own lane; labels sit above the line, left-aligned to the arrow start
    def lane(reg,off,side,label,incoming):
        cx,cz,w,d=RECT[reg]; g=G[reg]
        yy=g['y0']+g['D']*0.5+off          # screen y of this lane
        if side=='r':
            x1=g['x1']+4; x2=x1+92
            A(f'<line x1="{x1:.0f}" y1="{yy:.0f}" x2="{x2:.0f}" y2="{yy:.0f}" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><polygon points="{x2-4:.0f},{yy-9:.0f} {x2+13:.0f},{yy:.0f} {x2-4:.0f},{yy+9:.0f}" fill="#0f172a"/>')
            px=x1+6
        else:
            x2=g['x0']-2; x1=x2-92
            A(f'<line x1="{x1:.0f}" y1="{yy:.0f}" x2="{x2:.0f}" y2="{yy:.0f}" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/><polygon points="{x2-13:.0f},{yy-9:.0f} {x2+4:.0f},{yy:.0f} {x2-13:.0f},{yy+9:.0f}" fill="#0f172a"/>')
            px=x1-2
        wd=22+len(label)*7.0
        A(f'<rect x="{px:.0f}" y="{yy-34:.0f}" width="{wd:.0f}" height="22" rx="7" fill="#0f172a"/><text x="{px+wd/2:.0f}" y="{yy-19:.0f}" font-size="11" font-weight="900" text-anchor="middle" fill="#fff" letter-spacing=".5">{label}</text>')
    # right edge exits (lanes spaced >= 62px)
    lane('CIS',0,'r','TO CANADA →',False)
    lane('India',0,'r','TO CANADA →',False)
    lane('Australia',-14,'r','TO USA →',False)
    lane('Australia',50,'r','TO CARIBBEAN →',False)
    # left edge entries
    lane('Canada',-24,'l','FROM CIS →',True)
    lane('Canada',44,'l','FROM INDIA →',True)
    lane('USA',0,'l','FROM AUSTRALIA →',True)
    lane('Caribbean',0,'l','FROM AUSTRALIA →',True)
    import json as _j
    LAY={'stage':{'w':1920,'h':1080},'camera':{'type':'orthographic','elevationDeg':50,'note':'screen = (ox + x*k, oy + (z*sin(e) - y*cos(e))*k)','k':k,'ox':ox,'oy':oy},
     'hud':{'topBar':[0,0,1920,120],'priceLadder':[0,120,140,810],'techStrip':[0,930,1920,150]},'regions':{},'connectors':[]}
    for nm,g in G.items():
        n_=len(CUST[nm]); pw_=max(n_*46+30,316); cxs_=g['cxs']
        LAY['regions'][nm]={'island':{'x0':round(g['x0'],1),'x1':round(g['x1'],1),'y0':round(g['y0'],1),'y1':round(g['y1'],1),'sideThickness':round(g['thick'],1)},
          'plate':{'x':round(cxs_-pw_/2,1),'y':round(g['y1']-88+22,1),'w':pw_,'h':88},'logisticsCost':COST[nm],'maxTeams':MAXT[nm],'customerSlots':n_,
          'landmarkAnchor':{'x':round(cxs_,1),'y':round(g['y0']+g['D']*.12,1),'scale':80}}
    for L,(pp,p0,p1) in zip(LINKS,roadpts):
        LAY['connectors'].append({'from':L[0][0],'to':L[1][0],'start':[round(p0[0],1),round(p0[1],1)],'end':[round(p1[0],1),round(p1[1],1)],'path':[[round(a,1),round(b,1)] for a,b in pp[::4]]})
    open('layout.json','w').write(_j.dumps(LAY,indent=1))
    A('</svg>')
    return '\n'.join(o)
open('22_midgame-v11.svg','w').write(render())
