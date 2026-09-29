import { Routes } from '@angular/router';
import { MemberListComponent } from './member-list';
import { MemberDetailComponent } from './member-detail';
export const routes: Routes = [
  { path: '', component: MemberListComponent },
  { path: 'ledamot/:id', component: MemberDetailComponent },
  { path: '**', redirectTo: '' },
];
