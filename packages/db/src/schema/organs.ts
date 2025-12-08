import { relations } from 'drizzle-orm';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { persons } from './persons';
import { personalAssignment } from './personal-assignment';

export const organs = pgTable('organs', {
  code: text('code').notNull().primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  domain: text('domain'),
  sort: integer('sort'),
});

export const organRelations = relations(organs, ({ many }) => ({
  persons: many(persons),
  assignments: many(personalAssignment),
}));

/*


CREATE TABLE organ (
id int,
kod varchar(50),
namn varchar(100),
typ varchar(50),
status varchar(12),
sortering int,
namn_en varchar(100),
domän varchar(50),
beskrivning varchar(1000)
);

*/
