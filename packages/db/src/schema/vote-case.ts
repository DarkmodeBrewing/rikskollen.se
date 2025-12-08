import { date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { persons } from './persons';

//Votation entry point
export const voteCase = pgTable('vote_case', {
  voteId: uuid('vote_id').notNull().primaryKey(),
  rm: text('rm'),
  beteckning: text('beteckning'),
  punkt: text('punkt'),
  dokId: text('dok_id'),
  mainVoteType: text('main_vote_type'),
  subjectType: text('subject_type'),
});

/*
     {
        "hangar_id": "5249812",
        "rm": "2025/26",
        "beteckning": "AU4",
        "punkt": "2",
        "votering_id": "8E788F46-829A-4417-B10B-3C3BA7815526",
        "intressent_id": "014744660015",
        "namn": "Mikael Damberg",
        "fornamn": "Mikael",
        "efternamn": "Damberg",
        "valkrets": "Stockholms län",
        "iort": "",
        "parti": "S",
        "banknummer": "7",
        "kon": "man",
        "fodd": "1971",
        "rost": "Ja",
        "avser": "sakfrågan",
        "votering": "huvud",
        "votering_url_xml": "http://data.riksdagen.se/votering/8E788F46-829A-4417-B10B-3C3BA7815526",
        "dok_id": "HD01AU4",
        "systemdatum": "2025-11-05 16:03:59"
      },
CREATE TABLE votering (
rm nvarchar(255),
beteckning nvarchar(255),
hangar_id int,
votering_id nvarchar(255),
punkt int,
namn nvarchar(255),
intressent_id nvarchar(255),
parti nvarchar(255),
valkrets nvarchar(255),
valkretsnummer int,
iort nvarchar(255),
rost nvarchar(255),
avser nvarchar(255),
votering nvarchar(255),
banknummer int,
fornamn nvarchar(255),
efternamn nvarchar(255),
kon nvarchar(255),
fodd int,
datum datetime
);*/
