import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDatabaseClient } from '@rikskollen/db';
import { readOverview } from './overview';

test(
  'overview reconciles corrected session-scoped snapshots, missing data and bounded dated reports',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const { pgPool } = createDatabaseClient();
    const catalogs: string[] = [],
      reports: string[] = [],
      votes: string[] = [],
      checks: string[] = [];
    const source = 'https://data.riksdagen.se/dokumentlista/?rm=2025/26';
    const report = async (
      id: string,
      session: string,
      completed: string | null,
      types: string[],
      date: string | null = '2026-01-01',
    ) => {
      const r = (
        await pgPool.query(
          `INSERT INTO decision_import_runs(document_id,source_url,source_hash,expected_points,completed_at) VALUES($1,$2,'fixture',$3,$4) RETURNING id`,
          [
            id,
            `https://data.riksdagen.se/dokumentstatus/${id}.json`,
            types.length,
            completed,
          ],
        )
      ).rows[0].id;
      reports.push(r);
      await pgPool.query(
        `INSERT INTO decision_documents(run_id,document_id,session,designation,title,status,decision_date) VALUES($1,$2,$3,$4,$5,'done',$6)`,
        [r, id, session, id.slice(4), `Synthetic ${id}`, date],
      );
      for (const [i, type] of types.entries())
        await pgPool.query(
          `INSERT INTO decision_points(run_id,point,heading,proposal_text,decision_type) VALUES($1,$2,'Heading','Proposal',$3)`,
          [r, String(i + 1), type],
        );
      return r;
    };
    try {
      const empty = await readOverview(pgPool);
      assert.equal(empty.votes, null);
      assert.equal(empty.decisions, null);
      const catalog = (
        await pgPool.query(
          `INSERT INTO report_catalog_runs(session,source_url,source_hash,expected_count,page_count,completed_at) VALUES('2025/26',$1,'fixture',6,1,'2030-01-01') RETURNING id`,
          [source],
        )
      ).rows[0].id;
      catalogs.push(catalog);
      await pgPool.query(
        `INSERT INTO report_catalog_pages(run_id,page,source_url,source_hash,item_count) VALUES($1,1,$2,'fixture',6)`,
        [catalog, source],
      );
      for (const id of [
        'HD01TU8',
        'HD01TU9',
        'HD01TU10',
        'HD01TU11',
        'HD01TU12',
        'HD01TU13',
      ])
        await pgPool.query(
          `INSERT INTO report_catalog_entries(run_id,document_id,designation,title,page) VALUES($1,$2,$3,'Catalog title',1)`,
          [catalog, id, id.slice(4)],
        );
      // Retained catalog history must not expand the current selection.
      const historical = (
        await pgPool.query(
          `INSERT INTO report_catalog_runs(session,source_url,source_hash,expected_count,page_count,completed_at) VALUES('2025/26','fixture-history','fixture',10000,1,'2020-01-01') RETURNING id`,
        )
      ).rows[0].id;
      catalogs.push(historical);
      await pgPool.query(
        `INSERT INTO report_catalog_pages(run_id,page,source_url,source_hash,item_count) VALUES($1,1,'fixture-history','fixture',10000)`,
        [historical],
      );
      await pgPool.query(
        `INSERT INTO report_catalog_entries(run_id,document_id,designation,title,page) SELECT $1,'HISTORY' || n,n::text,'Synthetic history',1 FROM generate_series(1,10000) n`,
        [historical],
      );
      let d = (await readOverview(pgPool)).decisions!;
      assert.equal(d.points, 0);
      assert.equal(d.reports, 0);
      assert.equal(d.excludedReports, 6);
      assert.deepEqual(d.recent, []);
      await report('HD01TU8', '2025/26', '2026-01-01', [
        'röstning',
        'röstning',
      ]);
      const correction = await report('HD01TU8', '2025/26', '2026-01-02', [
        ' RÖSTNING ',
        ' acklamation ',
        'Annan',
        '',
      ]);
      await report('HD01TU8', '2025/26', null, ['röstning']);
      await report('HD01TU8', '2024/25', '2031-01-01', [
        'röstning',
        'röstning',
        'röstning',
      ]);
      await report('HD01TU99', '2025/26', '2031-01-01', ['röstning']);
      const undatedRun = await report(
        'HD01TU9',
        '2025/26',
        '2026-01-02',
        ['acklamation'],
        null,
      );
      await report(
        'HD01TU10',
        '2025/26',
        '2026-01-02',
        ['acklamation'],
        '2026-01-02',
      );
      await report('HD01TU11', '2025/26', '2026-01-02', [''], '2026-01-03');
      await report(
        'HD01TU12',
        '2025/26',
        '2026-01-02',
        ['Annan'],
        '2026-01-04',
      );
      for (const id of ['HD01TU8', 'HD01TU13'])
        checks.push(
          (
            await pgPool.query(
              `INSERT INTO decision_source_checks(document_id,session,availability,reason,source_url,source_hash) VALUES($1,'2025/26','unavailable','structured-points-missing','fixture','fixture') RETURNING id`,
              [id],
            )
          ).rows[0].id,
        );
      const v = (
        await pgPool.query(
          `INSERT INTO vote_import_runs(session,source_url,source_hash,expected_files,event_count,completed_at) VALUES('2025/26','https://data.riksdagen.se/dataset/votering/votering-202526.json.zip','fixture',3,3,'2030-01-01') RETURNING id`,
        )
      ).rows[0].id;
      votes.push(v);
      for (let n = 1; n <= 3; n++)
        await pgPool.query(
          `INSERT INTO vote_events(run_id,vote_id,session,designation,proposal_point,subject_type,main_vote_type,source_file,source_url,source_hash) VALUES($1,$2,'2025/26','TU8','1','sak','huvud','fixture','source','fixture')`,
          [v, `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`],
        );
      votes.push(
        (
          await pgPool.query(
            `INSERT INTO vote_import_runs(session,source_url,source_hash,expected_files,event_count,completed_at) VALUES('2024/25','fixture','fixture',99,99,'2031-01-01') RETURNING id`,
          )
        ).rows[0].id,
      );
      votes.push(
        (
          await pgPool.query(
            `INSERT INTO vote_import_runs(session,source_url,source_hash,expected_files,event_count) VALUES('2025/26','fixture','fixture',99,99) RETURNING id`,
          )
        ).rows[0].id,
      );
      const overview = await readOverview(pgPool);
      d = overview.decisions!;
      assert.equal(overview.votes!.events, 3);
      assert.equal(overview.votes!.runId, v);
      assert.equal(d.reports, 5);
      assert.equal(d.sourceReports, 6);
      assert.equal(d.excludedReports, 1);
      assert.equal(d.sourceGaps, 2);
      assert.equal(d.points, 8);
      assert.deepEqual(d.methods, {
        recordedVote: 1,
        acclamation: 3,
        other: 2,
        unknown: 2,
      });
      assert.equal(
        d.sourceValues.reduce((sum, x) => sum + x.count, 0),
        8,
      );
      assert.equal(d.undatedReports, 1);
      assert.deepEqual(
        d.recent.map((r) => r.documentId),
        ['HD01TU12', 'HD01TU11', 'HD01TU10'],
      );
      assert.equal(
        d.recent[0].sourceUrl,
        'https://data.riksdagen.se/dokumentstatus/HD01TU12.json',
      );
      await pgPool.query(
        "UPDATE decision_documents SET decision_date='2026-02-30' WHERE run_id=$1",
        [undatedRun],
      );
      assert.equal((await readOverview(pgPool)).decisions!.undatedReports, 1);
      const { app } = await import('./server');
      const { closeDatabase } = await import('./db');
      try {
        const r = await app.inject('/api/overview');
        assert.equal(r.statusCode, 200);
        assert.equal(r.json().decisions.points, 8);
        await pgPool.query(
          'UPDATE decision_import_runs SET expected_points=99 WHERE id=$1',
          [correction],
        );
        const failed = await app.inject('/api/overview');
        assert.equal(failed.statusCode, 503);
        assert.deepEqual(failed.json(), { error: 'Overview unavailable' });
      } finally {
        await app.close();
        await closeDatabase();
      }
      await pgPool.query(
        'UPDATE decision_import_runs SET expected_points=99 WHERE id=$1',
        [correction],
      );
      await assert.rejects(
        readOverview(pgPool),
        /Incomplete overview decision/,
      );
    } finally {
      await pgPool.query(
        'DELETE FROM decision_source_checks WHERE id=ANY($1::uuid[])',
        [checks],
      );
      await pgPool.query(
        'DELETE FROM decision_import_runs WHERE id=ANY($1::uuid[])',
        [reports],
      );
      await pgPool.query(
        'DELETE FROM report_catalog_runs WHERE id=ANY($1::uuid[])',
        [catalogs],
      );
      await pgPool.query(
        'DELETE FROM vote_import_runs WHERE id=ANY($1::uuid[])',
        [votes],
      );
      await pgPool.end();
    }
  },
);
