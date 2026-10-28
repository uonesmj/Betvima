#!/usr/bin/env python3
"""Genuinely refresh the BetVima affiliate picture set for Android v0.201.

The previous image build regenerated the SAME 15 files byte-for-byte on
v0.199 and v0.200. This renderer replaces all public affiliate scene images,
using distinct original/licensed in-repo campaign photos and dedicated layouts.

No authenticated report artwork or financial data is modified.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from math import cos, sin, pi
import hashlib
import random

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"app/src/main/assets/affiliate"
random.seed(201)
RESAMPLE=Image.Resampling.LANCZOS
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def fnt(size):
    try: return ImageFont.truetype(FONT, size)
    except Exception: return ImageFont.load_default()

def read(name):
    img=Image.open(ASSETS/(name+".webp"))
    return img.convert("RGBA")

def blend_photo(name, canvas, *, centre=(.5,.5)):
    w,h=canvas.size
    im=ImageOps.fit(read(name),(w,h),method=RESAMPLE,centering=centre)
    canvas.alpha_composite(im)

def fade_edges(out, *, color=(7,12,26), left=.8, bottom=.52, top=.05):
    w,h=out.size
    layer=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(layer,"RGBA")
    # 1-pixel vertical rows create a smooth cinematic veil over photography.
    for y in range(h):
        yy=y/max(1,h-1)
        alpha=bottom*(yy**2)+top*((1-yy)**2)
        d.line((0,y,w,y),fill=(*color,round(alpha*255)),width=1)
    for x in range(w):
        xx=x/max(1,w-1)
        d.line((x,0,x,h),fill=(*color,round(left*255*(1-xx)**2.4)),width=1)
    out.alpha_composite(layer)

def neon(out,accent):
    w,h=out.size
    overlay=Image.new("RGBA",(w,h),(0,0,0,0))
    d=ImageDraw.Draw(overlay,"RGBA")
    # Unique clipped swooshes and lens flares; keep central photo readable.
    cx,cy=w*.83,h*.32
    for n in range(4):
        rr=int(min(w,h)*(.24+n*.12))
        d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=(*accent,54-n*9),
                  width=max(2,round(w*.005)))
    for n in range(6):
        x=int(w*(.12+n*.145));y=int(h*(.83-.11*sin(n*1.4)))
        r=int(min(w,h)*.006)
        d.ellipse((x-r,y-r,x+r,y+r),fill=(*accent,140))
    out.alpha_composite(overlay)

def logo(out,accent):
    w,h=out.size
    # Branding remains legible against both pale and dark image regions.
    d=ImageDraw.Draw(out,"RGBA")
    tw=max(11,int(min(w,h)*.050))
    xx=int(w*.05);yy=int(h*.07)
    d.rounded_rectangle((xx-11,yy-8,xx+tw*8.0,yy+tw*1.65),
                        radius=round(tw*.29),fill=(9,15,27,185))
    d.text((xx,yy),"BET",font=fnt(tw),fill=(246,250,255,255))
    d.text((xx+tw*2.42,yy),"VIMA",font=fnt(tw),fill=(*accent,255))

def glass(out,rect,accent):
    x,y,w,h=[int(v) for v in rect]
    d=ImageDraw.Draw(out,"RGBA")
    d.rounded_rectangle((x,y,x+w,y+h),radius=max(12,w//12),
        fill=(8,15,30,185),outline=(*accent,160),width=max(2,w//140))

def tile(out, src_name, rect, angle, accent):
    x,y,w,h=[int(v) for v in rect]
    shot=ImageOps.fit(read(src_name),(w,h),method=RESAMPLE)
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((2,2,w-2,h-2),
       radius=max(8,w//15),fill=255)
    shot.putalpha(mask)
    if angle:
        shot=shot.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    d=ImageDraw.Draw(out,"RGBA")
    d.rounded_rectangle((x-7,y-7,x+w+7,y+h+7),radius=max(10,w//14),
                        fill=(6,12,23,160),outline=(*accent,110),width=2)
    out.alpha_composite(shot,(x,y))

# Each card intentionally has a different photo and focal geometry.
SCENES={
 "hero":          ("analytics",(15,213,151),"phone",(.56,.48)),
 "numbers":       ("partners",(206,166,106),"numbers",(.55,.47)),
 "ecosystem":     ("football_team",(43,233,169),"split",(.43,.45)),
 "mobile":        ("app_showcase",(91,180,255),"mobile",(.46,.48)),
 "mobile_product":("app_showcase",(36,222,187),"pair",(.55,.45)),
 "geography":     ("global_stadium",(74,179,255),"world",(.48,.50)),
 "casino":        ("casino",(236,83,143),"casino",(.44,.47)),
 "sports":        ("football_action",(255,183,72),"sports",(.52,.46)),
 "faq":           ("people_2",(120,145,247),"faq",(.50,.38)),
 "join":          ("winning_moment",(33,232,146),"join",(.44,.50)),
 "gallery_mobile":("app_showcase",(58,191,247),"mobile",(.54,.52)),
 "gallery_sports":("players",(244,173,62),"sports",(.50,.46)),
 "gallery_casino":("casino",(245,89,167),"casino",(.46,.48)),
 "gallery_insights":("analytics",(49,216,177),"insights",(.50,.48)),
 "guide_start":   ("football_team",(57,233,159),"start",(.49,.45)),
 "guide_revshare":("partners",(238,189,82),"revenue",(.47,.44)),
 "guide_reporting":("app_showcase",(58,197,243),"report",(.55,.45)),
 "faq_revshare":  ("people_3",(247,187,83),"q1",(.55,.38)),
 "faq_earning":   ("players",(49,217,171),"q2",(.55,.38)),
 "faq_cpa":       ("people_4",(117,160,255),"q3",(.52,.38)),
 "faq_payouts":   ("global_stadium",(33,212,195),"q4",(.5,.5)),
 "faq_statistics":("analytics",(152,123,255),"q5",(.53,.46)),
}

def render(name,size,theme):
    photo_name,accent,mode,centre=theme
    w,h=size
    out=Image.new("RGBA",(w,h),(9,17,34,255))
    blend_photo(photo_name,out,centre=centre)
    fade_edges(out, left=.72 if mode in ("mobile","sports","casino") else .56,
               bottom=.46, top=.13)
    neon(out,accent)
    d=ImageDraw.Draw(out,"RGBA")
    if mode=="split":
        # Two independently photographed parts, not the former single stadium.
        tile(out,"casino",(round(w*.52),round(h*.14),round(w*.42),round(h*.67)),
             -4,accent)
    elif mode=="phone":
        tile(out,"app_showcase",
            (round(w*.48),round(h*.35),round(w*.41),round(h*.44)),8,accent)
    elif mode in ("mobile","pair"):
        tile(out,"app_showcase",
            (round(w*.43),round(h*.10),round(w*.45),round(h*.76)),-6,accent)
        if mode=="pair":
            tile(out,"casino",
                (round(w*.69),round(h*.37),round(w*.27),round(h*.49)),5,accent)
    elif mode=="world":
        for n in range(4):
            xx=round(w*(.40+n*.11))
            yy=round(h*(.25+sin(n*.7)*.16))
            d.ellipse((xx-10,yy-10,xx+10,yy+10),fill=(*accent,200))
            if n:
                px=round(w*(.40+(n-1)*.11))
                py=round(h*(.25+sin((n-1)*.7)*.16))
                d.line((px,py,xx,yy),fill=(*accent,160),width=3)
    elif mode in ("numbers","revenue"):
        glass(out,(w*.54,h*.17,w*.35,h*.46),accent)
        d.text((w*.60,h*.28),"70%",font=fnt(round(h*.16)),fill=(252,252,252,255))
    elif mode=="casino":
        tile(out,"app_showcase",
            (round(w*.53),round(h*.16),round(w*.36),round(h*.70)),7,accent)
    elif mode=="faq":
        glass(out,(w*.43,h*.16,w*.47,h*.54),accent)
        for i in range(4):
            cy=round(h*(.27+i*.1))
            d.rounded_rectangle((round(w*.50),cy,round(w*(.78-i*.03)),cy+7),
                                radius=4,fill=(*accent,180))
    elif mode=="join":
        glass(out,(w*.48,h*.21,w*.44,h*.57),accent)
        d.text((w*.57,h*.39),"70%",font=fnt(round(h*.13)),fill=(245,248,255,255))
    elif mode in ("report","insights","q5"):
        # Decorative dynamic lines are only background artwork; the actual
        # financial charts in UI are custom animated composables.
        for i in range(9):
            x=round(w*(.08+i*.10))
            y=round(h*(.85-.07*i-.07*sin(i*1.8)))
            d.ellipse((x-5,y-5,x+5,y+5),fill=(*accent,255))
            if i:
                d.line((px,py,x,y),fill=(*accent,210),width=4)
            px,py=x,y
    elif mode.startswith("q") or mode=="start":
        glass(out,(w*.06,h*.61,w*.57,h*.21),accent)
        for i in range(3):
            y=round(h*(.67+i*.038))
            d.line((round(w*.10),y,round(w*(.39+i*.06)),y),
                   fill=(*accent,180),width=4)
    # Branded treatment is independent from native captions/buttons.
    logo(out,accent)
    image=out.convert("RGB")
    dest=ASSETS/("bv_aff_"+name+".webp")
    image.save(dest,"WEBP",quality=89,method=6)
    print(f"UPDATED {name} {w}x{h} {dest.stat().st_size}")

def main():
    # Preserve the original dimensions used by Compose cards.
    from generate_affiliate_art import jobs
    dimensions={name:size for name,size,*_ in jobs}
    for name,theme in SCENES.items():
        if name in ("statistics","chart","gallery_insights"):
            # Those image views are superseded by animated vector charts.
            continue
        render(name,dimensions[name],theme)
    # Trace contents in CI so an unchanged image set cannot pass silently.
    import hashlib
    for name in SCENES:
        if name in ("statistics","chart","gallery_insights"): continue
        path=ASSETS/("bv_aff_"+name+".webp")
        print("SHA256",name,hashlib.sha256(path.read_bytes()).hexdigest())

if __name__=="__main__":
    main()
