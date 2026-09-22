param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$s=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$bmp=New-Object System.Drawing.Bitmap 1080,1350
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='AntiAlias';$g.TextRenderingHint='AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0d1b1b'))
$lime=New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#d8ff36'))
$white=New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#f0f3e9'))
$muted=New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#9fb5a7'))
$pen=New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#25453d')),2
$brand=New-Object System.Drawing.Font 'Arial',22,([System.Drawing.FontStyle]::Bold)
$small=New-Object System.Drawing.Font 'Arial',18
$title=New-Object System.Drawing.Font 'Arial',48,([System.Drawing.FontStyle]::Bold)
try {
  for($i=0;$i -lt 9;$i++){$g.DrawEllipse($pen,370-$i*35,95-$i*16,300+$i*70,300+$i*35)}
  $g.FillRectangle($lime,64,65,12,33)
  $g.DrawString('IN / SIGNAL',$brand,$white,96,62)
  $g.DrawString('AI NEWS  /  '+$s.category.ToUpper(),$small,$lime,64,433)
  $rect=New-Object System.Drawing.RectangleF 60,495,960,600
  while($g.MeasureString([string]$s.title,$title,960).Height -gt 590 -and $title.Size -gt 30){$size=$title.Size-2;$title.Dispose();$title=New-Object System.Drawing.Font 'Arial',$size,([System.Drawing.FontStyle]::Bold)}
  $g.DrawString([string]$s.title,$title,$white,$rect)
  $g.DrawLine($pen,64,1150,1016,1150)
  $g.DrawString('INVERSO LABS  /  EXPERIMENTS IN INTELLIGENCE',$small,$muted,64,1180)
  $g.DrawString('Read the briefing at inversolabs.us/newsroom',$small,$white,64,1240)
  $bmp.Save($OutputFile,[System.Drawing.Imaging.ImageFormat]::Jpeg)
} finally {$title.Dispose();$small.Dispose();$brand.Dispose();$pen.Dispose();$lime.Dispose();$white.Dispose();$muted.Dispose();$g.Dispose();$bmp.Dispose()}
