import { DataStatusComponent } from './data-status';
import { AboutComponent } from './about';
import { inject } from '@angular/core';
import { HomeComponent } from './home';
import { Router, Routes } from '@angular/router';
import { MemberListComponent } from './member-list';
import { MemberDetailComponent } from './member-detail';
import { VoteListComponent } from './vote-list';
import { VoteDetailComponent } from './vote-detail';
import { DecisionDetailComponent } from './decision-detail';
import { DecisionListComponent } from './decision-list';
export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [
      (route) => {
        const router = inject(Router);
        return 'q' in route.queryParams || 'page' in route.queryParams
          ? router.createUrlTree(['/ledamoter'], { queryParams: route.queryParams })
          : true;
      },
    ],
  },
  { path: 'ledamoter', component: MemberListComponent },
  { path: 'ledamot/:id', component: MemberDetailComponent },
  { path: 'voteringar', component: VoteListComponent },
  { path: 'votering/:id', component: VoteDetailComponent },
  { path: 'arende/:id', component: DecisionDetailComponent },
  { path: 'arenden', component: DecisionListComponent },
  { path: 'datastatus', component: DataStatusComponent },
  { path: 'om', component: AboutComponent },
  { path: '**', redirectTo: '' },
];
