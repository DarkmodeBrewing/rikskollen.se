import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const persons = pgTable('persons', {
  id: uuid('id').defaultRandom().primaryKey(),
  personId: text('person_id').notNull().unique(),
  sourceId: uuid('sourceid').notNull().unique(),
  givenName: text('given_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender'),
  birthYear: integer('birth_year'),
  status: text('status'),
  personUrl: text('person_url'),
  imageMax: text('image_max'),
  partyCode: text('party_code').notNull(),
  constituency: text('constituency').notNull(),
  sourceUrl: text('source_url').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * {
        "hangar_guid": "100545e2-431c-4eb3-b664-c664e4f6b9e3",
        "sourceid": "8f411454-d7ac-46dd-b505-ad4de24ad18b",
        "intressent_id": "0251136832626",
        "hangar_id": "2343626",
        "fodd_ar": "1976",
        "kon": "man",
        "efternamn": "Demirok",
        "tilltalsnamn": "Muharrem",
        "sorteringsnamn": "Demirok,Muharrem",
        "iort": "",
        "parti": "C",
        "valkrets": "Östergötlands län",
        "status": "Tjänstgörande riksdagsledamot",
        "person_url_xml": "https://data.riksdagen.se/person/8f411454-d7ac-46dd-b505-ad4de24ad18b",
        "bild_url_80": "https://data.riksdagen.se/filarkiv/bilder/ledamot/8f411454-d7ac-46dd-b505-ad4de24ad18b_80.jpg",
        "bild_url_192": "https://data.riksdagen.se/filarkiv/bilder/ledamot/8f411454-d7ac-46dd-b505-ad4de24ad18b_192.jpg",
        "bild_url_max": "https://data.riksdagen.se/filarkiv/bilder/ledamot/8f411454-d7ac-46dd-b505-ad4de24ad18b_max.jpg",
        "personuppdrag": {
          "uppdrag": [
            {
              "organ_kod": "C",
              "roll_kod": "Partiledare",
              "ordningsnummer": "0",
              "status": "",
              "typ": "partiuppdrag",
              "from": "2023-02-02 14:01:00",
              "tom": "2025-05-03 14:59:00",
              "uppgift": [
                "Centerpartiet"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "20",
              "organ_sortering": "",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            },
            {
              "organ_kod": "kam",
              "roll_kod": "Riksdagsledamot",
              "ordningsnummer": "326",
              "status": "Tjänstgörande",
              "typ": "kammaruppdrag",
              "from": "2022-09-26 11:00:00",
              "tom": "2026-09-28 10:59:00",
              "uppgift": [
                {}
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "10",
              "organ_sortering": "10",
              "uppdrag_rollsortering": "60",
              "uppdrag_statussortering": "10"
            },
            {
              "organ_kod": "KU",
              "roll_kod": "Ledamot",
              "ordningsnummer": "14",
              "status": "",
              "typ": "uppdrag",
              "from": "2025-09-01",
              "tom": "2026-09-28 10:59:00",
              "uppgift": [
                "Konstitutionsutskottet"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "30",
              "organ_sortering": "150",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            },
            {
              "organ_kod": "AU",
              "roll_kod": "Suppleant",
              "ordningsnummer": "19",
              "status": "",
              "typ": "uppdrag",
              "from": "2022-10-12 14:15:00",
              "tom": "2023-02-24 09:00:00",
              "uppgift": [
                "Arbetsmarknadsutskottet"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "50",
              "organ_sortering": "150",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            },
            {
              "organ_kod": "UbU",
              "roll_kod": "Ledamot",
              "ordningsnummer": "14",
              "status": "",
              "typ": "uppdrag",
              "from": "2022-10-04 11:00:00",
              "tom": "2023-02-09 12:00:00",
              "uppgift": [
                "Utbildningsutskottet"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "30",
              "organ_sortering": "150",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            },
            {
              "organ_kod": "KD",
              "roll_kod": "Ledamot",
              "ordningsnummer": "40",
              "status": "",
              "typ": "Riksdagsorgan",
              "from": "2023-02-09 12:01:00",
              "tom": "2025-06-16 23:59:00",
              "uppgift": [
                "Krigsdelegationen"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "30",
              "organ_sortering": "300",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            },
            {
              "organ_kod": "UN",
              "roll_kod": "Ledamot",
              "ordningsnummer": "6",
              "status": "",
              "typ": "Riksdagsorgan",
              "from": "2023-02-09 12:01:00",
              "tom": "2025-06-16 23:59:00",
              "uppgift": [
                "Utrikesnämnden"
              ],
              "intressent_id": "0251136832626",
              "hangar_id": "2343626",
              "sortering": "30",
              "organ_sortering": "300",
              "uppdrag_rollsortering": "90",
              "uppdrag_statussortering": "90"
            }
          ]
        },
        "personuppgift": {
          "uppgift": [
            {
              "kod": "HarBild",
              "uppgift": [
                "true"
              ],
              "typ": "bilder",
              "intressent_id": "0251136832626",
              "hangar_id": "2343626"
            },
            {
              "kod": "Uppdrag inom riksdag och regering",
              "uppgift": [
                "Riksdagsledamot 22–. Ledamot utbildningsutskottet 22–23. Suppleant arbetsmarknadsutskottet 22–23. Ledamot Utrikesnämnden 23– och krigsdelegationen 23–. Partiledare Centerpartiet 23–."
              ],
              "typ": "biografi",
              "intressent_id": "",
              "hangar_id": "2343626"
            },
            {
              "kod": "Officiell e-postadress",
              "uppgift": [
                "muharrem.demirok[på]riksdagen.se"
              ],
              "typ": "eadress",
              "intressent_id": "0251136832626",
              "hangar_id": "2343626"
            },
            {
              "kod": "KandiderarINastaVal",
              "uppgift": [
                "true"
              ],
              "typ": "val",
              "intressent_id": "0251136832626",
              "hangar_id": "2343626"
            }
          ]
        }
      },
 */
