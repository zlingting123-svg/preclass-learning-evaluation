import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './chat-answer.css';

/** Normalize common model math delimiters, preserving fenced and inline code verbatim. */
function mathDelimiters(text:string){
 return text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,i)=>i%2?part:part
  .replace(/\\\[([\s\S]*?)\\\]/g,(_whole,math:string)=>'\n$$\n'+math+'\n$$\n')
  .replace(/\\\(([^\n]*?)\\\)/g,(_whole,math:string)=>'$'+math+'$')).join('');
}
export function ChatAnswer({text}:{text:string}){
 const normalized=mathDelimiters(text.replace(/(【一般知识解释，未依据已上传课程资料】\s*){2,}/g,'【一般知识解释，未依据已上传课程资料】\n\n'));
 return <div className="chat-answer"><Markdown skipHtml remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[[rehypeKatex,{trust:false,strict:'warn',throwOnError:false,maxExpand:1000,maxSize:20}]]}
  components={{a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,img:()=>null}}>{normalized}</Markdown></div>;
}
