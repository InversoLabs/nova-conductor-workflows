"""Original three-second TAN ident, generated locally without licensed media."""
import argparse, json, subprocess, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
def font(size): return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',size)
for name,w,h in [('website',1920,1080),('instagram',1080,1920)]:
    im=Image.new('RGB',(w,h),'#221826');d=ImageDraw.Draw(im)
    cx,cy=w//2,h//2;radius=min(w,h)*.38
    d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline='#715065',width=6)
    for factor in [.3,.6,.85]: d.ellipse((cx-radius*factor,cy-radius,cx+radius*factor,cy+radius),outline='#4f394b',width=3)
    for offset in [-.5,0,.5]:d.line((cx-radius,cy+radius*offset,cx+radius,cy+radius*offset),fill='#4f394b',width=3)
    for i,line in enumerate(['THE ARTIFICIAL','NEWS']):
        f=font(140 if w>1200 else 104);box=d.textbbox((0,0),line,font=f);tw=box[2]-box[0]
        d.text(((w-tw)/2,cy-170+i*150),line,font=f,fill='#ffd23f')
    for text,y,size in [('REAL HEADLINES. DEEPLY UNSERIOUS.',cy+170,32),('SATIRE / FICTIONAL COMEDY',cy+235,30)]:
        f=font(size);tw=d.textlength(text,font=f);d.text(((w-tw)/2,y),text,font=f,fill='white')
    plate=a.output/(name+'-intro.jpg');im.save(plate,quality=95)
    intro=a.output/(name+'-intro.mp4');body=a.output/(name+'-body.mp4');out=a.output/(name+'.mp4')
    os.replace(out,body)
    subprocess.run([a.ffmpeg,'-y','-loop','1','-i',str(plate),'-f','lavfi','-i','aevalsrc=0.08*(sin(2*PI*220*t)+sin(2*PI*330*t)+sin(2*PI*440*t)):s=48000:d=3','-vf',f"zoompan=z='1+0.0005*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=75:s={w}x{h}:fps=25,fade=t=in:d=0.2,fade=t=out:st=2.7:d=0.3",'-af','afade=t=in:d=0.1,afade=t=out:st=2:d=1','-t','3','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',str(intro)],check=True)
    subprocess.run([a.ffmpeg,'-y','-i',str(intro),'-i',str(body),'-filter_complex','[0:v]setsar=1[v0];[1:v]setsar=1[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-movflags','+faststart',str(out)],check=True)
    subprocess.run([a.ffmpeg,'-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
