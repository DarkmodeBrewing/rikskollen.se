import { date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { roles } from './roles';
import { organs } from './organs';
import { persons } from './persons';
import { relations } from 'drizzle-orm';

export const personalAssignment = pgTable('personal_assignment', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  organCode: text('organ_code')
    .notNull()
    .references(() => organs.code),
  roleCode: text('role_code')
    .notNull()
    .references(() => roles.code),
  kind: text('kind'),
  status: text('status'),
  from: date('from'),
  to: date('to'),
  value: text('value'),
  order: integer('order'),
});

export const personalAssignmentRelation = relations(
  personalAssignment,
  ({ one }) => ({
    person: one(persons, {
      fields: [personalAssignment.personId],
      references: [persons.id],
    }),
    organ: one(organs, {
      fields: [personalAssignment.organCode],
      references: [organs.code],
    }),
    role: one(roles, {
      fields: [personalAssignment.roleCode],
      references: [roles.code],
    }),
  }),
);

/*

CREATE TABLE personuppdrag (
organ_kod varchar(20),
roll_kod varchar(40),
ordningsnummer int,
status varchar(20),
typ varchar(20),
[from] datetime,
tom datetime,
uppgift varchar(500),
intressent_id varchar(50)
);

*/
