#!/usr/bin/env python3
"""Deterministic, original BetVima affiliate campaign artwork.

Images use BetVima's EXISTING licensed/in-repository marketing assets and
composited app-phone representations. They do not copy 1win image assets.
Only visual assets are generated. Backend, commissions and user data stay
untouched. Pillow is required: pip install Pillow.
"""
from pathlib import Path
from math import sin, cos, pi
import random
import sys
try:
    from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter
except ImportError:
    sys.exit("Install Pillow before generating affiliate artwork")

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets/affiliate"
ASSETS.mkdir(parents=True, exist_ok=True)
random.seed(198)
NEON=(39,216,177)
BLUE=(54,104,255)
WHITE=(236,243,253)
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size):
    try:return ImageFont.truetype(FONT,size)
    except:return ImageFont.load_default()

def src(name):
    path=ASSETS/(name+".webp")
    if not path.exists():return None
    try:return Image.open(path).convert("RGBA")
    except Exception:return None

def panel(w,h,base=(8,15,35),hue=BLUE):
    out=Image.new("RGBA",(w,h),(5,10,25,255))
    pix=out.load()
    for y in range(h):
        for x in range(w):
            t=(x/max(1,w-1))*.22+(y/max(1,h-1))*.75
            glow=max(0,1-((x-w*.86)**2/(w*.79)**2 + (y-h*.25)**2/(h*.90)**2))
            pix[x,y]=tuple(max(0,min(255,int(base[i]*(1-t)+ (18 if i==2 else 6)*t+hue[i]*glow*.13))) for i in range(3))+(255,)
    d=ImageDraw.Draw(out,"RGBA")
    for k in range(-2,9):
        x=int(w*k/6)
        d.line((x,-h//3,x+w//3,h),fill=(*hue,23),width=2)
    for k in range(11):
        x=int(w*(k+1)/12)
        y=int(h*(.15+.085*sin(k*1.15)))
        d.ellipse((x-2,y-2,x+2,y+2),fill=(*NEON,140))
    return out

def photo(canvas,name,rect,alpha=245,radius=16):
    source=src(name)
    if source is None:return
    x,y,w,h=map(int,rect)
    if w<=0 or h<=0:return
    source=ImageOps.fit(source,(w,h),method=Image.Resampling.LANCZOS,
                        centering=(.5,.43))
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=alpha)
    canvas.paste(source,(x,y),mask)

def title(canvas,xy,text,size=34,color=WHITE):
    ImageDraw.Draw(canvas).text(xy,text,font=font(size),fill=(*color,255),stroke_width=0)

def phone(canvas,screen,x,y,w,h,slant=0):
    """Frame placed around an existing BetVima illustration/screenshot."""
    w,h=int(w),int(h)
    if w<20 or h<30:return
    case=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(case)
    d.rounded_rectangle((0,0,w-1,h-1),radius=int(w*.13),
                        fill=(3,7,16,255),outline=(109,143,176,255),
                        width=max(2,w//80))
    photo(case,screen,(int(w*.052),int(h*.028),int(w*.896),int(h*.94)),
          alpha=255,radius=max(10,int(w*.09)))
    d.rounded_rectangle((int(w*.35),int(h*.018),int(w*.65),int(h*.033)),
                        radius=6,fill=(0,5,15,255))
    if slant:case=case.rotate(slant,expand=True,resample=Image.Resampling.BICUBIC)
    # Make phone shadow subtle enough not to obscure UI or headings.
    sh=Image.new("RGBA",case.size,(0,0,0,0))
    sh.putalpha(case.getchannel("A").filter(ImageFilter.GaussianBlur(12))
         .point(lambda a:round(a*.55)))
    canvas.alpha_composite(sh,(int(x)+10,int(y)+10))
    canvas.alpha_composite(case,(int(x),int(y)))

def chart(canvas):
    w,h=canvas.size;d=ImageDraw.Draw(canvas,"RGBA")
    vals=[.27,.31,.36,.32,.47,.51,.47,.65,.63,.83,.79,.94]
    pts=[]
    for i,v in enumerate(vals):
        x=int(w*(.07+i*.079))
        y=int(h*(.84-v*.65));pts.append((x,y))
        if i%2==0:d.rounded_rectangle((x-10,int(h*.93-v*h*.30),x+10,int(h*.94)),
                                      radius=7,fill=(*NEON,75))
    for row in range(1,5):
        y=round(h*row/5);d.line((20,y,w-20,y),fill=(135,188,225,36),width=2)
    d.line(pts,fill=(*NEON,255),width=max(3,w//210),joint="curve")
    for x,y in pts:d.ellipse((x-5,y-5,x+5,y+5),fill=(216,251,238,255))

def globe(canvas):
    w,h=canvas.size;d=ImageDraw.Draw(canvas,"RGBA")
    cx,cy=int(w*.60),int(h*.53);r=int(h*.37)
    for k in range(1,5):
        rr=round(r*k/4)
        d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=(*BLUE,90),width=3)
    for n in range(-2,3):
        xx=round(cx+n*r*.34)
        d.arc((xx-r//2,cy-r,xx+r//2,cy+r),0,360,fill=(*NEON,70),width=2)
    for u,v in [(-.3,.2),(.2,.1),(.6,-.32),(-.55,-.22)]:
        x=round(cx+u*r);y=round(cy+v*r)
        d.ellipse((x-6,y-6,x+6,y+6),fill=(*NEON,255))

def chat(canvas):
    w,h=canvas.size;d=ImageDraw.Draw(canvas,"RGBA")
    for i in range(3):
        x=int(w*(.08+i*.10));y=int(h*(.16+i*.21))
        bw=int(w*.43);bh=int(h*.25)
        d.rounded_rectangle((x,y,x+bw,y+bh),radius=17,
                    fill=(32,49,78,230),outline=(*BLUE,165),width=3)
        for j in range(3):
            q=x+28;t=y+int(bh*(.30+j*.20))
            d.rounded_rectangle((q,t,q+int(bw*(.7-j*.15)),t+5),
                                radius=2,fill=(199,224,246,150))

def render(name,wh,kind,caption=None):
    w,h=wh;img=panel(w,h,hue=NEON if kind in ("casino","mobile","join") else BLUE)
    if kind=="hero":
        photo(img,"hero_stadium",(0,int(h*.16),w,int(h*.84)),alpha=215,radius=0)
        phone(img,"casino",round(w*.49),round(h*.20),round(w*.40),round(h*.68),-6)
        phone(img,"app_showcase",round(w*.76),round(h*.39),round(w*.24),round(h*.52),7)
    elif kind=="ecosystem":
        photo(img,"football_team",(int(w*.38),0,int(w*.62),h))
        phone(img,"app_showcase",round(w*.64),-70,round(w*.25),round(h*1.20),-7)
    elif kind=="mobile":
        phone(img,"app_showcase",round(w*.49),-55,round(w*.25),round(h*1.14),-8)
        phone(img,"casino",round(w*.75),-28,round(w*.20),round(h*1.05),7)
    elif kind=="statistics":chart(img)
    elif kind=="geography":globe(img)
    elif kind=="casino":
        phone(img,"casino",round(w*.48),-60,round(w*.47),round(h*1.24),7)
    elif kind=="sports":
        photo(img,"football_action",(int(w*.34),0,int(w*.66),h))
        phone(img,"app_showcase",round(w*.67),-35,round(w*.26),round(h*1.14),-6)
    elif kind=="faq":chat(img)
    elif kind=="join":
        phone(img,"app_showcase",round(w*.53),-60,round(w*.27),round(h*1.21),-7)
        phone(img,"casino",round(w*.80),-30,round(w*.22),round(h*1.15),7)
    elif kind=="numbers":
        photo(img,"partners",(int(w*.42),0,int(w*.58),h),alpha=140)
    elif kind=="gallery_insights":chart(img)
    if caption:
        title(img,(round(w*.045),round(h*.69)),caption,round(min(w,h)*.075))
    dest=ASSETS/("bv_aff_"+name+".webp")
    img.convert("RGB").save(dest,"WEBP",quality=85,method=6)
    print(f"{dest.name}\t{w}x{h}\t{dest.stat().st_size}")

jobs=[
 ("hero",(1000,1180),"hero",None),
 ("numbers",(1100,425),"numbers",None),
 ("ecosystem",(1100,570),"ecosystem",None),
 ("mobile",(1100,570),"mobile","BETVIMA APP"),
 ("statistics",(1100,570),"statistics",None),
 ("chart",(1100,365),"statistics",None),
 ("geography",(1100,575),"geography",None),
 ("casino",(760,520),"casino",None),
 ("sports",(760,520),"sports",None),
 ("faq",(1100,425),"faq",None),
 ("join",(1100,665),"join","70% REVSHARE"),
 ("gallery_mobile",(660,780),"mobile",None),
 ("gallery_sports",(660,780),"sports",None),
 ("gallery_casino",(660,780),"casino",None),
 ("gallery_insights",(660,780),"gallery_insights",None),
]
if __name__=="__main__":
    for args in jobs:render(*args)
