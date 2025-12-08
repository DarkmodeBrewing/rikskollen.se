import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { persons } from './persons';
import { relations } from 'drizzle-orm';

export const personalAttribute = pgTable('personal_attribute', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: uuid('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  code: text('code'),
  kind: text('kind'),
  value: text('value'),
});

export const paeronalAttributeRelations = relations(
  personalAttribute,
  ({ one }) => ({
    person: one(persons, {
      fields: [personalAttribute.personId],
      references: [persons.id],
    }),
  }),
);
