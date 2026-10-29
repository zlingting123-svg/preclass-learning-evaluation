export function DeleteConversation({title,busy,onConfirm,onCancel}:{title:string;busy:boolean;onConfirm:()=>void;onCancel:()=>void}){
 return <div className="chat-delete-confirm" role="alertdialog" aria-label="确认删除对话"><strong>删除“{title}”？</strong><p>这条对话及其中的消息将从账号中删除，无法恢复。已有用量记录会保留。</p><div><button type="button" disabled={busy} onClick={onCancel}>取消</button><button type="button" className="chat-delete-danger" disabled={busy} onClick={onConfirm}>确认删除</button></div></div>;
}
