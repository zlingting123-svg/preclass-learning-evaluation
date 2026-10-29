export type ChatOutcome='pending'|'done'|'refusal'|'insufficient_evidence'|'error'|'cancelled'|'interrupted';
export interface ChatSource {id:string;title:string;version:string;url?:string}
export interface ChatMessage {id:string;role:'user'|'assistant';text:string;outcome:ChatOutcome;sources?:ChatSource[]}
export interface ChatThread {id:string;classId:string;title:string;createdAt:string;updatedAt:string;busy:boolean;messageCount:number}
export interface ChatDetail extends ChatThread {messages:ChatMessage[]}
export interface ChatList {items:ChatThread[];activeId:string|null}
