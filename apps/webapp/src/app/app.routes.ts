import { Routes } from '@angular/router';
import { MemberListComponent } from './member-list';
import { MemberDetailComponent } from './member-detail';
import { VoteListComponent } from './vote-list';
import { VoteDetailComponent } from './vote-detail';
import { DecisionDetailComponent } from './decision-detail';
export const routes: Routes = [
  { path: '', component: MemberListComponent },
  { path: 'ledamot/:id', component: MemberDetailComponent },
  { path: 'voteringar', component: VoteListComponent },
  { path: 'votering/:id', component: VoteDetailComponent },
  { path: 'arende/:id', component: DecisionDetailComponent },
  { path: '**', redirectTo: '' },
];
