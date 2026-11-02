export interface SurveyInsight {
 snapshot: string; status: 'ready'|'empty'|'pending'; report: null|{text:string;generatedAt:string;mode:string;requestId:string};
 choiceQuestions:number; textQuestions:number; submittedInRoster:number; rosterSize:number;
}
