import fs from 'node:fs/promises';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
import sharp from 'sharp';
const root='/Users/jiamingxu/Desktop/LanguageAgent';
const skill='/Users/jiamingxu/.codex/plugins/cache/openai-primary-runtime/presentations/26.1117.11355/skills/presentations';
const src=root+'/output/posters/语迹-标题调整版.png';
const meta=await sharp(src).metadata(); console.log(meta);
for(const name of ['coffee','street']) await sharp(root+'/public/scenes/'+name+'.svg').png().toFile(root+'/.ppt-build/'+name+'.png');
const p=Presentation.create({slideSize:{width:1280,height:720}});
const font='PingFang SC';
function text(s,t,x,y,w,h,size=26,color='#24343b',bold=false){let q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=t;q.text.style={typeface:font,fontSize:size,color,bold};return q}
function slide(title,notes){let s=p.slides.add();s.background.fill='#f7f9fa';if(title)text(s,title,64,48,1152,88,42);text(s,'语迹 / 文明迁徙计划',64,670,600,25,14,'#68767c');text(s,String(p.slides.items.length).padStart(2,'0'),1160,670,60,25,14,'#68767c');s.speakerNotes.text=notes;return s}
async function crop(name,box){let path=root+'/.ppt-build/'+name+'.png';await sharp(src).extract(box).toFile(path);return path}
async function img(s,path,x,y,w,h){let b=await fs.readFile(path);s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt:'当前项目真实 UI',fit:'contain',position:{left:x,top:y,width:w,height:h}})}
// Pixel crops preserve the current product UI without drawing replacements.
const scale=meta.width/906;
const box=(l,t,w,h)=>({left:Math.round(l*scale),top:Math.round(t*scale),width:Math.round(w*scale),height:Math.round(h*scale)});
const map=await crop('map',box(54,453,798,446));
const chat=await crop('chat',box(54,1055,798,507));
const feedback=await crop('feedback',box(265,1240,565,260));
let s=slide('', '0:00–0:20。我们做《语迹》，希望帮助那些明明学过英语、到了真实环境却不敢开口的人。用户成为文明档案员，从伦敦开始认识当地人。');
text(s,'语迹',64,90,450,100,76,'#21343a',true);text(s,'文明迁徙计划',67,202,470,60,32,'#0d7480');text(s,'走进一座陌生城市，\n从开口认识一个人开始',64,320,490,160,38);text(s,'虹桥国际科技周黑客松\nAI+Agent 赛道  2026.11.21',64,550,500,70,20,'#68767c');await img(s,map,590,120,625,420);
s=slide('学过英语，仍然不知道怎么开口','0:20–0:45。核心用户是 A1–B1、有旅行留学或涉外沟通需求的中文用户。困难不只在词汇，环境、语气与文化习惯也决定怎么说。此处是产品需求判断，尚无用户效果数据。来源：PRD V2.0 第三章及用户提供的作品背景。');text(s,'课本里有标准答案。\n真实交流还需要\n理解场合与语气。',64,170,550,200,36);text(s,'怎样礼貌点单？\n怎样回应当地人的寒暄？\n卡住之后，怎样继续交流？',64,420,550,160,27,'#52636a');await img(s,root+'/.ppt-build/coffee.png',660,170,550,410);
s=slide('文明档案员的第一站：伦敦','0:45–1:05。地图提供探索入口，当前开放伦敦，其余城市暂未开放。人物与任务让用户有具体的交流目标。地图来自项目 world.svg 与当前海报 UI。');await img(s,map,64,155,820,465);text(s,'进入场景\n认识当地人\n完成一次交流任务',940,235,280,200,28);text(s,'当前开放：伦敦\n首发语言：英语',940,495,270,90,21,'#0d7480');
s=slide('咖啡馆里的自然对话','1:05–1:45。切换真实应用，演示与 Maya 点单。先表达含糊或带错误的句子，观察角色自然接话，再点开表达建议。此页为项目内置回放内容，不能冒充实时模型结果。若网络异常，现场明确说明使用回放。');await img(s,chat,64,145,900,510);text(s,'先理解意思，\n再把对话接下去',1000,220,220,180,28);text(s,'现场演示\n约 40 秒',1000,490,220,90,22,'#0d7480');
s=slide('表达之后，还有下一次练习','1:45–2:10。反馈默认折叠，学习者可以自主展开。难点在后续场景中换个问法出现，档案知识点可以继续练习。奖励鼓励表达和任务推进，不奖励犯错。来源：ReviewCard、ArchivePractice、review 与 orchestrator 当前实现。');await img(s,feedback,64,180,720,365);text(s,'更自然的表达可选查看\n\n知识档案保存学习内容\n\n薄弱点在之后的对话中回收',850,180,360,380,27);text(s,'目标：把“听过”变成真正用得出来',64,590,1120,55,30,'#0d7480');
s=slide('Agent 如何完成一次学习任务','2:10–2:45。一个编排器组织专职模块，不是多套独立服务。读取记忆后，回复与纠错合并调用，画像提取并行。模型申请工具，服务端执行查词、安排复习和保存档案。任务看表达证据才推进。来源：lib/orchestrator.ts、lib/tools.ts、lib/agents 与当前代码。');
for(const [i,a] of [['读取记忆','水平、兴趣、待巩固点'],['规划与对话','任务准入和角色边界'],['执行工具','查词、复习与档案保存'],['更新学习记录','画像、奖励与难点回收']].entries()){let y=170+i*110;text(s,String(i+1).padStart(2,'0'),64,y,80,55,32,'#0d7480');text(s,a[0],140,y,410,55,29);text(s,a[1],140,y+48,430,45,21,'#52636a')}
await img(s,feedback,620,220,595,280);text(s,'角色回复与结构化表达反馈',650,535,550,45,21,'#0d7480');
s=slide('当前原型与下一步试用','2:45–3:25。当前是可运行的单用户 MVP，已实现英语场景对话、任务、档案和成长记录。密钥在服务端，推测信息单独标记。存在失败提示和明确标识的回放。接下来先小范围验证有效学习会话与复习完成，再做账户隔离和内容扩展。订阅与多语言是规划，不是现有成果。未宣称学习效果或商业验证。');text(s,'当前可用',64,170,500,60,31,'#0d7480');text(s,'场景对话、任务与学习记录\n失败提示与回放降级',64,235,540,90,25);await img(s,chat,64,335,540,220);text(s,'下一步验证',700,170,500,60,31,'#0d7480');text(s,'邀请目标用户完成真实场景任务\n观察有效学习会话和复习完成\n完善账户隔离，再扩展城市内容',700,260,510,230,27);text(s,'单用户演示原型。AI 辅助语言练习，不替代教师。',64,570,1120,60,22,'#68767c');
s=slide('语言是走进另一种生活的入口','3:25–3:55。最后回到产品使命。我们希望用户敢在陌生城市里认识一个人，愿意在不确定时继续交流。收尾后留五秒缓冲。完整时长 3 分 55 秒。');text(s,'听见当地的语言，\n尝试自己的表达，\n逐渐说得更自在。',64,195,620,250,44);await img(s,root+'/.ppt-build/street.png',720,190,495,340);text(s,'语迹',64,530,500,90,58,'#0d7480',true);text(s,'文明迁徙计划',280,555,600,60,29);
for(let i=0;i<p.slides.items.length;i++){let b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(root+'/.ppt-build/slide-'+(i+1)+'.png',new Uint8Array(await b.arrayBuffer()))}
const candidate=root+'/.ppt-build/candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(skill+'/container_tools/artifact_tool_utils.mjs');
console.log(await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:root+'/output/presentations/语迹-4分钟黑客松路演-图例增强版-v2.pptx',pythonExecutable:'/Users/jiamingxu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:root+'/.ppt-build/validation-visual-v2.json'}));
