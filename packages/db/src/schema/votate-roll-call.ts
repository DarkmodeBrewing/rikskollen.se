import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { persons } from './persons';

export const voteTypeEnum = pgEnum('vote_type_enum', [
  'Ja',
  'Nej',
  'Avstår',
  'Frånvarande',
]);

export const votateRollCall = pgTable('vote_roll_call', {
  voteId: uuid('vote_id').notNull().primaryKey(),
  personId: text('person_id').references(() => persons.personId),
  vote: voteTypeEnum('vote').notNull(),
  constituency: text('constituency'),
  party: text('party'),
});

/**
 * https://data.riksdagen.se/votering
 * 
 * <dokument>
<hangar_id>5249812</hangar_id>
<dok_id>HD01AU4</dok_id>
<rm>2025/26</rm>
<beteckning>AU4</beteckning>
<typ>bet</typ>
<subtyp>bet</subtyp>
<doktyp>bet</doktyp>
<typrubrik>Betänkande 2025/26:AU4</typrubrik>
<dokumentnamn>Betänkande</dokumentnamn>
<debattnamn>Debatt om förslag</debattnamn>
<tempbeteckning/>
<organ>AU</organ>
<mottagare/>
<nummer>4</nummer>
<slutnummer>0</slutnummer>
<datum>2025-10-23 00:00:00</datum>
<systemdatum>2025-11-06 13:57:29</systemdatum>
<publicerad>2025-06-18 13:36:02</publicerad>
<titel>Regler om avstängning av statligt anställda</titel>
<subtitel/>
<status>Webbpublicering</status>
<htmlformat>html</htmlformat>
<relaterat_id/>
<source>RIM</source>
<sourceid>b0f0fbc5-08b1-4a26-97b4-61eaa16ee44b</sourceid>
<dokument_url_text>https://data.riksdagen.se/dokument/HD01AU4/text</dokument_url_text>
<dokument_url_html>https://data.riksdagen.se/dokument/HD01AU4</dokument_url_html>
<dokumentstatus_url_xml>https://data.riksdagen.se/dokumentstatus/HD01AU4</dokumentstatus_url_xml>
<utskottsforslag_url_xml>https://data.riksdagen.se/utskottsforslag/HD01AU4</utskottsforslag_url_xml>
</dokument>
<dokbilaga>
<bilaga>
<dok_id>HD01AU4</dok_id>
<subtitel/>
<filnamn>2025_26_AU4_20251023141126_Publicering.pdf</filnamn>
<filstorlek>891505</filstorlek>
<filtyp>pdf</filtyp>
<titel>Regler om avstängning av statligt anställda</titel>
<fil_url>https://data.riksdagen.se/fil/CF1A9FBD-7331-4AEE-9908-D7A3C088795F</fil_url>
</bilaga>
</dokbilaga>
 */
