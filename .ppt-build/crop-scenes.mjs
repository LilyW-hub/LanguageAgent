import sharp from 'sharp';
const p='/Users/jiamingxu/.codex/generated_images/01a1ef3c-d444-70f1-8044-c06b2ecf55f8/exec-b1be25f9-92ec-4cd1-a291-a15b33ede6ef.png';
const m=await sharp(p).metadata();const w=Math.floor(m.width/2);for(const [name,left] of [['cafe-conversation',0],['london-connection',w+8]])await sharp(p).extract({left,top:0,width:w-8,height:m.height}).png().toFile('/Users/jiamingxu/Desktop/LanguageAgent/.ppt-build/'+name+'.png');
