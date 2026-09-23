"""Three-second animated AN ident; original procedural globe and title motion."""
import argparse, math, subprocess, os, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
timeline=json.loads((a.output/'voice.json').read_text(encoding='utf-8-sig'))['segments']
# Open on the presenter's complete greeting, then the ident, then the stories.
# Split at a frame boundary without repeating or dropping narration.
opening=round(float(timeline[0]['end'])*25)/25
if not 0 < opening < float(timeline[-1]['end']):raise ValueError('A complete opening greeting and following story are required')
def font(size):return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',size)
for name,w,h in [('website',1920,1080),('instagram',1080,1920)]:
 intro=a.output/(name+'-intro.mp4');body=a.output/(name+'-body.mp4');out=a.output/(name+'.mp4')
 proc=subprocess.Popen([a.ffmpeg,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r','25','-i','-','-f','lavfi','-i','aevalsrc=0.06*(sin(2*PI*(180+40*t)*t)+sin(2*PI*330*t)+sin(2*PI*440*t)):s=48000:d=3','-af','afade=t=in:d=0.12,afade=t=out:st=2.3:d=0.7','-t','3','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',str(intro)],stdin=subprocess.PIPE)
 for frame in range(75):
  t=frame/25;im=Image.new('RGB',(w,h),'#140e22');d=ImageDraw.Draw(im)
  cx,cy=w/2,h/2;radius=min(w,h)*(.37+.012*math.sin(t*.8))
  for y in range(0,h,4):
   v=int(12+18*max(0,1-abs(y-cy)/h));d.rectangle((0,y,w,y+4),fill=(v,12,v+15))
  for longitude in range(0,180,15):
   points=[]
   for lat in range(-90,91,3):
    la=math.radians(lat);lo=math.radians(longitude)+t*.45
    points.append((cx+radius*math.cos(la)*math.sin(lo),cy+radius*math.sin(la)))
   d.line(points,fill='#584185',width=3)
  for latitude in [-60,-30,0,30,60]:
   la=math.radians(latitude);rw=radius*math.cos(la);yy=cy+radius*math.sin(la)
   d.arc((cx-rw,yy-32,cx+rw,yy+32),0,360,fill='#396c85',width=2)
  d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline='#8A60D4',width=5)
  angle=t*80
  d.arc((cx-radius-30,cy-radius-30,cx+radius+30,cy+radius+30),angle,angle+125,fill='#42DFD1',width=7)
  d.arc((cx-radius-50,cy-radius-50,cx+radius+50,cy+radius+50),180-angle,250-angle,fill='#B783F0',width=4)
  # Restrained light sweep and horizontal broadcast rules.
  sy=int(h*(.15+(t/3)*.7));d.line((0,sy,w,sy),fill='#2d4353',width=2)
  title=Image.new('RGBA',(w,h));td=ImageDraw.Draw(title)
  for text,dy,size,color in [('THE ARTIFICIAL',-105,120 if w>1200 else 90,'#FFFFFF'),('NEWS',35,140 if w>1200 else 110,'#FFFFFF')]:
   f=font(size);tw=td.textlength(text,font=f);td.text(((w-tw)/2,cy+dy),text,font=f,fill=color,stroke_width=2,stroke_fill='#21152f')
  reveal=min(1,max(0,(t-.25)/.75));title.putalpha(title.getchannel('A').point(lambda x:int(x*reveal)))
  im.paste(title,(0,0),title)
  d=ImageDraw.Draw(im);span=int(min(1,t/1.1)*min(w*.36,500));d.line((cx-span,cy+210,cx+span,cy+210),fill='#42DFD1',width=5)
  fade=min(1,t/.16,(3-t)/.24)
  if fade<1:im=Image.blend(Image.new('RGB',(w,h),'black'),im,max(0,fade))
  if frame==45:im.save(a.output/(name+'-intro.jpg'),quality=95)
  proc.stdin.write(im.tobytes())
 proc.stdin.close()
 if proc.wait()!=0:raise RuntimeError('Intro encoding failed')
 os.replace(out,body)
 graph=(f'[1:v]split[head][tail];[head]trim=end={opening},setpts=PTS-STARTPTS,setsar=1[hv];'
        f'[tail]trim=start={opening},setpts=PTS-STARTPTS,setsar=1[tv];'
        f'[1:a]asplit[ha0][ta0];[ha0]atrim=end={opening},asetpts=PTS-STARTPTS[ha];'
        f'[ta0]atrim=start={opening},asetpts=PTS-STARTPTS[ta];'
        '[0:v]setsar=1[iv];[hv][ha][iv][0:a][tv][ta]concat=n=3:v=1:a=1[v][a]')
 subprocess.run([a.ffmpeg,'-v','error','-y','-i',str(intro),'-i',str(body),'-filter_complex',graph,'-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-movflags','+faststart',str(out)],check=True)
 subprocess.run([a.ffmpeg,'-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
