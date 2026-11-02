import{read,utils}from'xlsx';
export function sheetRows(input,type){const book=read(input,{type,cellFormula:false,cellHTML:false,cellStyles:false,sheetRows:103});const name=book.SheetNames[0];if(!name)throw Error('文件中没有工作表。');return utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false,blankrows:false});}
