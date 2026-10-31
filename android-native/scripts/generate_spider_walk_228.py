"""Build a 48-pose articulated, foot-planted spider sprite from the existing
BetVima photographed spider. Requires Pillow; deterministic, pure visual asset.
Each of eight legs has articulated joints, a 64% contact phase, a lifted return
swing, joint shading and irregular hairs. Output is transparent WebP 8x6 grid.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAW = ROOT / "app/src/main/res/drawable"
SOURCE = DRAW / "spider_walk_cycle_227.webp"
OUTPUT = DRAW / "spider_walk_cycle_228.webp"
FRAMES = 48
W, H = 640, 520
CELL_W, CELL_H = 160, 130

source_sheet = Image.open(SOURCE).convert("RGBA")
photo = source_sheet.crop((0, 0, 224, 176)).resize((W, H), Image.Resampling.LANCZOS)
mask = Image.new("L", (W, H), 0)
md = ImageDraw.Draw(mask)
md.ellipse((322, 51, 559, 310), fill=255)
md.ellipse((245, 191, 427, 322), fill=255)
md.ellipse((250, 239, 411, 378), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(5))
photo.putalpha(ImageChops.multiply(photo.getchannel("A"), mask))

legs = []
for side in (-1, 1):
    if side < 0:
        hips = [(306,245),(297,266),(304,287),(310,309)]
        knees = [(197,127),(168,229),(171,337),(192,383)]
        feet = [(42,235),(42,390),(86,461),(214,489)]
    else:
        hips = [(384,243),(385,264),(393,283),(399,309)]
        knees = [(510,172),(532,254),(500,357),(481,396)]
        feet = [(620,273),(608,397),(570,461),(484,486)]
    legs.extend((side, i, h, k, f) for i, (h,k,f) in enumerate(zip(hips,knees,feet)))

def segment(draw, start, knee, ankle, tip, width, seed):
    parts = [(start,knee,width), (knee,ankle,width*.73), (ankle,tip,width*.39)]
    for k, (p,q,thickness) in enumerate(parts):
        thickness = max(1.5,thickness)
        draw.line((p,q),fill=(4,5,7,255),width=round(thickness+4))
        draw.line((p,q),fill=(28,25,26,255),width=round(thickness+1))
        draw.line((p,q),fill=(13,13,16,255),width=round(thickness))
        vx,vy = q[0]-p[0],q[1]-p[1]
        length = math.hypot(vx,vy) or 1
        nx,ny = -vy/length,vx/length
        draw.line(((p[0]+nx*thickness*.19,p[1]+ny*thickness*.19),
                   (q[0]+nx*thickness*.19,q[1]+ny*thickness*.19)),
                  fill=(82,84,89,235),width=max(1,round(thickness*.16)))
        randomizer = random.Random(seed*31+k*29)
        hairs = int(length/12)
        for h in range(hairs):
            t=(h+.4+randomizer.random()*.4)/(hairs+.2)
            x,y=p[0]+vx*t,p[1]+vy*t
            side=1 if h%2 else -1
            tilt=randomizer.uniform(.16,.8)
            hx,hy=nx*side+vx/length*tilt,ny*side+vy/length*tilt
            size=thickness*.58+randomizer.uniform(1,3)
            draw.line(((x,y),(x+hx*size,y+hy*size)),
                      fill=(76,72,69,randomizer.randint(65,125)),width=1)
        if k<2:
            r=thickness*.49
            draw.ellipse((q[0]-r,q[1]-r,q[0]+r,q[1]+r),
                         fill=(13,10,12,255),outline=(111,71,55,230),width=2)
    vx,vy=tip[0]-ankle[0],tip[1]-ankle[1]
    length=math.hypot(vx,vy) or 1
    nx,ny=-vy/length,vx/length
    for direction in (-1,1):
        p=(tip[0]+nx*direction*2,tip[1]+ny*direction*2)
        q=(p[0]+vx/length*5+nx*direction*2,p[1]+vy/length*5+ny*direction*2)
        draw.line((p,q),fill=(34,27,25,240),width=2)

sheet=Image.new("RGBA",(CELL_W*8,CELL_H*6),(0,0,0,0))
for frame in range(FRAMES):
    phase=frame/FRAMES
    layer=Image.new("RGBA",(W,H),(0,0,0,0))
    draw=ImageDraw.Draw(layer,"RGBA")
    for leg_id,(side,n,hip,knee,foot) in enumerate(legs):
        # Four diagonal pairs, with per-leg offsets to avoid robotic symmetry.
        offset=((n%2)*.5+(0 if side<0 else .5)+(n//2)*.10+.023*leg_id)%1
        t=(phase+offset)%1
        if t<.64:
            u=t/.64
            fore=24*(.5-u)
            lift=0
        else:
            u=(t-.64)/.36
            u=u*u*(3-2*u)
            fore=-12+24*u
            lift=30*math.sin(math.pi*u)**.8
        dx=side*(4 if n%2==0 else 7)*math.sin(2*math.pi*(t+.11))
        tip=(foot[0]+dx,foot[1]+fore-lift)
        knee2=(knee[0]+side*8*math.sin(2*math.pi*(t+.05))+dx*.25,
               knee[1]-lift*.44+fore*.22)
        coxa=(hip[0]+side*(17+4*n),hip[1]+(n-1.5)*3)
        ankle=(tip[0]*.74+knee2[0]*.26,tip[1]*.74+knee2[1]*.26-7)
        segment(draw,coxa,knee2,ankle,tip,18-2*n,leg_id+11)
        draw.line((hip,coxa),fill=(27,24,27,255),width=13-n)
    bob=round(1.3*math.sin(phase*math.tau*2))
    pose=Image.new("RGBA",(W,H),(0,0,0,0))
    pose.alpha_composite(photo,(0,bob))
    frame_image=Image.alpha_composite(layer,pose)
    frame_image.thumbnail((CELL_W-8,CELL_H-6),Image.Resampling.LANCZOS)
    cell=Image.new("RGBA",(CELL_W,CELL_H),(0,0,0,0))
    cell.alpha_composite(frame_image,((CELL_W-frame_image.width)//2,
                                      (CELL_H-frame_image.height)//2))
    sheet.alpha_composite(cell,((frame%8)*CELL_W,(frame//8)*CELL_H))
sheet.save(OUTPUT,"WEBP",quality=66,method=0)
assert OUTPUT.stat().st_size>50_000
print("wrote",OUTPUT,"frames",FRAMES,"bytes",OUTPUT.stat().st_size)
